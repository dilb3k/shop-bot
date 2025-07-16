const User = require("../models/User")
const { safeSendMessage } = require("../services/botService")
const { formatDate, sanitizeInput } = require("../utils/helpers")

const handleProfile = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  try {
    const user = await User.findOne({ telegramId: chatId }).populate("cart")

    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi. /start buyrug'ini bosing.")
    }

    const cartSummary = user.cart.length
      ? `🛒 Savatchada: ${user.cart.length} mahsulot\n` +
        user.cart.map((p, i) => `  ${i + 1}. ${sanitizeInput(p.title)} - ${p.price.toLocaleString()} so'm`).join("\n")
      : "🛒 Savatcha bo'sh"

    const message =
      `<b>👤 Profil</b>\n` +
      `<i>👤 Ism: @${user.username || user.firstName}</i>\n` +
      `<i>📞 Telefon: ${user.phone || "Kiritilmagan"}</i>\n` +
      `<i>🌟 Reyting: ${user.rating.toFixed(1)} (${user.ratingCount} ovoz)</i>\n` +
      `<i>🎭 Rol: ${user.role.toUpperCase()}</i>\n` +
      `<i>📅 Ro'yxatdan o'tgan: ${formatDate(user.createdAt)}</i>\n` +
      `<i>${cartSummary}</i>`

    await safeSendMessage(bot, chatId, message)
  } catch (error) {
    console.error("Error in profile handler:", error)
    await safeSendMessage(bot, chatId, "❌ Profil ma'lumotlarini olishda xatolik yuz berdi.")
  }
}

module.exports = {
  handleProfile,
}
