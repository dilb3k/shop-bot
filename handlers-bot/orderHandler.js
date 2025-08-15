const Order = require("../models/Order")
const User = require("../models/User")
const { safeSendMessage } = require("../services/botService")
const { sanitizeInput, calculateDiscountPrice, formatDate } = require("../utils/helpers")
const { sendProductsGrid, PRODUCTS_PER_MESSAGE } = require("../utils/productDisplay")

const ORDERS_PER_PAGE = 5

const handleOrders = async (bot, msg) => {
  const chatId = msg.chat.id.toString()
  await showOrdersPage(bot, chatId, 1)
}

const showOrdersPage = async (bot, chatId, page = 1) => {
  try {
    const user = await User.findOne({ telegramId: chatId })

    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ Foydalanuvchi topilmadi. /start buyrug'ini bosing.")
    }

    let orders
    if (user.role === "seller" || user.role === "admin") {
      orders = await Order.find().populate("products").sort({ createdAt: -1 })
    } else {
      orders = await Order.find({ clientId: chatId }).populate("products").sort({ createdAt: -1 })
    }

    if (!orders.length) {
      return await safeSendMessage(bot, chatId, "😔 Buyurtmalar yo'q.")
    }

    const totalPages = Math.ceil(orders.length / ORDERS_PER_PAGE)
    const skip = (page - 1) * ORDERS_PER_PAGE
    const pageOrders = orders.slice(skip, skip + ORDERS_PER_PAGE)

    let message = `<b>📜 BUYURTMALAR (${page}/${totalPages})</b>\n`
    message += "═══════════════════════════════\n\n"

    const keyboard = []

    for (let i = 0; i < pageOrders.length; i++) {
      const order = pageOrders[i]
      const orderNumber = skip + i + 1

      message += `<b>${orderNumber}. Buyurtma #${order._id.toString().slice(-6)}</b>\n`
      message += `📊 ${getStatusEmoji(order.status)} ${order.status.toUpperCase()}\n`
      message += `🕒 ${formatDate(order.createdAt)}\n`
      message += `📦 ${order.products.length} ta mahsulot\n`
      message += `💰 ${order.totalPrice.toLocaleString()} so'm\n\n`

      // Add order button
      keyboard.push([
        {
          text: `📜 ${orderNumber}. Buyurtma #${order._id.toString().slice(-6)}`,
          callback_data: `view_order_${order._id}`,
        },
      ])
    }

    // Pagination buttons
    if (totalPages > 1) {
      const paginationButtons = []
      if (page > 1) {
        paginationButtons.push({ text: "⬅️ Oldingi", callback_data: `orders_page_${page - 1}` })
      }
      paginationButtons.push({ text: `📄 ${page}/${totalPages}`, callback_data: "current_page" })
      if (page < totalPages) {
        paginationButtons.push({ text: "Keyingi ➡️", callback_data: `orders_page_${page + 1}` })
      }
      keyboard.push(paginationButtons)
    }

    message += "═══════════════════════════════\n"
    message += `📄 Sahifa: ${page}/${totalPages} | 📜 Jami: ${orders.length} buyurtma`

    await safeSendMessage(bot, chatId, message, {
      reply_markup: { inline_keyboard: keyboard },
    })
  } catch (error) {
    console.error("Error in orders handler:", error)
    await safeSendMessage(bot, chatId, "❌ Buyurtmalarni olishda xatolik yuz berdi.")
  }
}

const showOrderProducts = async (bot, chatId, orderId, page = 1) => {
  try {
    const order = await Order.findById(orderId).populate("products")

    if (!order) {
      return await safeSendMessage(bot, chatId, "❌ Buyurtma topilmadi.")
    }

    // Send order info first
    const client = await User.findOne({ telegramId: order.clientId })
    let orderInfo = `<b>📜 Buyurtma #${order._id.toString().slice(-6)}</b>\n\n`
    orderInfo += `📊 Status: ${getStatusEmoji(order.status)} ${order.status.toUpperCase()}\n`
    orderInfo += `🕒 Sana: ${formatDate(order.createdAt)}\n`
    orderInfo += `👤 Mijoz: @${client?.username || client?.firstName || "Unknown"}\n`
    orderInfo += `📞 Telefon: ${client?.phone || "N/A"}\n`
    orderInfo += `💰 Jami: ${order.totalPrice.toLocaleString()} so'm\n`
    orderInfo += `📦 Mahsulotlar: ${order.products.length} ta`

    const keyboard = []
    const user = await User.findOne({ telegramId: chatId })

    if (user && (user.role === "seller" || user.role === "admin")) {
      if (order.status === "pending") {
        keyboard.push([{ text: "✅ Qabul qilish", callback_data: `order_process_${order._id}` }])
      }
      if (order.status === "processing") {
        keyboard.push([{ text: "✔️ Yakunlash", callback_data: `order_complete_${order._id}` }])
      }
      if (order.status !== "cancelled" && order.status !== "completed") {
        keyboard.push([{ text: "❌ Bekor qilish", callback_data: `order_cancel_${order._id}` }])
      }
    }

    await safeSendMessage(bot, chatId, orderInfo, {
      reply_markup: { inline_keyboard: keyboard },
    })

    // Send products with images using the grid system
    const totalPages = Math.ceil(order.products.length / PRODUCTS_PER_MESSAGE)
    const skip = (page - 1) * PRODUCTS_PER_MESSAGE
    const products = order.products.slice(skip, skip + PRODUCTS_PER_MESSAGE)

    await sendProductsGrid(bot, chatId, products, page, totalPages, "orders")
  } catch (error) {
    console.error("Error showing order products:", error)
    await safeSendMessage(bot, chatId, "❌ Buyurtma mahsulotlarini ko'rsatishda xatolik yuz berdi.")
  }
}

const getStatusEmoji = (status) => {
  switch (status) {
    case "pending":
      return "⏳"
    case "processing":
      return "🔄"
    case "completed":
      return "✅"
    case "cancelled":
      return "❌"
    default:
      return "📋"
  }
}

module.exports = {
  handleOrders,
  showOrdersPage,
  showOrderProducts,
}
