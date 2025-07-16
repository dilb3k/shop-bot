const User = require("../models/User")
const { checkAdmin } = require("../utils/admin")
const { safeSendMessage } = require("../services/botService")
const stateManager = require("../services/stateManager")
const { showMainMenu } = require("./menuHandler")

const handleStart = async (bot, msg) => {
  const chatId = msg.chat.id.toString()
  const username = msg.from.username
  const firstName = msg.from.first_name

  try {
    const user = await User.findOne({ telegramId: chatId })

    if (!user) {
      stateManager.setState("contact", chatId, { step: "awaiting_contact" })

      await safeSendMessage(
        bot,
        chatId,
        "📞 Iltimos, telefon raqamingizni yuboring (admin huquqlarini tekshirish uchun):",
        {
          reply_markup: {
            keyboard: [
              [
                {
                  text: "📱 Telefon raqamni yuborish",
                  request_contact: true,
                },
              ],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      )
      return
    }

    // Update admin role if needed
    if (username && checkAdmin(username, user.phone)) {
      user.role = "admin"
      await user.save()
    }

    await showMainMenu(bot, chatId, user)
  } catch (error) {
    console.error("Error in start handler:", error)
    await safeSendMessage(bot, chatId, "❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.")
  }
}

module.exports = {
  handleStart,
}
