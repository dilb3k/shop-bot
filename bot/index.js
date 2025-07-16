const TelegramBot = require("node-telegram-bot-api")
const { handleStart } = require("../handlers/startHandler")
const { handleContact } = require("../handlers/contactHandler")
const { handleProfile } = require("../handlers/profileHandler")
const { handleProducts } = require("../handlers/productHandler")
const { handleCart } = require("../handlers/cartHandler")
const { handleOrders } = require("../handlers/orderHandler")
const { handleChat } = require("../handlers/chatHandler")
const { handleAddProduct } = require("../handlers/addProductHandler")
const { handleEditProducts } = require("../handlers/editProductHandler")
const { handleAdminUsers } = require("../handlers/adminHandler")
const { handleAdminStats } = require("../handlers/statsHandler")
const { handleMessage } = require("../handlers/messageHandler")
const { handlePhoto } = require("../handlers/photoHandler")
const { handleCallbackQuery } = require("../handlers/callbackHandler")
const { safeSendMessage } = require("../services/botService")
const Conversation = require("../models/Conversation")
const stateManager = require("../services/stateManager")

const bot = new TelegramBot("7495734650:AAFskCJ6InjhqJ7EoMvY5wVQq9e87HFrTMQ", { polling: true })

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString()
  console.log(`Received /start from chatId: ${chatId}`)
  await Conversation.findOneAndUpdate(
    { chatId },
    { inAdminConversation: false },
    { upsert: true }
  )
  // Clear all states for the user
  stateManager.clearState("seller", chatId)
  stateManager.clearState("editProduct", chatId)
  stateManager.clearState("admin", chatId)
  await handleStart(bot, msg)
})

bot.on("contact", (msg) => handleContact(bot, msg))

bot.onText(/👤 Profil/, (msg) => handleProfile(bot, msg))
bot.onText(/🛍 Mahsulotlar/, (msg) => handleProducts(bot, msg))
bot.onText(/🛒 Savatcha/, (msg) => handleCart(bot, msg))
bot.onText(/📜 Buyurtmalar/, (msg) => handleOrders(bot, msg))
bot.onText(/💬 Chat/, (msg) => handleChat(bot, msg))
bot.onText(/➕ Mahsulot qo'shish/, (msg) => handleAddProduct(bot, msg))
bot.onText(/✏️ Mahsulotlarni tahrirlash/, (msg) => handleEditProducts(bot, msg))
bot.onText(/👥 Foydalanuvchilar ro'yxati/, (msg) => handleAdminUsers(bot, msg))
bot.onText(/📊 Statistika/, (msg) => handleAdminStats(bot, msg))

bot.on("message", async (msg) => {
  const chatId = msg.chat.id.toString()
  console.log(`Received message from chatId: ${chatId}, text: ${msg.text}, type: ${msg.text ? "text" : msg.photo ? "photo" : "other"}`)

  // Skip if the message is a command or handled by another handler
  if (msg.text && msg.text.startsWith("/")) {
    console.log(`Message '${msg.text}' is a command, handling via handleMessage for chatId: ${chatId}`)
    return handleMessage(bot, msg)
  }

  // Skip if the message is a contact or photo (handled by specific handlers)
  if (msg.contact || msg.photo) {
    console.log(`Message is a ${msg.contact ? "contact" : "photo"}, handling via handleMessage for chatId: ${chatId}`)
    return handleMessage(bot, msg)
  }

  // Define menu options to exclude
  const menuOptions = [
    "👤 Profil",
    "🛍 Mahsulotlar",
    "🛒 Savatcha",
    "📜 Buyurtmalar",
    "➕ Mahsulot qo'shish",
    "✏️ Mahsulotlarni tahrirlash",
    "👥 Foydalanuvchilar ro'yxati",
    "📊 Statistika",
    "💬 Chat"
  ]

  // Skip if the message matches a menu option
  if (msg.text && menuOptions.includes(msg.text)) {
    console.log(`Message '${msg.text}' is a menu option, skipping admin prompt for chatId: ${chatId}`)
    return handleMessage(bot, msg)
  }

  try {
    // Check admin state for category rejection reason
    const adminState = stateManager.getState("admin", chatId)
    if (adminState && adminState.step === "reject_reason") {
      const { categoryName, requesterChatId } = adminState
      await safeSendMessage(
        bot,
        requesterChatId,
        `❌ Kategoriya "${sanitizeInput(categoryName)}" rad etildi.\nSabab: ${sanitizeInput(msg.text)}`
      )
      stateManager.clearState("admin", chatId)
      await safeSendMessage(bot, chatId, "✅ Rad etish sababi yuborildi.")
      return
    }

    // Check user state for ongoing processes (e.g., product creation or editing)
    const sellerState = stateManager.getState("seller", chatId)
    const editState = stateManager.getState("editProduct", chatId)

    if (sellerState || editState) {
      console.log(`User in ${sellerState ? "product creation" : "product editing"} state, handling via handleMessage for chatId: ${chatId}`)
      return handleMessage(bot, msg)
    }

    // Check conversation state
    const conversation = await Conversation.findOne({ chatId }) || { inAdminConversation: false }

    if (conversation.inAdminConversation) {
      // Forward message to admin
      const adminMessage = `📩 Foydalanuvchi @${msg.from.username || msg.from.first_name || "Unknown"} (ID: ${chatId}): `
      const ADMIN_CHAT_ID = "5583276966"
      if (msg.text) {
        await safeSendMessage(bot, ADMIN_CHAT_ID, adminMessage + msg.text)
      } else {
        await safeSendMessage(bot, ADMIN_CHAT_ID, adminMessage + "[Unsupported message type]")
      }

      // Show end conversation prompt
      const keyboard = [
        [
          { text: "Ha", callback_data: `end_conversation_${chatId}` },
          { text: "Yo'q", callback_data: `continue_conversation_${chatId}` },
        ],
      ]
      await safeSendMessage(
        bot,
        chatId,
        "Suhbatni yakunlaysizmi?",
        {
          reply_markup: { inline_keyboard: keyboard },
        }
      )
      console.log(`Sent end conversation prompt to chatId: ${chatId}`)
    } else {
      // Show admin contact prompt for non-menu, non-command text
      const keyboard = [
        [
          { text: "Ha", callback_data: `contact_admin_${chatId}` },
          { text: "Yo'q", callback_data: `no_contact_${chatId}` },
        ],
      ]
      await safeSendMessage(
        bot,
        chatId,
        "Adminga murojaat qilasizmi?",
        {
          reply_markup: { inline_keyboard: keyboard },
        }
      )
      console.log(`Sent admin contact prompt to chatId: ${chatId}`)
    }
  } catch (error) {
    console.error(`Error handling message for chatId: ${chatId}:`, error)
    await safeSendMessage(bot, chatId, "❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.")
  }
})

bot.on("photo", (msg) => handlePhoto(bot, msg))

bot.on("callback_query", async (query) => {
  console.log(`Processing callback query: ${query.data}`)
  await handleCallbackQuery(bot, query)
})

bot.on("polling_error", (error) => {
  console.error("Polling error:", error)
})

module.exports = bot