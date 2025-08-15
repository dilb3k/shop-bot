const Product = require("../models/Product");
const User = require("../models/User");
const { safeSendMessage } = require("../services/botService");
const { sanitizeInput, getCategoryKeyboard } = require("../utils/helpers");
const stateManager = require("../services/stateManager");

const handleAddProduct = async (bot, msg) => {
  const chatId = msg.chat.id.toString();

  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user) {
      return await safeSendMessage(bot, chatId, "❌ User not found. Please use /start.");
    }

    if (!["seller", "admin"].includes(user.role.toLowerCase())) {
      return await safeSendMessage(bot, chatId, "❌ Only sellers or admins can add products.");
    }

    stateManager.setState("seller", chatId, { step: "title" });
    await safeSendMessage(bot, chatId, "📝 Enter product title (minimum 3 characters):");
  } catch (error) {
    console.error("Error in add product handler:", error);
    await safeSendMessage(bot, chatId, "❌ Error adding product.");
  }
};

const handleAddMoreImages = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  console.log(`Requesting more images for chatId: ${chatId}`);
  await bot.answerCallbackQuery(query.id, { text: "📷 Send more images" });
  await safeSendMessage(bot, chatId, "📷 Send more images:");
};

const handleAddToCart = async (bot, query, user) => {
  const productId = query.data.split("_")[1];
  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    console.error(`Product not found or inactive for ID: ${productId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Product not found" });
  }

  if (product.stock <= 0) {
    console.error(`Product out of stock for ID: ${productId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Product out of stock" });
  }

  if (!user.cart.includes(productId)) {
    user.cart.push(product._id);
    await user.save();
    console.log(`Added product ID: ${productId} to cart for user: ${user.telegramId}`);
    await bot.answerCallbackQuery(query.id, { text: `🛒 ${sanitizeInput(product.title)} added to cart!` });
    sendNotification(user.telegramId, `🛒 ${sanitizeInput(product.title)} added to cart!`);
  } else {
    console.warn(`Product ID: ${productId} already in cart for user: ${user.telegramId}`);
    await bot.answerCallbackQuery(query.id, { text: "⚠️ Product already in cart!" });
  }
};

const handleNewCategoryRequest = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  const sellerState = stateManager.getState("seller", chatId);
  const editState = stateManager.getState("editProduct", chatId);

  if (sellerState) {
    sellerState.step = "new_category_request";
    stateManager.setState("seller", chatId, sellerState);
  } else if (editState) {
    editState.step = "new_category_request";
    stateManager.setState("editProduct", chatId, editState);
  } else {
    return await bot.answerCallbackQuery(query.id, { text: "❌ Invalid state" });
  }

  await safeSendMessage(bot, chatId, "📝 Enter new category name:");
  await bot.answerCallbackQuery(query.id, { text: "➕ Adding new category" });
};

module.exports = {
  handleAddProduct,
  handleAddMoreImages,
  handleAddToCart,
  handleNewCategoryRequest,
};