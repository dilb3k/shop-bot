const Product = require("../models/Product")
const User = require("../models/User")
const { safeSendMessage, safeSendPhoto } = require("../services/botService")
const { sanitizeInput, formatDate, calculateDiscountPrice, getCategoryKeyboard } = require("../utils/helpers")
const stateManager = require("../services/stateManager")

const handleEditProducts = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  try {
    const user = await User.findOne({ telegramId: chatId })

    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi. /start buyrug'ini bosing.")
    }

    if (user.role !== "seller" && user.role !== "admin") {
      return await safeSendMessage(bot, chatId, "❌ Faqat sotuvchilar mahsulotlarni tahrirlashi mumkin.")
    }

    const products = await Product.find({
      sellerId: chatId,
      isActive: true,
    }).sort({ createdAt: -1 })

    if (products.length === 0) {
      return await safeSendMessage(bot, chatId, "😔 Sizda mahsulotlar yo'q.")
    }

    for (const product of products) {
      const discountPrice = calculateDiscountPrice(product.price, product.discount)
      const stockStatus = product.stock > 0 ? `✅ ${product.stock} dona` : "❌ Omborda yo'q"

      let priceText = ""
      if (product.discount > 0) {
        priceText = `💰 <s>${product.price.toLocaleString()}</s> ➜ <b>${discountPrice.toLocaleString()} so'm</b> (-${product.discount}%)`
      } else {
        priceText = `💰 <b>${discountPrice.toLocaleString()} so'm</b>`
      }

      const message =
        `<b>📦 ${sanitizeInput(product.title)}</b>\n\n` +
        `${priceText}\n` +
        `🗂️ Kategoriya: ${sanitizeInput(product.category)}\n` +
        `📦 ${stockStatus}\n` +
        `⭐ ${product.rating.toFixed(1)} (${product.ratingCount} ovoz)\n` +
        `📅 Yaratilgan: ${formatDate(product.createdAt)}`

      const keyboard = [
        [{ text: "✏️ Tahrirlash", callback_data: `edit_menu_${product._id}` }],
        [{ text: "🗑 O'chirish", callback_data: `delete_${product._id}` }],
      ]

      const image = product.images && product.images.length > 0 ? product.images[0] : product.image

      await safeSendPhoto(bot, chatId, image, message, {
        reply_markup: { inline_keyboard: keyboard },
      })
    }
  } catch (error) {
    console.error("Error in edit products handler:", error)
    await safeSendMessage(bot, chatId, "❌ Mahsulotlarni olishda xatolik yuz berdi.")
  }
}

const showEditMenu = async (bot, chatId, productId) => {
  try {
    const product = await Product.findById(productId)

    if (!product || !product.isActive) {
      return await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi.")
    }

    const message = `<b>✏️ ${sanitizeInput(product.title)} ni tahrirlash</b>\n\nNimani tahrirlashni xohlaysiz?`

    const keyboard = [
      [
        { text: "📝 Nom", callback_data: `edit_title_${productId}` },
        { text: "💰 Narx", callback_data: `edit_price_${productId}` },
      ],
      [
        { text: "🔥 Chegirma", callback_data: `edit_discount_${productId}` },
        { text: "📦 Ombor", callback_data: `edit_stock_${productId}` },
      ],
      [
        { text: "🗂️ Kategoriya", callback_data: `edit_category_${productId}` },
        { text: "📝 Tavsif", callback_data: `edit_description_${productId}` },
      ],
      [
        { text: "📷 Rasmlar", callback_data: `edit_images_${productId}` },
        { text: "❌ Bekor qilish", callback_data: `cancel_edit_${productId}` },
      ],
    ]

    await safeSendMessage(bot, chatId, message, {
      reply_markup: { inline_keyboard: keyboard },
    })
  } catch (error) {
    console.error("Error showing edit menu:", error)
    await safeSendMessage(bot, chatId, "❌ Tahrirlash menyusini ko'rsatishda xatolik yuz berdi.")
  }
}

const startEditField = async (bot, chatId, field, productId) => {
  try {
    const product = await Product.findById(productId)

    if (!product || !product.isActive) {
      return await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi.")
    }

    let message = ""
    let currentValue = ""

    switch (field) {
      case "title":
        message = "📝 Yangi nomini kiriting:"
        currentValue = product.title
        break
      case "price":
        message = "💰 Yangi narxini kiriting (so'm):"
        currentValue = product.price.toString()
        break
      case "discount":
        message = "🔥 Yangi chegirma foizini kiriting (0-100):"
        currentValue = product.discount.toString()
        break
      case "stock":
        message = "📦 Yangi ombor sonini kiriting: "
        currentValue = product.stock.toString()
        break
      case "category":
        message = "🗂️ Kategoriyani tanlang yoki yangi kategoriya yarating:"
        currentValue = product.category
        const categoryKeyboard = await getCategoryKeyboard()
        if (!categoryKeyboard) {
          return await safeSendMessage(bot, chatId, "❌ Kategoriyalar topilmadi. Admin bilan bog'laning.")
        }
        categoryKeyboard.inline_keyboard.push([
          { text: "➕ Yangi kategoriya", callback_data: `new_category` },
        ])
        stateManager.setState("editProduct", chatId, {
          step: field,
          productId: productId,
        })
        return await safeSendMessage(bot, chatId, `${message}\n\n<i>Hozirgi qiymat: ${currentValue}</i>`, {
          reply_markup: categoryKeyboard,
        })
      case "description":
        message = "📝 Yangi tavsifini kiriting:"
        currentValue = product.description || ""
        break
      case "images":
        message = "📷 Yangi rasmlarni yuboring (bir nechta rasm yuborish mumkin):"
        currentValue = `${product.images?.length || 0} ta rasm`
        break
    }

    stateManager.setState("editProduct", chatId, {
      step: field,
      productId: productId,
    })

    await safeSendMessage(bot, chatId, `${message}\n\n<i>Hozirgi qiymat: ${currentValue}</i>`)
  } catch (error) {
    console.error("Error starting edit field:", error)
    await safeSendMessage(bot, chatId, "❌ Tahrirlashni boshlashda xatolik yuz berdi.")
  }
}

module.exports = {
  handleEditProducts,
  showEditMenu,
  startEditField,
}