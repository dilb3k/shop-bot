const User = require("../models/User")
const { safeSendMessage } = require("../services/botService")
const stateManager = require("../services/stateManager")

const handleAddProduct = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  try {
    const user = await User.findOne({ telegramId: chatId })

    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi. /start buyrug'ini bosing.")
    }

    if (user.role !== "seller" && user.role !== "admin") {
      return await safeSendMessage(bot, chatId, "❌ Faqat sotuvchilar mahsulot qo'shishi mumkin.")
    }

    stateManager.setState("seller", chatId, { step: "title" })

    await safeSendMessage(bot, chatId, "📝 Mahsulot nomini kiriting (kamida 3 harf):")
  } catch (error) {
    console.error("Error in add product handler:", error)
    await safeSendMessage(bot, chatId, "❌ Mahsulot qo'shishda xatolik yuz berdi.")
  }
}

module.exports = {
  handleAddProduct,
}
