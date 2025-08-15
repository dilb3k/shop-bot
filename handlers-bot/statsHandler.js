const User = require("../models/User")
const Product = require("../models/Product")
const Order = require("../models/Order")
const { safeSendMessage } = require("../services/botService")

const handleAdminStats = async (bot, msg) => {
  const chatId = msg.chat.id.toString()

  try {
    const admin = await User.findOne({ telegramId: chatId })

    if (!admin || admin.role !== "admin") {
      return await safeSendMessage(bot, chatId, "❌ Ruxsat yo'q")
    }

    const totalUsers = await User.countDocuments({ isActive: true })
    const totalProducts = await Product.countDocuments({ isActive: true })
    const totalOrders = await Order.countDocuments()

    const revenueResult = await Order.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ])

    const totalRevenue = revenueResult[0]?.total || 0

    const usersByRole = await User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ])

    const ordersByStatus = await Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])

    let message = "<b>📊 Statistika:</b>\n\n"
    message += `<i>👥 Jami foydalanuvchilar: ${totalUsers} ta</i>\n`
    message += `<i>📦 Jami mahsulotlar: ${totalProducts} ta</i>\n`
    message += `<i>📜 Jami buyurtmalar: ${totalOrders} ta</i>\n`
    message += `<i>💰 Umumiy daromad: ${totalRevenue.toLocaleString()} so'm</i>\n\n`

    message += "<b>👥 Foydalanuvchilar (rol bo'yicha):</b>\n"
    usersByRole.forEach((role) => {
      message += `<i>• ${role._id.toUpperCase()}: ${role.count} ta</i>\n`
    })

    message += "\n<b>📜 Buyurtmalar (status bo'yicha):</b>\n"
    ordersByStatus.forEach((status) => {
      message += `<i>• ${status._id.toUpperCase()}: ${status.count} ta</i>\n`
    })

    await safeSendMessage(bot, chatId, message)
  } catch (error) {
    console.error("Error in admin stats handler:", error)
    await safeSendMessage(bot, chatId, "❌ Statistikani olishda xatolik yuz berdi.")
  }
}

module.exports = {
  handleAdminStats,
}
