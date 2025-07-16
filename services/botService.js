const safeSendMessage = async (bot, chatId, message, options = {}) => {
  try {
    await bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      ...options,
    })
  } catch (error) {
    console.error(`Error sending message to ${chatId}:`, error.message)
  }
}

const safeSendPhoto = async (bot, chatId, photo, caption, options = {}) => {
  try {
    await bot.sendPhoto(chatId, photo, {
      caption,
      parse_mode: "HTML",
      ...options,
    })
  } catch (error) {
    console.error(`Error sending photo to ${chatId}:`, error.message)
  }
}

const sendNotification = (toId, message) => {
  if (global.io) {
    global.io.emit("notification", { to: toId, message })
  }
}

module.exports = {
  safeSendMessage,
  safeSendPhoto,
  sendNotification,
}
