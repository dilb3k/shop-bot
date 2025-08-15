const User = require("../models/User")
const { safeSendMessage } = require("../services/botService")
const { calculateDiscountPrice } = require("../utils/helpers")
const { sendProductsGrid, PRODUCTS_PER_MESSAGE } = require("../utils/productDisplay")

const handleCart = async (bot, msg) => {
  const chatId = msg.chat.id.toString()
  await showCartPage(bot, chatId, 1)
}

const showCartPage = async (bot, chatId, page = 1) => {
  try {
    const user = await User.findOne({ telegramId: chatId }).populate("cart")

    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi. /start buyrug'ini bosing.")
    }

    if (!user.cart.length) {
      return await safeSendMessage(bot, chatId, "🛒 Savatchangiz bo'sh.")
    }

    const totalPages = Math.ceil(user.cart.length / PRODUCTS_PER_MESSAGE)
    const skip = (page - 1) * PRODUCTS_PER_MESSAGE
    const products = user.cart.slice(skip, skip + PRODUCTS_PER_MESSAGE)

    // Send products grid
    await sendProductsGrid(bot, chatId, products, page, totalPages, "cart")

    // Send summary
    let total = 0
    let originalTotal = 0

    for (const product of user.cart) {
      const originalPrice = product.price
      const discountPrice = calculateDiscountPrice(product.price, product.discount)
      total += discountPrice
      originalTotal += originalPrice
    }

    let summaryMessage = `<b>💰 SAVATCHA XULOSASI</b>\n\n`

    if (originalTotal > total) {
      summaryMessage += `💰 Umumiy: <s>${originalTotal.toLocaleString()}</s> ➜ <b>${total.toLocaleString()} so'm</b>\n`
      summaryMessage += `💸 Tejash: <b>${(originalTotal - total).toLocaleString()} so'm</b>\n`
    } else {
      summaryMessage += `💰 <b>Jami: ${total.toLocaleString()} so'm</b>\n`
    }

    summaryMessage += `📦 Jami mahsulotlar: ${user.cart.length} ta`

    await safeSendMessage(bot, chatId, summaryMessage)
  } catch (error) {
    console.error("Error in cart handler:", error)
    await safeSendMessage(bot, chatId, "❌ Savatchani olishda xatolik yuz berdi.")
  }
}

module.exports = {
  handleCart,
  showCartPage,
}
