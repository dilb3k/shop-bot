const User = require("../models/User")
const { safeSendMessage } = require("../services/botService")
const { formatDate } = require("../utils/helpers")

const USERS_PER_MESSAGE = 4

const handleAdminUsers = async (bot, msg) => {
  const chatId = msg.chat.id.toString()
  await showUsersPage(bot, chatId, 1)
}

const showUsersPage = async (bot, chatId, page = 1) => {
  try {
    const admin = await User.findOne({ telegramId: chatId })

    if (!admin || admin.role !== "admin") {
      return await safeSendMessage(bot, chatId, "❌ Ruxsat yo'q")
    }

    const users = await User.find({ isActive: true }).sort({ createdAt: -1 })

    if (!users.length) {
      return await safeSendMessage(bot, chatId, "😔 Foydalanuvchilar yo'q.")
    }

    const totalPages = Math.ceil(users.length / USERS_PER_MESSAGE)
    const skip = (page - 1) * USERS_PER_MESSAGE
    const pageUsers = users.slice(skip, skip + USERS_PER_MESSAGE)

    let message = `<b>👥 FOYDALANUVCHILAR (${page}/${totalPages})</b>\n`
    message += "═══════════════════════════════\n\n"

    const keyboard = []

    for (let i = 0; i < pageUsers.length; i++) {
      const user = pageUsers[i]
      const userNumber = skip + i + 1
      const roleEmoji = getRoleEmoji(user.role)

      message += `<b>${userNumber}. ${roleEmoji} @${user.username || user.firstName || "Unknown"}</b>\n`
      message += `📞 ${user.phone || "N/A"}\n`
      message += `⭐ ${user.rating.toFixed(1)} (${user.ratingCount} ovoz)\n`
      message += `🛒 ${user.cart.length} mahsulot | 📅 ${formatDate(user.createdAt)}\n\n`

      // Add user management buttons
      const userButtons = [
        {
          text: `👤 ${userNumber}. @${user.username || user.firstName}`,
          callback_data: `user_info_${user.telegramId}`,
        },
      ]

      if (user.role !== "admin") {
        userButtons.push({ text: "👑", callback_data: `role_admin_${user.telegramId}` })
      }
      if (user.role !== "seller") {
        userButtons.push({ text: "🏪", callback_data: `role_seller_${user.telegramId}` })
      }
      if (user.role !== "client") {
        userButtons.push({ text: "👤", callback_data: `role_client_${user.telegramId}` })
      }

      keyboard.push(userButtons)
    }

    // Pagination buttons
    if (totalPages > 1) {
      const paginationButtons = []
      if (page > 1) {
        paginationButtons.push({ text: "⬅️ Oldingi", callback_data: `users_page_${page - 1}` })
      }
      paginationButtons.push({ text: `📄 ${page}/${totalPages}`, callback_data: "current_page" })
      if (page < totalPages) {
        paginationButtons.push({ text: "Keyingi ➡️", callback_data: `users_page_${page + 1}` })
      }
      keyboard.push(paginationButtons)
    }

    message += "═══════════════════════════════\n"

    // Statistics
    const stats = {
      admin: users.filter((u) => u.role === "admin").length,
      seller: users.filter((u) => u.role === "seller").length,
      client: users.filter((u) => u.role === "client").length,
    }

    message += `📊 Jami: ${users.length} | 👑 ${stats.admin} | 🏪 ${stats.seller} | 👤 ${stats.client}\n`
    message += `📄 Sahifa: ${page}/${totalPages}`

    await safeSendMessage(bot, chatId, message, {
      reply_markup: { inline_keyboard: keyboard },
    })
  } catch (error) {
    console.error("Error in admin users handler:", error)
    await safeSendMessage(bot, chatId, "❌ Foydalanuvchilar ro'yxatini olishda xatolik yuz berdi.")
  }
}

const getRoleEmoji = (role) => {
  switch (role) {
    case "admin":
      return "👑"
    case "seller":
      return "🏪"
    case "client":
      return "👤"
    default:
      return "❓"
  }
}

module.exports = {
  handleAdminUsers,
  showUsersPage,
}
