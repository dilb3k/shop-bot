const Product = require("../models/Product")
const User = require("../models/User")
const Message = require("../models/Message")
const Order = require("../models/Order")
const { safeSendMessage, sendNotification } = require("../services/botService")
const stateManager = require("../services/stateManager")
const { sanitizeInput, validatePrice, validateDiscount, validateStock, getCategoryKeyboard, sendCategoryRequestToAdmin } = require("../utils/helpers")

const handleMessage = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  // Skip if it's a command or special message
  if (msg.text && msg.text.startsWith("/")) return
  if (msg.contact || msg.photo) return

  const sellerState = stateManager.getState("seller", chatId)
  const editState = stateManager.getState("editProduct", chatId)
  const user = await User.findOne({ telegramId: chatId })

  if (!user) {
    console.error(`User not found for telegramId: ${chatId}`)
    return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi.")
  }

  try {
    // Handle done command for image editing
    if (msg.text === "/done" && editState && editState.step === "images") {
      stateManager.clearState("editProduct", chatId)
      await safeSendMessage(bot, chatId, "✅ Rasmlar muvaffaqiyatli yangilandi!")
      return
    }

    // Handle Product Creation
    if (sellerState) {
      await handleProductCreation(bot, msg, chatId, sellerState, user)
      return
    }

    // Handle Product Editing
    if (editState) {
      await handleProductEditing(bot, msg, chatId, editState)
      return
    }
  } catch (error) {
    console.error(`Error in message handler for chatId: ${chatId}:`, error)
    await safeSendMessage(bot, chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
  }
}

const handleProductCreation = async (bot, msg, chatId, sellerState, user) => {
  try {
    if (sellerState.step === "title") {
      if (!msg.text || msg.text.length < 3) {
        return await safeSendMessage(bot, chatId, "❌ Mahsulot nomi kamida 3 harfdan iborat bo'lishi kerak.")
      }
      sellerState.title = sanitizeInput(msg.text)
      sellerState.step = "price"
      stateManager.setState("seller", chatId, sellerState)
      await safeSendMessage(bot, chatId, "💰 Narxini kiriting (so'm, musbat raqam):")
    } else if (sellerState.step === "price") {
      if (!validatePrice(msg.text)) {
        return await safeSendMessage(bot, chatId, "❌ Iltimos, to'g'ri narx kiriting (musbat raqam).")
      }
      sellerState.price = Number.parseInt(msg.text)
      sellerState.step = "discount"
      stateManager.setState("seller", chatId, sellerState)
      await safeSendMessage(bot, chatId, "💸 Chegirma foizini kiriting (0-100, 0 bo'lsa chegirma yo'q):")
    } else if (sellerState.step === "discount") {
      if (!validateDiscount(msg.text)) {
        return await safeSendMessage(bot, chatId, "❌ Iltimos, 0-100 oralig'ida chegirma kiriting.")
      }
      sellerState.discount = Number.parseInt(msg.text)
      sellerState.step = "description"
      stateManager.setState("seller", chatId, sellerState)
      await safeSendMessage(bot, chatId, "📝 Tavsifini kiriting (ixtiyoriy, bo'sh qoldirish mumkin):")
    } else if (sellerState.step === "description") {
      sellerState.description = msg.text ? sanitizeInput(msg.text) : ""
      sellerState.step = "category_selection"
      stateManager.setState("seller", chatId, sellerState)
      const categoryKeyboard = await getCategoryKeyboard()
      if (!categoryKeyboard) {
        return await safeSendMessage(bot, chatId, "❌ Hozirda kategoriyalar mavjud emas. Yangi kategoriya so'rovini adminga yuboring.")
      }
      await safeSendMessage(bot, chatId, "🗂 Kategoriyani tanlang yoki yangi kategoriya qo'shing:", {
        reply_markup: categoryKeyboard,
      })
    } else if (sellerState.step === "new_category_request") {
      if (!msg.text || msg.text.length < 3) {
        return await safeSendMessage(bot, chatId, "❌ Kategoriya nomi kamida 3 harfdan iborat bo'lishi kerak.")
      }
      const categoryName = sanitizeInput(msg.text)
      sellerState.newCategoryName = categoryName
      sellerState.step = "confirm_category_request"
      sellerState.requestTimestamp = Date.now()
      stateManager.setState("seller", chatId, sellerState)
      const keyboard = [
        [
          { text: "Ha", callback_data: `confirm_new_category_${chatId}` },
          { text: "Yo'q", callback_data: `cancel_new_category_${chatId}` },
        ],
      ]
      await safeSendMessage(
        bot,
        chatId,
        `📩 Kategoriya so'rovingiz adminga yuborildi: "${categoryName}".\n` +
        `Agar kategoriya tasdiqlansa, sizga xabar beriladi.\n` +
        `Kategoriyani mavjudlardan tanlaysizmi yoki yangi kategoriya tasdiqlanishini kutasizmi?`,
        { reply_markup: { inline_keyboard: keyboard } }
      )
      await sendCategoryRequestToAdmin(bot, user, categoryName, chatId)
    } else if (sellerState.step === "stock") {
      if (!validateStock(msg.text)) {
        return await safeSendMessage(bot, chatId, "❌ Iltimos, to'g'ri son kiriting (0 yoki undan yuqori).")
      }
      sellerState.stock = Number.parseInt(msg.text)
      sellerState.step = "image"
      stateManager.setState("seller", chatId, sellerState)
      await safeSendMessage(bot, chatId, "📷 Mahsulot rasmini yuboring:")
    }
  } catch (error) {
    console.error(`Error in handleProductCreation for chatId: ${chatId}:`, error)
    await safeSendMessage(bot, chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
  }
}

const handleProductEditing = async (bot, msg, chatId, editState) => {
  const product = await Product.findById(editState.productId)

  if (!product || product.sellerId !== chatId) {
    stateManager.clearState("editProduct", chatId)
    return await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi yoki ruxsat yo'q.")
  }

  try {
    switch (editState.step) {
      case "title":
        if (!msg.text || msg.text.length < 3) {
          return await safeSendMessage(bot, chatId, "❌ Mahsulot nomi kamida 3 harfdan iborat bo'lishi kerak.")
        }
        product.title = sanitizeInput(msg.text)
        break

      case "price":
        if (!validatePrice(msg.text)) {
          return await safeSendMessage(bot, chatId, "❌ Iltimos, to'g'ri narx kiriting (musbat raqam).")
        }
        product.price = Number.parseInt(msg.text)
        break

      case "discount":
        if (!validateDiscount(msg.text)) {
          return await safeSendMessage(bot, chatId, "❌ Iltimos, 0-100 oralig'ida chegirma kiriting.")
        }
        product.discount = Number.parseInt(msg.text)
        break

      case "stock":
        if (!validateStock(msg.text)) {
          return await safeSendMessage(bot, chatId, "❌ Iltimos, to'g'ri son kiriting (0 yoki undan yuqori).")
        }
        product.stock = Number.parseInt(msg.text)
        break

      case "category_selection":
        const categoryKeyboard = await getCategoryKeyboard()
        if (!categoryKeyboard) {
          return await safeSendMessage(bot, chatId, "❌ Hozirda kategoriyalar mavjud emas. Yangi kategoriya so'rovini adminga yuboring.")
        }
        await safeSendMessage(bot, chatId, "🗂 Kategoriyani tanlang yoki yangi kategoriya qo'shing:", {
          reply_markup: categoryKeyboard,
        })
        return

      case "new_category_request":
        if (!msg.text || msg.text.length < 3) {
          return await safeSendMessage(bot, chatId, "❌ Kategoriya nomi kamida 3 harfdan iborat bo'lishi kerak.")
        }
        const categoryName = sanitizeInput(msg.text)
        editState.newCategoryName = categoryName
        editState.step = "confirm_category_request"
        editState.requestTimestamp = Date.now()
        stateManager.setState("editProduct", chatId, editState)
        const keyboard = [
          [
            { text: "Ha", callback_data: `confirm_new_category_${chatId}` },
            { text: "Yo'q", callback_data: `cancel_new_category_${chatId}` },
          ],
        ]
        await safeSendMessage(
          bot,
          chatId,
          `📩 Kategoriya so'rovingiz adminga yuborildi: "${categoryName}".\n` +
          `Agar kategoriya tasdiqlansa, sizga xabar beriladi.\n` +
          `Kategoriyani mavjudlardan tanlaysizmi yoki yangi kategoriya tasdiqlanishini kutasizmi?`,
          { reply_markup: { inline_keyboard: keyboard } }
        )
        await sendCategoryRequestToAdmin(bot, user, categoryName, chatId)
        return

      case "description":
        product.description = msg.text ? sanitizeInput(msg.text) : ""
        break

      case "images":
        // This is handled in photo handler
        return
    }

    await product.save()
    stateManager.clearState("editProduct", chatId)

    await safeSendMessage(bot, chatId, "✅ Mahsulot muvaffaqiyatli yangilandi!")
    sendNotification(chatId, `✅ ${sanitizeInput(product.title)} yangilandi!`)
  } catch (error) {
    console.error(`Error editing product for chatId: ${chatId}:`, error)
    await safeSendMessage(bot, chatId, "❌ Mahsulotni yangilashda xatolik yuz berdi.")
  }
}

// Timeout check for category approval
const checkCategoryRequestTimeout = async (bot) => {
  const TIMEOUT_MS = 24 * 60 * 60 * 1000 // 24 hours
  const states = ["seller", "editProduct"]
  for (const stateType of states) {
    const allStates = stateManager.getAllStates(stateType)
    for (const [chatId, state] of Object.entries(allStates)) {
      if (state.step === "wait_for_category_approval" && state.requestTimestamp) {
        const elapsed = Date.now() - state.requestTimestamp
        if (elapsed > TIMEOUT_MS) {
          stateManager.clearState(stateType, chatId)
          await safeSendMessage(
            bot,
            chatId,
            "⏰ Kategoriya so'rovingizning vaqti o'tdi. Iltimos, qaytadan urinib ko'ring yoki mavjud kategoriyalardan birini tanlang."
          )
          console.log(`Timed out category request for chatId: ${chatId}, state: ${stateType}`)
        }
      }
    }
  }
}

// Run timeout check every hour
setInterval(() => checkCategoryRequestTimeout(bot), 60 * 60 * 1000)

module.exports = {
  handleMessage,
}