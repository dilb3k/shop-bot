const User = require("../models/User")
const { checkAdmin } = require("../utils/admin")
const { safeSendMessage } = require("../services/botService")
const stateManager = require("../services/stateManager")
const { showMainMenu } = require("./menuHandler")

const handleContact = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  if (!stateManager.getState("contact", chatId)) return

  const phone = msg.contact.phone_number
  const username = msg.from.username
  const firstName = msg.from.first_name
  const cleanPhone = phone.replace(/\D/g, "")
  const role = checkAdmin(username, phone) ? "admin" : "client"

  try {
    let user = await User.findOne({ telegramId: chatId })

    if (!user) {
      user = await User.create({
        telegramId: chatId,
        username,
        firstName,
        phone: cleanPhone,
        role,
      })
    } else {
      user.phone = cleanPhone
      user.role = role
      user.username = username
      user.firstName = firstName
      await user.save()
    }

    stateManager.clearState("contact", chatId)

    await safeSendMessage(
      bot,
      chatId,
      `🎉 Tabriklaymiz! Siz <b>${role === "admin" ? "admin" : "foydalanuvchi"}</b> sifatida ro'yxatdan o'tdingiz.`,
      { reply_markup: { remove_keyboard: true } },
    )

    await showMainMenu(bot, chatId, user)
  } catch (error) {
    console.error("Error in contact handler:", error)

    if (error.code === 11000) {
      await safeSendMessage(bot, chatId, "❌ Bu telefon raqami allaqachon ro'yxatdan o'tgan.")
    } else {
      await safeSendMessage(bot, chatId, "❌ Ro'yxatdan o'tishda xatolik yuz berdi.")
    }
  }
}

module.exports = {
  handleContact,
}
