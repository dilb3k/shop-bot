const Product = require("../models/Product")
const User = require("../models/User")
const Order = require("../models/Order")
const Conversation = require("../models/Conversation")
const Category = require("../models/Category")
const { safeSendMessage, sendNotification } = require("../services/botService")
const { showCartPage } = require("./cartHandler")
const { showOrdersPage, showOrderProducts } = require("./orderHandler")
const { showUsersPage } = require("./adminHandler")
const { showEditMenu, startEditField } = require("./editProductHandler")
const { createProductWithImages } = require("./photoHandler")
const { sendDetailedProduct, showProductsPage } = require("./productHandler")
const { handleStart } = require("./startHandler")
const { sanitizeInput, calculateDiscountPrice, getCategoryKeyboard } = require("../utils/helpers")
const stateManager = require("../services/stateManager")

const ADMIN_CHAT_ID = "5583276966"

const handleCallbackQuery = async (bot, query) => {
  const chatId = query.message.chat.id.toString()
  const messageId = query.message.message_id
  const data = query.data.split("_")
  const action = data[0]
  console.log(`Received callback query: ${query.data}, chatId: ${chatId}, messageId: ${messageId}`)

  try {
    const user = await User.findOne({ telegramId: chatId })

    if (!user) {
      console.error(`User not found for telegramId: ${chatId}`)
      return await bot.answerCallbackQuery(query.id, { text: "❌ Foydalanuvchi topilmadi" })
    }

    switch (action) {
      case "contact":
        if (data[1] === "admin") {
          console.log(`User ${chatId} requested to contact admin`)
          await safeSendMessage(
            bot,
            ADMIN_CHAT_ID,
            `📩 Foydalanuvchi @${user.username || user.firstName || "Unknown"} (ID: ${chatId}) adminga murojaat qilmoqchi.`
          )
          await Conversation.findOneAndUpdate(
            { chatId },
            { inAdminConversation: true },
            { upsert: true }
          )
          const keyboard = [
            [
              { text: "Ha", callback_data: `end_conversation_${chatId}` },
              { text: "Yo'q", callback_data: `continue_conversation_${chatId}` },
            ],
          ]
          await safeSendMessage(
            bot,
            chatId,
            "Suhbatni yakunlaysizmi?",
            { reply_markup: { inline_keyboard: keyboard } }
          )
          await bot.answerCallbackQuery(query.id)
          console.log(`Set admin conversation state for chatId: ${chatId}`)
        }
        break

      case "no":
        if (data[1] === "contact") {
          console.log(`User ${chatId} declined to contact admin`)
          await Conversation.findOneAndUpdate(
            { chatId },
            { inAdminConversation: false },
            { upsert: true }
          )
          await handleStart(bot, { chat: { id: chatId }, from: { id: chatId, username: user.username, first_name: user.firstName } })
          await bot.answerCallbackQuery(query.id, { text: "🔙 Menyuga qaytildi" })
          console.log(`Cleared admin conversation state for chatId: ${chatId}`)
        }
        break

      case "end":
        if (data[1] === "conversation") {
          console.log(`User ${chatId} ended admin conversation`)
          await Conversation.findOneAndUpdate(
            { chatId },
            { inAdminConversation: false },
            { upsert: true }
          )
          await handleStart(bot, { chat: { id: chatId }, from: { id: chatId, username: user.username, first_name: user.firstName } })
          await bot.answerCallbackQuery(query.id, { text: "✅ Suhbat yakunlandi" })
          console.log(`Cleared admin conversation state and showed main menu for chatId: ${chatId}`)
        }
        break

      case "continue":
        if (data[1] === "conversation") {
          console.log(`User ${chatId} continued admin conversation`)
          await safeSendMessage(bot, chatId, "📩 Xabaringizni yuboring, admin javob beradi.")
          await bot.answerCallbackQuery(query.id, { text: "📝 Xabar yuborishda davom eting" })
        }
        break

      case "create":
        if (data[1] === "product" && data[2] === "now") {
          await handleCreateProductNow(bot, query, user)
        }
        break

      case "add":
        if (data[1] === "new" && data[2] === "category") {
          const sellerState = stateManager.getState("seller", chatId)
          const editState = stateManager.getState("editProduct", chatId)

          if (sellerState) {
            sellerState.step = "new_category_request"
            stateManager.setState("seller", chatId, sellerState)
          } else if (editState) {
            editState.step = "new_category_request"
            stateManager.setState("editProduct", chatId, editState)
          }
          await safeSendMessage(bot, chatId, "📝 Yangi kategoriya nomini kiriting:")
          await bot.answerCallbackQuery(query.id, { text: "➕ Yangi kategoriya qo'shish" })
        } else if (data[1] === "more" && data[2] === "images") {
          await handleAddMoreImages(bot, query, user)
        } else {
          await handleAddToCart(bot, query, user)
        }
        break

      case "image":
        if (data[1] === "prev" && data[2] === "detail") {
          console.log(`Navigating to previous image for product ID: ${data[3]}, index: ${data[4]}`)
          await sendDetailedProduct(bot, chatId, data[3], Number.parseInt(data[4]), messageId)
          await bot.answerCallbackQuery(query.id, { text: "◀️ Oldingi rasm" })
        } else if (data[1] === "next" && data[2] === "detail") {
          console.log(`Navigating to next image for product ID: ${data[3]}, index: ${data[4]}`)
          await sendDetailedProduct(bot, chatId, data[3], Number.parseInt(data[4]), messageId)
          await bot.answerCallbackQuery(query.id, { text: "▶️ Keyingi rasm" })
        }
        break

      case "view":
        if (data[1] === "product") {
          console.log(`Viewing detailed product for ID: ${data[2]}`)
          const product = await Product.findById(data[2])
          if (!product || !product.isActive) {
            console.error(`Product not found or inactive for ID: ${data[2]}`)
            await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi yoki mavjud emas.")
            return await bot.answerCallbackQuery(query.id, { text: "❌ Mahsulot topilmadi" })
          }
          await sendDetailedProduct(bot, chatId, data[2])
          await bot.answerCallbackQuery(query.id, { text: "📋 Mahsulot ma'lumotlari ochildi" })
        } else if (data[1] === "order") {
          console.log(`Viewing order products for order ID: ${data[2]}`)
          await showOrderProducts(bot, chatId, data[2], 1)
          await bot.answerCallbackQuery(query.id, { text: "📜 Buyurtma mahsulotlari ochildi" })
        }
        break

      case "products":
        if (data[1] === "page") {
          console.log(`Navigating to products page: ${data[2]}`)
          await showProductsPage(bot, chatId, Number.parseInt(data[2]) || 1)
          await bot.answerCallbackQuery(query.id, { text: "📄 Sahifa o'zgartirildi" })
        }
        break

      case "cart":
        if (data[1] === "page") {
          console.log(`Navigating to cart page: ${data[2]}`)
          await showCartPage(bot, chatId, Number.parseInt(data[2]) || 1)
          await bot.answerCallbackQuery(query.id, { text: "🛒 Savatcha sahifasi ochildi" })
        }
        break

      case "orders":
        if (data[1] === "page") {
          console.log(`Navigating to orders page: ${data[2]}`)
          await showOrdersPage(bot, chatId, Number.parseInt(data[2]) || 1)
          await bot.answerCallbackQuery(query.id, { text: "📜 Buyurtmalar sahifasi ochildi" })
        }
        break

      case "users":
        if (data[1] === "page") {
          console.log(`Navigating to users page: ${data[2]}`)
          await showUsersPage(bot, chatId, Number.parseInt(data[2]) || 1)
          await bot.answerCallbackQuery(query.id, { text: "👥 Foydalanuvchilar sahifasi ochildi" })
        }
        break

      case "remove":
        if (data[1] === "cart") {
          console.log(`Removing product from cart: ${data[2]}`)
          await handleRemoveFromCart(bot, query, user)
        }
        break

      case "like":
        console.log(`Handling like for product ID: ${data[1]}`)
        await handleLike(bot, query, user)
        break

      case "edit":
        if (data[1] === "menu") {
          console.log(`Showing edit menu for product ID: ${data[2]}`)
          await showEditMenu(bot, chatId, data[2])
          await bot.answerCallbackQuery(query.id, { text: "✏️ Tahrirlash menyusi ochildi" })
        } else {
          console.log(`Starting edit field: ${data[1]}, product ID: ${data[2]}`)
          await startEditField(bot, chatId, data[1], data[2])
          await bot.answerCallbackQuery(query.id, { text: "✏️ Tahrirlash boshlandi" })
        }
        break

      case "delete":
        console.log(`Deleting product ID: ${data[1]}`)
        await handleDeleteProduct(bot, query, user)
        break

      case "checkout":
        console.log(`Processing checkout for chatId: ${chatId}`)
        await handleCheckout(bot, query, user)
        break

      case "clear":
        if (data[1] === "cart") {
          console.log(`Clearing cart for chatId: ${chatId}`)
          await handleClearCart(bot, query, user)
        }
        break

      case "role":
        console.log(`Changing role for user ID: ${data[2]} to ${data[1]}`)
        await handleRoleChange(bot, query, user)
        break

      case "order":
        if (data[1] === "process") {
          console.log(`Processing order ID: ${data[2]}`)
          await handleOrderStatusChange(bot, query, user, data[2], "processing")
        } else if (data[1] === "complete") {
          console.log(`Completing order ID: ${data[2]}`)
          await handleOrderStatusChange(bot, query, user, data[2], "completed")
        } else if (data[1] === "cancel") {
          console.log(`Cancelling order ID: ${data[2]}`)
          await handleOrderStatusChange(bot, query, user, data[2], "cancelled")
        }
        break

      case "current":
        if (data[1] === "page") {
          console.log(`Current page selected for chatId: ${chatId}`)
          await bot.answerCallbackQuery(query.id, { text: "📄 Hozirgi sahifa" })
        }
        break

      case "select":
        if (data[1] === "category") {
          const categoryName = data.slice(2).join("_")
          const sellerState = stateManager.getState("seller", chatId)
          const editState = stateManager.getState("editProduct", chatId)

          if (sellerState && sellerState.step === "category_selection") {
            sellerState.category = categoryName
            sellerState.step = "stock"
            stateManager.setState("seller", chatId, sellerState)
            await safeSendMessage(bot, chatId, "📦 Ombordagi sonini kiriting (0 yoki undan yuqori):")
          } else if (editState && editState.step === "category_selection") {
            const product = await Product.findById(editState.productId)
            if (!product || product.sellerId !== chatId) {
              stateManager.clearState("editProduct", chatId)
              return await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi yoki ruxsat yo'q.")
            }
            product.category = categoryName
            await product.save()
            stateManager.clearState("editProduct", chatId)
            await safeSendMessage(bot, chatId, "✅ Mahsulot kategoriyasi muvaffaqiyatli yangilandi!")
            sendNotification(chatId, `✅ ${sanitizeInput(product.title)} kategoriyasi yangilandi!`)
          }
          await bot.answerCallbackQuery(query.id, { text: `🗂 Kategoriya tanlandi: ${sanitizeInput(categoryName)}` })
        }
        break

      case "confirm":
        if (data[1] === "new" && data[2] === "category") {
          const sellerState = stateManager.getState("seller", chatId)
          const editState = stateManager.getState("editProduct", chatId)

          if (sellerState) {
            sellerState.step = "wait_for_category_approval"
            stateManager.setState("seller", chatId, sellerState)
          } else if (editState) {
            editState.step = "wait_for_category_approval"
            stateManager.setState("editProduct", chatId, editState)
          }
          await safeSendMessage(bot, chatId, "⏳ Kategoriya tasdiqlanishini kuting...")
          await bot.answerCallbackQuery(query.id, { text: "⏳ Kategoriya tasdiqlanishini kuting" })
        }
        break

      case "cancel":
        if (data[1] === "new" && data[2] === "category") {
          const sellerState = stateManager.getState("seller", chatId)
          const editState = stateManager.getState("editProduct", chatId)

          if (sellerState) {
            sellerState.step = "category_selection"
            stateManager.setState("seller", chatId, sellerState)
            const categoryKeyboard = await getCategoryKeyboard()
            if (!categoryKeyboard) {
              stateManager.clearState("seller", chatId)
              return await safeSendMessage(bot, chatId, "❌ Hozirda kategoriyalar mavjud emas. Mahsulot yaratish bekor qilindi.")
            }
            await safeSendMessage(bot, chatId, "🗂 Kategoriyani tanlang:", {
              reply_markup: categoryKeyboard,
            })
            await bot.answerCallbackQuery(query.id, { text: "🔙 Kategoriya tanlashga qaytildi" })
          } else if (editState) {
            editState.step = "category_selection"
            stateManager.setState("editProduct", chatId, editState)
            const categoryKeyboard = await getCategoryKeyboard()
            if (!categoryKeyboard) {
              stateManager.clearState("editProduct", chatId)
              return await safeSendMessage(bot, chatId, "❌ Hozirda kategoriyalar mavjud emas. Mahsulot tahrirlash bekor qilindi.")
            }
            await safeSendMessage(bot, chatId, "🗂 Kategoriyani tanlang:", {
              reply_markup: categoryKeyboard,
            })
            await bot.answerCallbackQuery(query.id, { text: "🔙 Kategoriya tanlashga qaytildi" })
          } else {
            await bot.answerCallbackQuery(query.id, { text: "❌ Jarayon holati topilmadi" })
          }
        }
        break

      case "approve":
        if (data[1] === "category") {
          const categoryName = data.slice(2, -1).join("_")
          const requesterChatId = data[data.length - 1]
          console.log(`User ${chatId} (role: ${user.role}) attempting to approve category: ${categoryName}, requester: ${requesterChatId}`)
          if (user.role.toLowerCase() !== "admin") {
            console.error(`Permission denied for category approval, user: ${chatId}, role: ${user.role}`)
            return await bot.answerCallbackQuery(query.id, { text: "❌ Faqat admin kategoriyani tasdiqlay oladi" })
          }
          try {
            const existingCategory = await Category.findOne({ name: categoryName }).lean()
            if (existingCategory) {
              console.warn(`Category already exists: ${categoryName}`)
              await safeSendMessage(bot, requesterChatId, `⚠️ Kategoriya "${sanitizeInput(categoryName)}" allaqachon mavjud!`)
              sendNotification(requesterChatId, `⚠️ Kategoriya "${sanitizeInput(categoryName)}" allaqachon mavjud!`)
              await bot.answerCallbackQuery(query.id, { text: `⚠️ Kategoriya "${sanitizeInput(categoryName)}" allaqachon mavjud` })
              return
            }
            const category = await Category.create({ name: categoryName })
            console.log(`Category created: ${categoryName}, ID: ${category._id}`)
            await safeSendMessage(bot, requesterChatId, `✅ Kategoriya "${sanitizeInput(categoryName)}" muvaffaqiyatli yaratildi!`)
            sendNotification(requesterChatId, `✅ Kategoriya "${sanitizeInput(categoryName)}" yaratildi!`)

            const sellerState = stateManager.getState("seller", requesterChatId)
            const editState = stateManager.getState("editProduct", requesterChatId)

            if (sellerState && sellerState.step === "wait_for_category_approval") {
              sellerState.category = categoryName
              sellerState.step = "stock"
              stateManager.setState("seller", requesterChatId, sellerState)
              await safeSendMessage(bot, requesterChatId, "📦 Ombordagi sonini kiriting (0 yoki undan yuqori):")
            } else if (editState && editState.step === "wait_for_category_approval") {
              const product = await Product.findById(editState.productId)
              if (!product || product.sellerId !== requesterChatId) {
                stateManager.clearState("editProduct", requesterChatId)
                return await safeSendMessage(bot, requesterChatId, "❌ Mahsulot topilmadi yoki ruxsat yo'q.")
              }
              product.category = categoryName
              await product.save()
              stateManager.clearState("editProduct", requesterChatId)
              await safeSendMessage(bot, requesterChatId, "✅ Mahsulot kategoriyasi muvaffaqiyatli yangilandi!")
              sendNotification(requesterChatId, `✅ ${sanitizeInput(product.title)} kategoriyasi yangilandi!`)
            } else {
              console.warn(`No valid state found for requesterChatId: ${requesterChatId}`)
              await safeSendMessage(bot, requesterChatId, "⚠️ Kategoriya tasdiqlandi, lekin jarayon holati topilmadi.")
            }
            await bot.answerCallbackQuery(query.id, { text: `✅ Kategoriya "${sanitizeInput(categoryName)}" tasdiqlandi` })
            await safeSendMessage(bot, chatId, `✅ Kategoriya "${sanitizeInput(categoryName)}" tasdiqlandi`)
          } catch (error) {
            console.error(`Error approving category "${categoryName}" for requester ${requesterChatId}:`, error)
            await bot.answerCallbackQuery(query.id, { text: "❌ Kategoriyani tasdiqlashda xatolik yuz berdi" })
            await safeSendMessage(bot, requesterChatId, "❌ Kategoriyani tasdiqlashda xatolik yuz berdi.")
          }
        }
        break

      case "reject":
        if (data[1] === "category") {
          const categoryName = data.slice(2, -1).join("_")
          const requesterChatId = data[data.length - 1]
          console.log(`User ${chatId} (role: ${user.role}) attempting to reject category: ${categoryName}, requester: ${requesterChatId}`)
          if (user.role.toLowerCase() !== "admin") {
            console.error(`Permission denied for category rejection, user: ${chatId}, role: ${user.role}`)
            return await bot.answerCallbackQuery(query.id, { text: "❌ Faqat admin kategoriyani rad etishi mumkin" })
          }
          try {
            stateManager.setState("admin", chatId, { step: "reject_reason", categoryName, requesterChatId })
            await safeSendMessage(bot, chatId, "📝 Kategoriya rad etilish sababini kiriting:")
            await bot.answerCallbackQuery(query.id, { text: "📝 Rad etish sababini kiriting" })
          } catch (error) {
            console.error(`Error initiating category rejection for "${categoryName}", requester ${requesterChatId}:`, error)
            await bot.answerCallbackQuery(query.id, { text: "❌ Kategoriyani rad etishda xatolik yuz berdi" })
            await safeSendMessage(bot, requesterChatId, "❌ Kategoriyani rad etishda xatolik yuz berdi.")
          }
        }
        break

      default:
        console.error(`Unknown callback action: ${action}, full data: ${query.data}`)
        await bot.answerCallbackQuery(query.id, { text: "❌ Noma'lum buyruq" })
    }
  } catch (error) {
    console.error(`Error in handleCallbackQuery for chatId: ${chatId}, query: ${query.data}:`, error)
    await bot.answerCallbackQuery(query.id, { text: "❌ Xatolik yuz berdi" })
  }
}

const handleCreateProductNow = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString()
  const sellerState = stateManager.getState("seller", chatId)

  if (!sellerState || !sellerState.images || sellerState.images.length === 0) {
    console.error(`No images found for product creation, chatId: ${chatId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Rasm topilmadi" })
  }

  await createProductWithImages(bot, chatId, sellerState)
  stateManager.clearState("seller", chatId)
  await bot.answerCallbackQuery(query.id, { text: "✅ Mahsulot yaratildi!" })
}

const handleAddMoreImages = async (bot, query, user) => {
  console.log(`Requesting more images for chatId: ${query.message.chat.id}`)
  await bot.answerCallbackQuery(query.id, { text: "📷 Yana rasm yuboring" })
  await safeSendMessage(bot, query.message.chat.id, "📷 Yana rasm yuboring:")
}

const handleAddToCart = async (bot, query, user) => {
  const productId = query.data.split("_")[1]
  const product = await Product.findById(productId)

  if (!product || !product.isActive) {
    console.error(`Product not found or inactive for ID: ${productId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Mahsulot topilmadi" })
  }

  if (product.stock <= 0) {
    console.error(`Product out of stock for ID: ${productId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Mahsulot omborda mavjud emas" })
  }

  if (!user.cart.includes(productId)) {
    user.cart.push(product._id)
    await user.save()
    console.log(`Added product ID: ${productId} to cart for user: ${user.telegramId}`)
    await bot.answerCallbackQuery(query.id, { text: `🛒 ${sanitizeInput(product.title)} savatchaga qo'shildi!` })
    sendNotification(user.telegramId, `🛒 ${sanitizeInput(product.title)} savatchaga qo'shildi!`)
  } else {
    console.warn(`Product ID: ${productId} already in cart for user: ${user.telegramId}`)
    await bot.answerCallbackQuery(query.id, { text: "⚠️ Mahsulot allaqachon savatchada!" })
  }
}

const handleRemoveFromCart = async (bot, query, user) => {
  const productId = query.data.split("_")[2]

  user.cart = user.cart.filter((id) => id.toString() !== productId)
  await user.save()
  console.log(`Removed product ID: ${productId} from cart for user: ${user.telegramId}`)

  await bot.answerCallbackQuery(query.id, { text: "🗑️ Mahsulot savatchadan o'chirildi" })
  await showCartPage(bot, query.message.chat.id, 1)
}

const handleLike = async (bot, query, user) => {
  const productId = query.data.split("_")[1]
  const product = await Product.findById(productId)

  if (!product || !product.isActive) {
    console.error(`Product not found or inactive for ID: ${productId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Mahsulot topilmadi" })
  }

  if (product.likes.includes(user.telegramId)) {
    product.likes = product.likes.filter((like) => like !== user.telegramId)
    console.log(`Removed like for product ID: ${productId} by user: ${user.telegramId}`)
    await bot.answerCallbackQuery(query.id, { text: "💔 Like olib tashlandi" })
  } else {
    product.likes.push(user.telegramId)
    console.log(`Added like for product ID: ${productId} by user: ${user.telegramId}`)
    await bot.answerCallbackQuery(query.id, { text: "❤️ Liked!" })
  }

  await product.save()
}

const handleDeleteProduct = async (bot, query, user) => {
  const productId = query.data.split("_")[1]
  const product = await Product.findById(productId)

  if (!product || product.sellerId !== user.telegramId) {
    console.error(`Permission denied or product not found for ID: ${productId}, user: ${user.telegramId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Ruxsat yo'q yoki mahsulot topilmadi" })
  }

  product.isActive = false
  await product.save()
  console.log(`Deleted product ID: ${productId} by user: ${user.telegramId}`)

  await bot.answerCallbackQuery(query.id, { text: "🗑 Mahsulot o'chirildi" })
  sendNotification(user.telegramId, `🗑 ${sanitizeInput(product.title)} o'chirildi!`)
}

const handleCheckout = async (bot, query, user) => {
  if (!user.cart.length) {
    console.warn(`Cart is empty for user: ${user.telegramId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Savatchangiz bo'sh!" })
  }

  const products = await Product.find({ _id: { $in: user.cart }, isActive: true })
  const outOfStock = products.filter((p) => p.stock <= 0)

  if (outOfStock.length > 0) {
    console.error(`Out of stock products: ${outOfStock.map((p) => p.title).join(", ")}`)
    return await bot.answerCallbackQuery(query.id, {
      text: `❌ ${outOfStock.map((p) => sanitizeInput(p.title)).join(", ")} omborda mavjud emas!`,
    })
  }

  const totalPrice = products.reduce((sum, p) => {
    return sum + calculateDiscountPrice(p.price, p.discount)
  }, 0)

  const order = await Order.create({
    clientId: user.telegramId,
    products: user.cart,
    totalPrice,
  })

  for (const product of products) {
    product.stock -= 1
    await product.save()
  }

  user.cart = []
  await user.save()
  console.log(`Checkout completed for user: ${user.telegramId}, order ID: ${order._id}`)

  await bot.answerCallbackQuery(query.id, { text: "✅ Buyurtma qabul qilindi!" })
  sendNotification(user.telegramId, "✅ Buyurtma qabul qilindi!")
}

const handleClearCart = async (bot, query, user) => {
  user.cart = []
  await user.save()
  console.log(`Cart cleared for user: ${user.telegramId}`)

  await bot.answerCallbackQuery(query.id, { text: "🗑️ Savatcha tozalandi" })
  await showCartPage(bot, query.message.chat.id, 1)
}

const handleRoleChange = async (bot, query, user) => {
  if (user.role.toLowerCase() !== "admin") {
    console.error(`Permission denied for role change, user: ${user.telegramId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Ruxsat yo'q" })
  }

  const [, role, userId] = query.data.split("_")
  const targetUser = await User.findOneAndUpdate({ telegramId: userId }, { role }, { new: true })

  if (!targetUser) {
    console.error(`Target user not found for ID: ${userId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Foydalanuvchi topilmadi" })
  }

  console.log(`Role changed for user ID: ${userId} to ${role}`)
  await bot.answerCallbackQuery(query.id, {
    text: `✅ @${targetUser.username || targetUser.firstName} ro'li ${role.toUpperCase()} ga o'zgartirildi`,
  })

  sendNotification(userId, `✅ Sizning rolingiz ${role.toUpperCase()} ga o'zgartirildi`)
}

const handleOrderStatusChange = async (bot, query, user, orderId, newStatus) => {
  if (user.role.toLowerCase() !== "seller" && user.role.toLowerCase() !== "admin") {
    console.error(`Permission denied for order status change, user: ${user.telegramId}`)
    return await bot.answerCallbackQuery(query.id, { text: "❌ Ruxsat yo'q" })
  }

  try {
    const order = await Order.findByIdAndUpdate(orderId, { status: newStatus }, { new: true })

    if (!order) {
      console.error(`Order not found for ID: ${orderId}`)
      return await bot.answerCallbackQuery(query.id, { text: "❌ Buyurtma topilmadi" })
    }

    const statusText = {
      processing: "🔄 Jarayonda",
      completed: "✅ Yakunlandi",
      cancelled: "❌ Bekor qilindi",
    }

    console.log(`Order status changed to ${newStatus} for order ID: ${orderId}`)
    await bot.answerCallbackQuery(query.id, {
      text: `✅ Buyurtma holati: ${statusText[newStatus]}`,
    })

    sendNotification(order.clientId, `📜 Buyurtma #${order._id.toString().slice(-6)} holati: ${statusText[newStatus]}`)

    await showOrderProducts(bot, query.message.chat.id, orderId, 1)
  } catch (error) {
    console.error(`Error changing order status for order ID: ${orderId}:`, error)
    await bot.answerCallbackQuery(query.id, { text: "❌ Xatolik yuz berdi" })
  }
}

module.exports = {
  handleCallbackQuery,
}