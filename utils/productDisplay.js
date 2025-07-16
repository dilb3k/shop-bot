const { safeSendPhoto, safeSendMessage } = require("../services/botService")
const { sanitizeInput, calculateDiscountPrice } = require("./helpers")

const PRODUCTS_PER_MESSAGE = 4

const sendProductsGrid = async (bot, chatId, products, page, totalPages, type = "products", filterData = null) => {
  try {
    if (products.length === 0) {
      return await safeSendMessage(bot, chatId, "😔 Mahsulotlar topilmadi.")
    }

    // Send title
    let titleMessage = getGridTitle(type, filterData, page, totalPages)
    titleMessage += "═══════════════════════════════\n"
    await safeSendMessage(bot, chatId, titleMessage)

    // Group products into rows (2 products per row)
    const rows = []
    for (let i = 0; i < products.length; i += 2) {
      rows.push(products.slice(i, i + 2))
    }

    // Send each row as a message with 2 product cards
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      for (let j = 0; j < row.length; j++) {
        await sendProductWithImages(bot, chatId, row[j], (i * 2) + j + 1, type)
      }
    }

    // Send pagination and summary
    const keyboard = []
    if (totalPages > 1) {
      const paginationButtons = []
      if (page > 1) {
        paginationButtons.push({ text: "⬅️ Oldingi", callback_data: `products_page_${page - 1}` })
      }
      paginationButtons.push({ text: `📄 ${page}/${totalPages}`, callback_data: "current_page" })
      if (page < totalPages) {
        paginationButtons.push({ text: "Keyingi ➡️", callback_data: `products_page_${page + 1}` })
      }
      keyboard.push(paginationButtons)
    }

    const summaryMessage = `═══════════════════════════════\n📄 Sahifa: ${page}/${totalPages}`
    await safeSendMessage(bot, chatId, summaryMessage, {
      reply_markup: { inline_keyboard: keyboard },
    })
  } catch (error) {
    console.error("Error sending products grid:", error)
    await safeSendMessage(bot, chatId, "❌ Mahsulotlarni ko'rsatishda xatolik yuz berdi.")
  }
}

const sendProductWithImages = async (bot, chatId, product, index, type = "products", imageIndex = 0) => {
  try {
    const discountPrice = calculateDiscountPrice(product.price, product.discount)
    const stockEmoji = product.stock > 0 ? "✅" : "❌"

    // Get all images
    const images = product.images && product.images.length > 0 ? product.images : [product.image].filter(Boolean)
    const currentImage = images[imageIndex] || null

    // Prepare caption
    let caption = `<b>${index}. ${sanitizeInput(product.title)}</b>\n`
    if (product.discount > 0) {
      caption += `💰 <s>${product.price.toLocaleString()}</s> ➜ <b>${discountPrice.toLocaleString()} so'm</b> (-${product.discount}%)\n`
    } else {
      caption += `💰 <b>${discountPrice.toLocaleString()} so'm</b>\n`
    }
    caption += `📦 ${stockEmoji}`

    // Prepare buttons
    const keyboard = [
      [{ text: "📋 Batafsil", callback_data: `view_product_${product._id}` }],
    ]

    if (!currentImage) {
      caption += `\n📷 Rasm yo'q`
      await safeSendMessage(bot, chatId, caption, {
        reply_markup: { inline_keyboard: keyboard },
      })
    } else {
      await safeSendPhoto(bot, chatId, currentImage, caption, {
        reply_markup: { inline_keyboard: keyboard },
      })
    }
  } catch (error) {
    console.error("Error sending product with images:", error)
  }
}

const getGridTitle = (type, filterData, page, totalPages) => {
  switch (type) {
    case "products":
      return `<b>🛍️ MAHSULOTLAR (${page}/${totalPages})</b>\n`
    case "cart":
      return `<b>🛒 SAVATCHA (${page}/${totalPages})</b>\n`
    case "orders":
      return `<b>📜 BUYURTMA MAHSULOTLARI (${page}/${totalPages})</b>\n`
    case "filter":
      if (filterData) {
        const { filterType, filterValue } = filterData
        let title = "🗂️ FILTRLANGAN MAHSULOTLAR"
        switch (filterType) {
          case "category":
            title = `🗂️ ${filterValue.toUpperCase()}`
            break
          case "price":
            title = filterValue === "asc" ? "💸 ARZON MAHSULOTLAR" : "💰 QIMMAT MAHSULOTLAR"
            break
          case "rating":
            title = "⭐ ENG YAXSHI MAHSULOTLAR"
            break
          case "stock":
            title = "📦 MAVJUD MAHSULOTLAR"
            break
          case "discount":
            title = "🔥 CHEGIRMALI MAHSULOTLAR"
            break
          case "likes":
            title = "❤️ MASHHUR MAHSULOTLAR"
            break
        }
        return `<b>${title} (${page}/${totalPages})</b>\n`
      }
      return `<b>🗂️ FILTRLANGAN MAHSULOTLAR (${page}/${totalPages})</b>\n`
    default:
      return `<b>📦 MAHSULOTLAR (${page}/${totalPages})</b>\n`
  }
}

module.exports = {
  sendProductsGrid,
  sendProductWithImages,
  PRODUCTS_PER_MESSAGE,
}