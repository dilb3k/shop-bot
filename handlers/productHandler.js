const Product = require("../models/Product")
const User = require("../models/User")
const { safeSendPhoto, safeSendMessage } = require("../services/botService")
const { sanitizeInput, formatDate, calculateDiscountPrice } = require("../utils/helpers")
const { sendProductsGrid, PRODUCTS_PER_MESSAGE } = require("../utils/productDisplay")

const handleProducts = async (bot, msg) => {
  const chatId = msg.chat.id.toString()
  console.log(`Handling products redirect for chatId: ${chatId}`)
  try {
    // Redirect to website instead of showing products
    const websiteUrl = "https://your-website.com/products" // Replace with your actual website URL
    await safeSendMessage(
      bot,
      chatId,
      `🛍 Mahsulotlar bu yerda: ${websiteUrl}\nIltimos, mahsulotlarni ko'rish uchun saytga o'ting.`,
    )
  } catch (error) {
    console.error(`Error in handleProducts for chatId: ${chatId}:`, error)
    await safeSendMessage(bot, chatId, "❌ Saytga yo'naltirishda xatolik yuz berdi.")
  }
}

const showProductsPage = async (bot, chatId, page = 1) => {
  try {
    console.log(`showProductsPage called for chatId: ${chatId}, page: ${page}`)
    const skip = (page - 1) * PRODUCTS_PER_MESSAGE
    const products = await Product.find({ isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(PRODUCTS_PER_MESSAGE)

    const totalProducts = await Product.countDocuments({ isActive: true })
    const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_MESSAGE)
    console.log(`Fetched ${products.length} products for page ${page}, total pages: ${totalPages}`)

    await sendProductsGrid(bot, chatId, products, page, totalPages, "products")
  } catch (error) {
    console.error(`Error in showProductsPage for chatId: ${chatId}, page: ${page}:`, error)
    await safeSendMessage(bot, chatId, "❌ Mahsulotlarni olishda xatolik yuz berdi.")
  }
}

const sendDetailedProduct = async (bot, chatId, productId, imageIndex = 0, messageId = null) => {
  try {
    console.log(`Attempting to send detailed product for ID: ${productId}, chatId: ${chatId}, messageId: ${messageId}, imageIndex: ${imageIndex}`)
    const product = await Product.findById(productId)
    if (!product || !product.isActive) {
      console.error(`Product not found or inactive for ID: ${productId}`)
      return await safeSendMessage(bot, chatId, "❌ Mahsulot topilmadi.")
    }

    const seller = await User.findOne({ telegramId: product.sellerId })
    if (!seller) {
      console.warn(`Seller not found for telegramId: ${product.sellerId}`)
    }

    const discountPrice = calculateDiscountPrice(product.price, product.discount)
    const stockStatus = product.stock > 0 ? `✅ ${product.stock} dona` : "❌ Omborda yo'q"

    let priceText = ""
    if (product.discount > 0) {
      priceText =
        `💰 Narx: <s>${product.price.toLocaleString()} so'm</s> ➜ <b>${discountPrice.toLocaleString()} so'm</b>\n` +
        `🔥 Chegirma: <b>-${product.discount}%</b> (${(product.price - discountPrice).toLocaleString()} so'm tejash!)`
    } else {
      priceText = `💰 Narx: <b>${discountPrice.toLocaleString()} so'm</b>`
    }

    const images = product.images && product.images.length > 0 ? product.images : [product.image].filter(Boolean)
    const currentImageIndex = Math.max(0, Math.min(imageIndex, images.length - 1))
    const currentImage = images[currentImageIndex] || null
    console.log(`Product images: ${images.length}, current image index: ${currentImageIndex}`)

    let caption =
      `<b>📦 ${sanitizeInput(product.title)}</b>\n\n` +
      `${priceText}\n\n` +
      `🗂️ Kategoriya: ${sanitizeInput(product.category)}\n` +
      `📦 Omborda: ${stockStatus}\n` +
      `⭐ Reyting: ${product.rating.toFixed(1)} (${product.ratingCount} ovoz)\n` +
      `❤️ Layklar: ${product.likes.length}\n` +
      `💬 Izohlar: ${product.comments.length}\n\n` +
      `📝 Tavsif:\n${sanitizeInput(product.description || "Tavsif yo'q")}\n\n` +
      `👤 Sotuvchi: @${seller?.username || "Unknown"} (⭐${seller?.rating.toFixed(1) || "0.0"})\n` +
      `📅 Yaratilgan: ${formatDate(product.createdAt)}`

    if (images.length > 1) {
      caption += `\n📷 Rasm ${currentImageIndex + 1}/${images.length}`
    }

    const keyboard = []
    if (images.length > 1) {
      const imageButtons = []
      if (currentImageIndex > 0) {
        imageButtons.push({
          text: "◀️ Oldingi rasm",
          callback_data: `image_prev_detail_${product._id}_${currentImageIndex - 1}`,
        })
      }
      if (currentImageIndex < images.length - 1) {
        imageButtons.push({
          text: "Keyingi rasm ▶️",
          callback_data: `image_next_detail_${product._id}_${currentImageIndex + 1}`,
        })
      }
      keyboard.push(imageButtons)
    }

    keyboard.push([
      { text: "🛒 Savatchaga qo'shish", callback_data: `add_${product._id}` },
      { text: `❤️ Like (${product.likes.length})`, callback_data: `like_${product._id}` },
    ])
    keyboard.push([
      { text: "⭐ Reyting berish", callback_data: `rate_product_${product._id}` },
      { text: `💬 Izohlar (${product.comments.length})`, callback_data: `view_comments_${product._id}_1` },
    ])
    keyboard.push([
      { text: "📩 Sotuvchiga xabar", callback_data: `chat_product_${product._id}` },
      { text: "🔙 Orqaga", callback_data: `products_page_1` },
    ])

    if (messageId) {
      try {
        await bot.editMessageMedia(
          {
            type: "photo",
            media: currentImage || "https://via.placeholder.com/150",
            caption,
            parse_mode: "HTML",
          },
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard: keyboard },
          }
        )
        console.log(`Successfully edited message for product ID: ${productId}`)
      } catch (editError) {
        console.error(`Error editing message media for product ID: ${productId}, messageId: ${messageId}:`, editError)
        await safeSendPhoto(bot, chatId, currentImage || "https://via.placeholder.com/150", caption, {
          reply_markup: { inline_keyboard: keyboard },
        })
      }
    } else {
      await safeSendPhoto(bot, chatId, currentImage || "https://via.placeholder.com/150", caption, {
        reply_markup: { inline_keyboard: keyboard },
      })
      console.log(`Successfully sent new message for product ID: ${productId}`)
    }
  } catch (error) {
    console.error(`Error in sendDetailedProduct for product ID: ${productId}, chatId: ${chatId}:`, error)
    await safeSendMessage(bot, chatId, "❌ Mahsulot ma'lumotlarini olishda xatolik yuz berdi.")
  }
}

module.exports = {
  handleProducts,
  showProductsPage,
  sendDetailedProduct,
}