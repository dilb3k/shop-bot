const validator = require("validator")
const Category = require("../models/Category")
const { safeSendMessage } = require("../services/botService")

// Matnni xavfsizlashtirish
const sanitizeInput = (input) => {
  if (!input) return ""
  return validator.escape(input.toString().trim()).substring(0, 30)
}

// Sana va vaqtni formatlash
const formatDate = (date) => {
  return new Date(date).toLocaleString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Chegirmali narxni hisoblash
const calculateDiscountPrice = (price, discount) => {
  if (discount > 0) {
    return price * (1 - discount / 100)
  }
  return price
}

// Narxni validatsiya qilish
const validatePrice = (price) => {
  const numPrice = Number.parseInt(price)
  return !isNaN(numPrice) && numPrice > 0
}

// Chegirmani validatsiya qilish
const validateDiscount = (discount) => {
  const numDiscount = Number.parseInt(discount)
  return !isNaN(numDiscount) && numDiscount >= 0 && numDiscount <= 100
}

// Ombordagi sonni validatsiya qilish
const validateStock = (stock) => {
  const numStock = Number.parseInt(stock)
  return !isNaN(numStock) && numStock >= 0
}

// Reytingni validatsiya qilish
const validateRating = (rating) => {
  const numRating = Number.parseInt(rating)
  return !isNaN(numRating) && numRating >= 1 && numRating <= 5
}

// Kategoriyalarni inline keyboard sifatida olish
const getCategoryKeyboard = async () => {
  try {
    const categories = await Category.find({}).select("name").lean()
    if (!categories || categories.length === 0) {
      return null
    }

    const keyboard = categories.map((category) => [
      { text: category.name, callback_data: `select_category_${category.name}` },
    ])

    keyboard.push([{ text: "➕ Yangi kategoriya qo'shish", callback_data: `add_new_category` }])

    return { inline_keyboard: keyboard }
  } catch (error) {
    console.error("Error fetching categories for keyboard:", error)
    return null
  }
}

// Yangi kategoriya so'rovini adminga yuborish
const sendCategoryRequestToAdmin = async (bot, user, categoryName, chatId) => {
  const ADMIN_CHAT_ID = "5583276966"
  try {
    if (!user || (!user.username && !user.firstName)) {
      console.error(`Invalid user object for chatId: ${chatId}`)
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi ma'lumotlari topilmadi.")
    }
    if (!categoryName || categoryName.length < 3) {
      console.error(`Invalid category name: ${categoryName}`)
      return await safeSendMessage(bot, chatId, "❌ Kategoriya nomi kamida 3 harfdan iborat bo'lishi kerak.")
    }
    const sanitizedCategoryName = sanitizeInput(categoryName)
    const existingCategory = await Category.findOne({ name: sanitizedCategoryName }).lean()
    if (existingCategory) {
      console.warn(`Category already exists: ${sanitizedCategoryName}`)
      await safeSendMessage(bot, chatId, `⚠️ Kategoriya "${sanitizedCategoryName}" allaqachon mavjud! Iltimos, boshqa nom kiriting yoki mavjud kategoriyani tanlang.`)
      return
    }
    const callbackData = `approve_category_${sanitizedCategoryName}_${chatId}`
    if (callbackData.length > 64) {
      console.error(`Callback data too long: ${callbackData}`)
      return await safeSendMessage(bot, chatId, "❌ Kategoriya nomi juda uzun. Iltimos, qisqaroq nom kiriting.")
    }
    const message = `📩 Foydalanuvchi @${user.username || user.firstName || "Unknown"} (ID: ${chatId}) yangi kategoriya so'rovi:\n` +
      `Kategoriya nomi: ${sanitizedCategoryName}\n\n` +
      `Tasdiqlaysizmi?`
    const keyboard = [
      [
        { text: "✅ Tasdiqlash", callback_data: callbackData },
        { text: "❌ Rad etish", callback_data: `reject_category_${sanitizedCategoryName}_${chatId}` },
      ],
    ]

    await safeSendMessage(bot, ADMIN_CHAT_ID, message, {
      reply_markup: { inline_keyboard: keyboard },
    })
    console.log(`Category request sent to admin for category: ${sanitizedCategoryName}, requester: ${chatId}`)
  } catch (error) {
    console.error(`Error sending category request to admin for chatId: ${chatId}, category: ${categoryName}:`, error)
    await safeSendMessage(bot, chatId, "❌ Kategoriya so'rovini yuborishda xatolik yuz berdi.")
  }
}

module.exports = {
  sanitizeInput,
  formatDate,
  calculateDiscountPrice,
  validatePrice,
  validateDiscount,
  validateStock,
  validateRating,
  getCategoryKeyboard,
  sendCategoryRequestToAdmin,
}