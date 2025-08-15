const Product = require("../models/Product");
const User = require("../models/User");
const { safeSendMessage, safeSendPhoto } = require("../services/botService");
const { sanitizeInput, formatDate, calculateDiscountPrice, getCategoryKeyboard } = require("../utils/helpers");
const stateManager = require("../services/stateManager");

const handleEditProducts = async (bot, msg) => {
  const chatId = msg.chat.id.toString();

  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ User not found. Please use /start.");
    }

    if (!["seller", "admin"].includes(user.role.toLowerCase())) {
      return await safeSendMessage(bot, chatId, "❌ Only sellers or admins can edit products.");
    }

    const products = await Product.find({
      sellerId: chatId,
      isActive: true,
    }).sort({ createdAt: -1 });

    if (products.length === 0) {
      return await safeSendMessage(bot, chatId, "😔 You have no products.");
    }

    for (const product of products) {
      const discountPrice = calculateDiscountPrice(product.price, product.discount);
      const stockStatus = product.stock > 0 ? `✅ ${product.stock} items` : "❌ Out of stock";

      let priceText = product.discount > 0
        ? `💰 <s>${product.price.toLocaleString()}</s> ➜ <b>${discountPrice.toLocaleString()} UZS</b> (-${product.discount}%)`
        : `💰 <b>${discountPrice.toLocaleString()} UZS</b>`;

      const message =
        `<b>📦 ${sanitizeInput(product.title)}</b>\n\n` +
        `${priceText}\n` +
        `🗂️ Category: ${sanitizeInput(product.category)}\n` +
        `📦 ${stockStatus}\n` +
        `⭐ ${product.rating.toFixed(1)} (${product.ratingCount} votes)\n` +
        `📅 Created: ${formatDate(product.createdAt)}`;

      const keyboard = [
        [{ text: "✏️ Edit", callback_data: `edit_menu_${product._id}` }],
        [{ text: "🗑 Delete", callback_data: `delete_${product._id}` }],
      ];

      const image = product.images && product.images.length > 0 ? product.images[0] : product.image;

      await safeSendPhoto(bot, chatId, image, message, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  } catch (error) {
    console.error("Error in edit products handler:", error);
    await safeSendMessage(bot, chatId, "❌ Error retrieving products.");
  }
};

const showEditMenu = async (bot, chatId, productId) => {
  try {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return await safeSendMessage(bot, chatId, "❌ Product not found.");
    }

    const message = `<b>✏️ Editing ${sanitizeInput(product.title)}</b>\n\nWhat would you like to edit?`;

    const keyboard = [
      [
        { text: "📝 Title", callback_data: `edit_title_${productId}` },
        { text: "💰 Price", callback_data: `edit_price_${productId}` },
      ],
      [
        { text: "🔥 Discount", callback_data: `edit_discount_${productId}` },
        { text: "📦 Stock", callback_data: `edit_stock_${productId}` },
      ],
      [
        { text: "🗂️ Category", callback_data: `edit_category_${productId}` },
        { text: "📝 Description", callback_data: `edit_description_${productId}` },
      ],
      [
        { text: "📷 Images", callback_data: `edit_images_${productId}` },
        { text: "❌ Cancel", callback_data: `cancel_edit_${productId}` },
      ],
    ];

    await safeSendMessage(bot, chatId, message, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    console.error("Error showing edit menu:", error);
    await safeSendMessage(bot, chatId, "❌ Error displaying edit menu.");
  }
};

const startEditField = async (bot, chatId, field, productId) => {
  try {
    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return await safeSendMessage(bot, chatId, "❌ Product not found.");
    }

    let message = "";
    let currentValue = "";

    switch (field) {
      case "title":
        message = "📝 Enter new title (minimum 3 characters):";
        currentValue = product.title;
        break;
      case "price":
        message = "💰 Enter new price (in UZS):";
        currentValue = product.price.toString();
        break;
      case "discount":
        message = "🔥 Enter new discount percentage (0-100):";
        currentValue = product.discount.toString();
        break;
      case "stock":
        message = "📦 Enter new stock quantity: ";
        currentValue = product.stock.toString();
        break;
      case "category":
        message = "🗂️ Select a category or create a new one:";
        currentValue = product.category;
        const categoryKeyboard = await getCategoryKeyboard();
        if (!categoryKeyboard) {
          return await safeSendMessage(bot, chatId, "❌ No categories found. Contact admin.");
        }
        categoryKeyboard.inline_keyboard.push([
          { text: "➕ New category", callback_data: `add_new_category` },
        ]);
        stateManager.setState("editProduct", chatId, {
          step: field,
          productId: productId,
        });
        return await safeSendMessage(bot, chatId, `${message}\n\n<i>Current value: ${currentValue}</i>`, {
          reply_markup: categoryKeyboard,
        });
      case "description":
        message = "📝 Enter new description:";
        currentValue = product.description || "";
        break;
      case "images":
        message = "📷 Send new images (multiple images allowed):";
        currentValue = `${product.images?.length || 0} images`;
        break;
      case "cancel":
        stateManager.clearState("editProduct", chatId);
        return await safeSendMessage(bot, chatId, "❌ Editing cancelled.");
      default:
        return await safeSendMessage(bot, chatId, "❌ Invalid edit field.");
    }

    stateManager.setState("editProduct", chatId, {
      step: field,
      productId: productId,
    });

    await safeSendMessage(bot, chatId, `${message}\n\n<i>Current value: ${currentValue}</i>`);
  } catch (error) {
    console.error("Error starting edit field:", error);
    await safeSendMessage(bot, chatId, "❌ Error starting edit.");
  }
};

module.exports = {
  handleEditProducts,
  showEditMenu,
  startEditField,
};