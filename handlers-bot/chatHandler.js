const User = require("../models/User")
const { safeSendMessage } = require("../services/botService")

const handleChat = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  try {
    const user = await User.findOne({ telegramId: chatId })

    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi. /start buyrug'ini bosing.")
    }

    let users, message

    if (user.role === "admin") {
      users = await User.find({ role: { $in: ["seller", "client"] }, isActive: true })
      message = "<b>💬 Kim bilan suhbatlashmoqchisiz?</b>"
    } else if (user.role === "client") {
      users = await User.find({ role: "seller", isActive: true })
      message = "<b>💬 Qaysi sotuvchi bilan suhbatlashmoqchisiz?</b>"
    } else {
      users = await User.find({ role: "client", isActive: true })
      message = "<b>💬 Qaysi mijoz bilan suhbatlashmoqchisiz?</b>"
    }

    if (!users.length) {
      return await safeSendMessage(bot, chatId, "😔 Suhbatlashish uchun foydalanuvchilar yo'q.")
    }

    const buttons = users.map((u) => [
      {
        text: `@${u.username || u.firstName} (${u.role.toUpperCase()})`,
        callback_data: `chat_with_${u.telegramId}`,
      },
    ])

    await safeSendMessage(bot, chatId, message, {
      reply_markup: { inline_keyboard: buttons },
    })
  } catch (error) {
    console.error("Error in chat handler:", error)
    await safeSendMessage(bot, chatId, "❌ Chat ro'yxatini olishda xatolik yuz berdi.")
  }
}

module.exports = {
  handleChat,
}
