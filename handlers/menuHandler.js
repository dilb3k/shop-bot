const { safeSendMessage } = require("../services/botService")
const { formatDate } = require("../utils/helpers")

const showMainMenu = async (bot, chatId, user) => {
  const keyboard = [
    ["🛍 Mahsulotlar"],
    ["🛒 Savatcha", "📜 Buyurtmalar"],
    ["💬 Chat", "👤 Profil"],
  ]

  if (user.role === "seller") {
    keyboard.push(["➕ Mahsulot qo'shish", "✏️ Mahsulotlarni tahrirlash"])
  }

  if (user.role === "admin") {
    keyboard.push(["👥 Foydalanuvchilar ro'yxati", "📊 Statistika"])
  }

  const message =
    `<b>🎉 Assalomu alaykum, @${user.username || user.firstName}!</b>\n` +
    `<i>👤 Rol: ${user.role.toUpperCase()}</i>\n` +
    `<i>🌟 Reyting: ${user.rating.toFixed(1)} (${user.ratingCount} ovoz)</i>\n` +
    `<i>📞 Telefon: ${user.phone || "Kiritilmagan"}</i>\n` +
    `<i>📅 Ro'yxatdan o'tgan: ${formatDate(user.createdAt)}</i>`

  await safeSendMessage(bot, chatId, message, {
    reply_markup: {
      keyboard,
      resize_keyboard: true,
    },
  })
}

module.exports = {
  showMainMenu,
}
