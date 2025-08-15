const Product = require("../models/Product")
const { safeSendPhoto, safeSendMessage, sendNotification } = require("../services/botService")
const stateManager = require("../services/stateManager")
const { sanitizeInput } = require("../utils/helpers")

const MAX_IMAGES = 3

const handlePhoto = async (bot, msg) => {
  const chatId = msg.chat.id.toString()
  const sellerState = stateManager.getState("seller", chatId)
  const editState = stateManager.getState("editProduct", chatId)

  try {
    if (sellerState && sellerState.step === "image") {
      await handleProductImage(bot, msg, chatId, sellerState)
    } else if (editState && editState.step === "images") {
      await handleEditProductImages(bot, msg, chatId, editState)
    } else {
      await safeSendMessage(
        bot,
        chatId,
        "❌ Iltimos, faqat mahsulot qo'shish yoki tahrirlash jarayonida rasm yuboring.",
      )
    }
  } catch (error) {
    console.error("Error in photo handler:", error)
    await safeSendMessage(bot, chatId, "❌ Rasmni yuklashda xatolik yuz berdi.")
  }
}

const handleProductImage = async (bot, msg, chatId, sellerState) => {
  const photo = msg.photo[msg.photo.length - 1].file_id

  try {
    if (!sellerState.images) {
      sellerState.images = []
    }

    sellerState.images.push(photo)
    stateManager.setState("seller", chatId, sellerState)

    await safeSendPhoto(bot, chatId, photo, `✅ Rasm ${sellerState.images.length}/${MAX_IMAGES} qo'shildi!`)

    if (sellerState.images.length >= MAX_IMAGES) {
      await createProductWithImages(bot, chatId, sellerState)
    } else {
      const keyboard = [
        [
          { text: "✅ Mahsulotni yaratish", callback_data: "create_product_now" },
          { text: "📷 Yana rasm qo'shish", callback_data: "add_more_images" },
        ],
      ]

      await safeSendMessage(
        bot,
        chatId,
        `📷 Yana rasm qo'shishni xohlaysizmi? (${sellerState.images.length}/${MAX_IMAGES})`,
        {
          reply_markup: { inline_keyboard: keyboard },
        },
      )
    }
  } catch (error) {
    console.error("Error handling product image:", error)
    await safeSendMessage(bot, chatId, "❌ Rasm qo'shishda xatolik yuz berdi.")
  }
}

const createProductWithImages = async (bot, chatId, sellerState) => {
  try {
    const product = await Product.create({
      sellerId: chatId,
      title: sellerState.title,
      price: sellerState.price,
      discount: sellerState.discount,
      description: sellerState.description,
      category: sellerState.category,
      stock: sellerState.stock,
      images: sellerState.images,
      image: sellerState.images[0],
    })

    stateManager.clearState("seller", chatId)

    const firstImage = sellerState.images[0]
    let caption = `✅ Mahsulot muvaffaqiyatli yaratildi!\n\n`
    caption += `📦 ${sanitizeInput(product.title)}\n`
    caption += `💰 ${product.price.toLocaleString()} so'm\n`
    caption += `📷 ${sellerState.images.length} ta rasm`

    await safeSendPhoto(bot, chatId, firstImage, caption)
    sendNotification(chatId, `✅ ${sanitizeInput(product.title)} qo'shildi!`)
  } catch (error) {
    console.error("Error creating product:", error)
    await safeSendMessage(bot, chatId, "❌ Mahsulot yaratishda xatolik yuz berdi.")
  }
}

const handleEditProductImages = async (bot, msg, chatId, editState) => {
  const product = await Product.findById(editState.productId)

  if (!product || product.sellerId !== chatId) {
    stateManager.clearState("editProduct", chatId)
    return await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi yoki ruxsat yo'q.")
  }

  try {
    const photo = msg.photo[msg.photo.length - 1].file_id

    if (!product.images) {
      product.images = []
    }

    if (product.images.length >= MAX_IMAGES) {
      return await safeSendMessage(
        bot,
        chatId,
        `❌ Maksimal ${MAX_IMAGES} ta rasm qo'shish mumkin. /done yozing yoki mavjud rasmlarni o'chiring.`,
      )
    }

    product.images.push(photo)
    product.image = product.images[0]

    await product.save()

    await safeSendPhoto(
      bot,
      chatId,
      photo,
      `✅ Rasm qo'shildi! Jami rasmlar: ${product.images.length}/${MAX_IMAGES}\n\nYana rasm yuborish mumkin yoki /done yozing.`,
    )
  } catch (error) {
    console.error("Error editing product images:", error)
    await safeSendMessage(bot, chatId, "❌ Rasm qo'shishda xatolik yuz berdi.")
  }
}

module.exports = {
  handlePhoto,
  createProductWithImages,
  MAX_IMAGES,
}