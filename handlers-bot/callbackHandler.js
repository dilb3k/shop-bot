const Product = require("../models/Product");
const User = require("../models/User");
const Order = require("../models/Order");
const Conversation = require("../models/Conversation");
const Category = require("../models/Category");
const { safeSendMessage, sendNotification } = require("../services/botService");
const { showCartPage } = require("./cartHandler");
const { showOrdersPage, showOrderProducts } = require("./orderHandler");
const { showUsersPage } = require("./adminHandler");
const { showEditMenu, startEditField } = require("./editProductHandler");
const { createProductWithImages } = require("./photoHandler");
const { sendDetailedProduct, showProductsPage } = require("./productHandler");
const { handleStart } = require("./startHandler");
const { sanitizeInput, calculateDiscountPrice, getCategoryKeyboard } = require("../utils/helpers");
const stateManager = require("../services/stateManager");

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || "5583276966";

const handleCallbackQuery = async (bot, query) => {
  const chatId = query.message.chat.id.toString();
  const messageId = query.message.message_id;
  const data = query.data.split("_");
  const action = data[0];

  console.log(`Received callback query: ${query.data}, chatId: ${chatId}, messageId: ${messageId}`);

  try {
    const user = await User.findOne({ telegramId: chatId });
    if (!user) {
      console.error(`User not found for telegramId: ${chatId}`);
      return await bot.answerCallbackQuery(query.id, { text: "❌ User not found" });
    }

    switch (action) {
      case "contact":
        if (data[1] === "admin") {
          await handleContactAdmin(bot, query, user);
        }
        break;

      case "no":
        if (data[1] === "contact") {
          await handleNoContact(bot, query, user);
        }
        break;

      case "end":
        if (data[1] === "conversation") {
          await handleEndConversation(bot, query, user);
        }
        break;

      case "continue":
        if (data[1] === "conversation") {
          await handleContinueConversation(bot, query);
        }
        break;

      case "create":
        if (data[1] === "product" && data[2] === "now") {
          await handleCreateProductNow(bot, query, user);
        }
        break;

      case "image":
        if (data[1] === "prev" && data[2] === "detail") {
          await handleImageNavigation(bot, chatId, messageId, data[3], Number.parseInt(data[4]), "prev");
        } else if (data[1] === "next" && data[2] === "detail") {
          await handleImageNavigation(bot, chatId, messageId, data[3], Number.parseInt(data[4]), "next");
        }
        break;

      case "view":
        if (data[1] === "product") {
          await handleViewProduct(bot, chatId, data[2]);
        } else if (data[1] === "order") {
          await showOrderProducts(bot, chatId, data[2], 1);
          await bot.answerCallbackQuery(query.id, { text: "📜 Order products opened" });
        }
        break;

      case "products":
        if (data[1] === "page") {
          await showProductsPage(bot, chatId, Number.parseInt(data[2]) || 1);
          await bot.answerCallbackQuery(query.id, { text: "📄 Page changed" });
        }
        break;

      case "cart":
        if (data[1] === "page") {
          await showCartPage(bot, chatId, Number.parseInt(data[2]) || 1);
          await bot.answerCallbackQuery(query.id, { text: "🛒 Cart page opened" });
        }
        break;

      case "orders":
        if (data[1] === "page") {
          await showOrdersPage(bot, chatId, Number.parseInt(data[2]) || 1);
          await bot.answerCallbackQuery(query.id, { text: "📜 Orders page opened" });
        }
        break;

      case "users":
        if (data[1] === "page") {
          await showUsersPage(bot, chatId, Number.parseInt(data[2]) || 1);
          await bot.answerCallbackQuery(query.id, { text: "👥 Users page opened" });
        }
        break;

      case "remove":
        if (data[1] === "cart") {
          await handleRemoveFromCart(bot, query, user);
        }
        break;

      case "like":
        await handleLike(bot, query, user);
        break;

      case "edit":
        if (data[1] === "menu") {
          await showEditMenu(bot, chatId, data[2]);
          await bot.answerCallbackQuery(query.id, { text: "✏️ Edit menu opened" });
        } else {
          await startEditField(bot, chatId, data[1], data[2]);
          await bot.answerCallbackQuery(query.id, { text: "✏️ Editing started" });
        }
        break;

      case "delete":
        await handleDeleteProduct(bot, query, user);
        break;

      case "checkout":
        await handleCheckout(bot, query, user);
        break;

      case "clear":
        if (data[1] === "cart") {
          await handleClearCart(bot, query, user);
        }
        break;

      case "role":
        await handleRoleChange(bot, query, user);
        break;

      case "order":
        if (["process", "complete", "cancel"].includes(data[1])) {
          await handleOrderStatusChange(bot, query, user, data[2], data[1]);
        }
        break;

      case "current":
        if (data[1] === "page") {
          await bot.answerCallbackQuery(query.id, { text: "📄 Current page" });
        }
        break;

      case "select":
        if (data[1] === "category") {
          await handleCategorySelection(bot, chatId, data.slice(2).join("_"), user);
        }
        break;

      case "confirm":
        if (data[1] === "new" && data[2] === "category") {
          await handleConfirmNewCategory(bot, query, user);
        }
        break;

      case "cancel":
        if (data[1] === "new" && data[2] === "category") {
          await handleCancelNewCategory(bot, chatId);
        }
        break;

      case "approve":
        if (data[1] === "category") {
          await handleApproveCategory(bot, query, user);
        }
        break;

      case "reject":
        if (data[1] === "category") {
          await handleRejectCategory(bot, query, user);
        }
        break;

      default:
        console.error(`Unknown callback action: ${action}, full data: ${query.data}`);
        await bot.answerCallbackQuery(query.id, { text: "❌ Unknown command" });
    }
  } catch (error) {
    console.error(`Error in handleCallbackQuery for chatId: ${chatId}, query: ${query.data}:`, error);
    await bot.answerCallbackQuery(query.id, { text: "❌ An error occurred" });
  }
};

const handleContactAdmin = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  console.log(`User ${chatId} requested to contact admin`);
  await safeSendMessage(
    bot,
    ADMIN_CHAT_ID,
    `📩 User @${user.username || user.firstName || "Unknown"} (ID: ${chatId}) wants to contact admin.`
  );
  await Conversation.findOneAndUpdate(
    { chatId },
    { inAdminConversation: true },
    { upsert: true }
  );
  const keyboard = [
    [
      { text: "Yes", callback_data: `end_conversation_${chatId}` },
      { text: "No", callback_data: `continue_conversation_${chatId}` },
    ],
  ];
  await safeSendMessage(
    bot,
    chatId,
    "Would you like to end the conversation?",
    { reply_markup: { inline_keyboard: keyboard } }
  );
  await bot.answerCallbackQuery(query.id);
  console.log(`Set admin conversation state for chatId: ${chatId}`);
};

const handleNoContact = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  console.log(`User ${chatId} declined to contact admin`);
  await Conversation.findOneAndUpdate(
    { chatId },
    { inAdminConversation: false },
    { upsert: true }
  );
  await handleStart(bot, { chat: { id: chatId }, from: { id: chatId, username: user.username, first_name: user.firstName } });
  await bot.answerCallbackQuery(query.id, { text: "🔙 Returned to menu" });
  console.log(`Cleared admin conversation state for chatId: ${chatId}`);
};

const handleEndConversation = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  console.log(`User ${chatId} ended admin conversation`);
  await Conversation.findOneAndUpdate(
    { chatId },
    { inAdminConversation: false },
    { upsert: true }
  );
  await handleStart(bot, { chat: { id: chatId }, from: { id: chatId, username: user.username, first_name: user.firstName } });
  await bot.answerCallbackQuery(query.id, { text: "✅ Conversation ended" });
  console.log(`Cleared admin conversation state and showed main menu for chatId: ${chatId}`);
};

const handleContinueConversation = async (bot, query) => {
  const chatId = query.message.chat.id.toString();
  console.log(`User ${chatId} continued admin conversation`);
  await safeSendMessage(bot, chatId, "📩 Send your message, admin will respond.");
  await bot.answerCallbackQuery(query.id, { text: "📝 Continue sending message" });
};

const handleCreateProductNow = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  const sellerState = stateManager.getState("seller", chatId);

  if (!sellerState || !sellerState.images || sellerState.images.length === 0) {
    console.error(`No images found for product creation, chatId: ${chatId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ No images found" });
  }

  try {
    await createProductWithImages(bot, chatId, sellerState);
    stateManager.clearState("seller", chatId);
    await bot.answerCallbackQuery(query.id, { text: "✅ Product created!" });
  } catch (error) {
    console.error(`Error creating product for chatId: ${chatId}:`, error);
    await bot.answerCallbackQuery(query.id, { text: "❌ Failed to create product" });
  }
};

const handleImageNavigation = async (bot, chatId, messageId, productId, index, direction) => {
  console.log(`Navigating to ${direction} image for product ID: ${productId}, index: ${index}`);
  await sendDetailedProduct(bot, chatId, productId, index, messageId);
  await bot.answerCallbackQuery(query.id, { text: direction === "prev" ? "◀️ Previous image" : "▶️ Next image" });
};

const handleViewProduct = async (bot, chatId, productId) => {
  console.log(`Viewing detailed product for ID: ${productId}`);
  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    console.error(`Product not found or inactive for ID: ${productId}`);
    await safeSendMessage(bot, chatId, "❌ Product not found or unavailable.");
    return await bot.answerCallbackQuery(query.id, { text: "❌ Product not found" });
  }
  await sendDetailedProduct(bot, chatId, productId);
  await bot.answerCallbackQuery(query.id, { text: "📋 Product details opened" });
};

const handleRemoveFromCart = async (bot, query, user) => {
  const productId = query.data.split("_")[2];
  user.cart = user.cart.filter((id) => id.toString() !== productId);
  await user.save();
  console.log(`Removed product ID: ${productId} from cart for user: ${user.telegramId}`);
  await bot.answerCallbackQuery(query.id, { text: "🗑️ Product removed from cart" });
  await showCartPage(bot, query.message.chat.id, 1);
};

const handleLike = async (bot, query, user) => {
  const productId = query.data.split("_")[1];
  const product = await Product.findById(productId);

  if (!product || !product.isActive) {
    console.error(`Product not found or inactive for ID: ${productId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Product not found" });
  }

  if (product.likes.includes(user.telegramId)) {
    product.likes = product.likes.filter((like) => like !== user.telegramId);
    console.log(`Removed like for product ID: ${productId} by user: ${user.telegramId}`);
    await bot.answerCallbackQuery(query.id, { text: "💔 Like removed" });
  } else {
    product.likes.push(user.telegramId);
    console.log(`Added like for product ID: ${productId} by user: ${user.telegramId}`);
    await bot.answerCallbackQuery(query.id, { text: "❤️ Liked!" });
  }

  await product.save();
};

const handleDeleteProduct = async (bot, query, user) => {
  const productId = query.data.split("_")[1];
  const product = await Product.findById(productId);

  if (!product || (product.sellerId !== user.telegramId && user.role !== "admin")) {
    console.error(`Permission denied or product not found for ID: ${productId}, user: ${user.telegramId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Permission denied or product not found" });
  }

  product.isActive = false;
  await product.save();
  console.log(`Deleted product ID: ${productId} by user: ${user.telegramId}`);
  await bot.answerCallbackQuery(query.id, { text: "🗑 Product deleted" });
  sendNotification(user.telegramId, `🗑 ${sanitizeInput(product.title)} deleted!`);
};

const handleCheckout = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  if (!user.cart.length) {
    console.warn(`Cart is empty for user: ${user.telegramId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Your cart is empty!" });
  }

  const products = await Product.find({ _id: { $in: user.cart }, isActive: true });
  const outOfStock = products.filter((p) => p.stock <= 0);

  if (outOfStock.length > 0) {
    console.error(`Out of stock products: ${outOfStock.map((p) => p.title).join(", ")}`);
    return await bot.answerCallbackQuery(query.id, {
      text: `❌ ${outOfStock.map((p) => sanitizeInput(p.title)).join(", ")} out of stock!`,
    });
  }

  const totalPrice = products.reduce((sum, p) => sum + calculateDiscountPrice(p.price, p.discount), 0);

  try {
    const order = await Order.create({
      clientId: user.telegramId,
      products: user.cart,
      totalPrice,
      createdAt: new Date(),
    });

    for (const product of products) {
      product.stock -= 1;
      await product.save();
    }

    user.cart = [];
    await user.save();
    console.log(`Checkout completed for user: ${user.telegramId}, order ID: ${order._id}`);
    await bot.answerCallbackQuery(query.id, { text: "✅ Order placed!" });
    sendNotification(user.telegramId, "✅ Order placed!");
  } catch (error) {
    console.error(`Error during checkout for user: ${user.telegramId}:`, error);
    await bot.answerCallbackQuery(query.id, { text: "❌ Failed to place order" });
  }
};

const handleClearCart = async (bot, query, user) => {
  user.cart = [];
  await user.save();
  console.log(`Cart cleared for user: ${user.telegramId}`);
  await bot.answerCallbackQuery(query.id, { text: "🗑️ Cart cleared" });
  await showCartPage(bot, query.message.chat.id, 1);
};

const handleRoleChange = async (bot, query, user) => {
  if (user.role.toLowerCase() !== "admin") {
    console.error(`Permission denied for role change, user: ${user.telegramId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Permission denied" });
  }

  const [, role, userId] = query.data.split("_");
  if (!["user", "seller", "admin"].includes(role.toLowerCase())) {
    console.error(`Invalid role: ${role}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Invalid role" });
  }

  const targetUser = await User.findOneAndUpdate({ telegramId: userId }, { role }, { new: true });

  if (!targetUser) {
    console.error(`Target user not found for ID: ${userId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ User not found" });
  }

  console.log(`Role changed for user ID: ${userId} to ${role}`);
  await bot.answerCallbackQuery(query.id, {
    text: `✅ @${targetUser.username || targetUser.firstName} role changed to ${role.toUpperCase()}`,
  });
  sendNotification(userId, `✅ Your role has been changed to ${role.toUpperCase()}`);
};

const handleOrderStatusChange = async (bot, query, user, orderId, newStatus) => {
  if (!["seller", "admin"].includes(user.role.toLowerCase())) {
    console.error(`Permission denied for order status change, user: ${user.telegramId}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Permission denied" });
  }

  try {
    const order = await Order.findById(orderId);
    if (!order) {
      console.error(`Order not found for ID: ${orderId}`);
      return await bot.answerCallbackQuery(query.id, { text: "❌ Order not found" });
    }

    if (order.status === newStatus) {
      return await bot.answerCallbackQuery(query.id, { text: "⚠️ Order already in this status" });
    }

    order.status = newStatus;
    order.updatedAt = new Date();
    await order.save();

    const statusText = {
      processing: "🔄 Processing",
      completed: "✅ Completed",
      cancelled: "❌ Cancelled",
    };

    console.log(`Order status changed to ${newStatus} for order ID: ${orderId}`);
    await bot.answerCallbackQuery(query.id, {
      text: `✅ Order status: ${statusText[newStatus]}`,
    });
    sendNotification(order.clientId, `📜 Order #${order._id.toString().slice(-6)} status: ${statusText[newStatus]}`);
    await showOrderProducts(bot, query.message.chat.id, orderId, 1);
  } catch (error) {
    console.error(`Error changing order status for order ID: ${orderId}:`, error);
    await bot.answerCallbackQuery(query.id, { text: "❌ Error occurred" });
  }
};

const handleCategorySelection = async (bot, chatId, categoryName, user) => {
  const sellerState = stateManager.getState("seller", chatId);
  const editState = stateManager.getState("editProduct", chatId);

  if (sellerState && sellerState.step === "category_selection") {
    sellerState.category = categoryName;
    sellerState.step = "stock";
    stateManager.setState("seller", chatId, sellerState);
    await safeSendMessage(bot, chatId, "📦 Enter stock quantity (0 or higher):");
  } else if (editState && editState.step === "category_selection") {
    const product = await Product.findById(editState.productId);
    if (!product || product.sellerId !== chatId) {
      stateManager.clearState("editProduct", chatId);
      return await safeSendMessage(bot, chatId, "❌ Product not found or no permission.");
    }
    product.category = categoryName;
    await product.save();
    stateManager.clearState("editProduct", chatId);
    await safeSendMessage(bot, chatId, "✅ Product category updated successfully!");
    sendNotification(chatId, `✅ ${sanitizeInput(product.title)} category updated!`);
  }
  await bot.answerCallbackQuery(query.id, { text: `🗂 Category selected: ${sanitizeInput(categoryName)}` });
};

const handleConfirmNewCategory = async (bot, query, user) => {
  const chatId = query.message.chat.id.toString();
  const sellerState = stateManager.getState("seller", chatId);
  const editState = stateManager.getState("editProduct", chatId);

  if (sellerState) {
    sellerState.step = "wait_for_category_approval";
    stateManager.setState("seller", chatId, sellerState);
  } else if (editState) {
    editState.step = "wait_for_category_approval";
    stateManager.setState("editProduct", chatId, editState);
  } else {
    return await bot.answerCallbackQuery(query.id, { text: "❌ Invalid state" });
  }

  await safeSendMessage(bot, chatId, "⏳ Waiting for category approval...");
  await bot.answerCallbackQuery(query.id, { text: "⏳ Waiting for category approval" });
};

const handleCancelNewCategory = async (bot, chatId) => {
  const sellerState = stateManager.getState("seller", chatId);
  const editState = stateManager.getState("editProduct", chatId);

  if (sellerState) {
    sellerState.step = "category_selection";
    stateManager.setState("seller", chatId, sellerState);
  } else if (editState) {
    editState.step = "category_selection";
    stateManager.setState("editProduct", chatId, editState);
  } else {
    return await bot.answerCallbackQuery(query.id, { text: "❌ Invalid state" });
  }

  const categoryKeyboard = await getCategoryKeyboard();
  if (!categoryKeyboard) {
    stateManager.clearState(sellerState ? "seller" : "editProduct", chatId);
    return await safeSendMessage(bot, chatId, "❌ No categories available. Action cancelled.");
  }

  await safeSendMessage(bot, chatId, "🗂 Select a category:", {
    reply_markup: categoryKeyboard,
  });
  await bot.answerCallbackQuery(query.id, { text: "🔙 Returned to category selection" });
};

const handleApproveCategory = async (bot, query, user) => {
  const categoryName = query.data.split("_").slice(2, -1).join("_");
  const requesterChatId = query.data.split("_").pop();
  console.log(`User ${user.telegramId} (role: ${user.role}) attempting to approve category: ${categoryName}, requester: ${requesterChatId}`);

  if (user.role.toLowerCase() !== "admin") {
    console.error(`Permission denied for category approval, user: ${user.telegramId}, role: ${user.role}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Only admin can approve category" });
  }

  try {
    const existingCategory = await Category.findOne({ name: categoryName }).lean();
    if (existingCategory) {
      console.warn(`Category already exists: ${categoryName}`);
      await safeSendMessage(bot, requesterChatId, `⚠️ Category "${sanitizeInput(categoryName)}" already exists!`);
      sendNotification(requesterChatId, `⚠️ Category "${sanitizeInput(categoryName)}" already exists!`);
      return await bot.answerCallbackQuery(query.id, { text: `⚠️ Category "${sanitizeInput(categoryName)}" already exists` });
    }

    const category = await Category.create({ name: categoryName });
    console.log(`Category created: ${categoryName}, ID: ${category._id}`);
    await safeSendMessage(bot, requesterChatId, `✅ Category "${sanitizeInput(categoryName)}" created successfully!`);
    sendNotification(requesterChatId, `✅ Category "${sanitizeInput(categoryName)}" created!`);

    const sellerState = stateManager.getState("seller", requesterChatId);
    const editState = stateManager.getState("editProduct", requesterChatId);

    if (sellerState && sellerState.step === "wait_for_category_approval") {
      sellerState.category = categoryName;
      sellerState.step = "stock";
      stateManager.setState("seller", requesterChatId, sellerState);
      await safeSendMessage(bot, requesterChatId, "📦 Enter stock quantity (0 or higher):");
    } else if (editState && editState.step === "wait_for_category_approval") {
      const product = await Product.findById(editState.productId);
      if (!product || product.sellerId !== requesterChatId) {
        stateManager.clearState("editProduct", requesterChatId);
        return await safeSendMessage(bot, requesterChatId, "❌ Product not found or no permission.");
      }
      product.category = categoryName;
      await product.save();
      stateManager.clearState("editProduct", requesterChatId);
      await safeSendMessage(bot, requesterChatId, "✅ Product category updated successfully!");
      sendNotification(requesterChatId, `✅ ${sanitizeInput(product.title)} category updated!`);
    } else {
      console.warn(`No valid state found for requesterChatId: ${requesterChatId}`);
      await safeSendMessage(bot, requesterChatId, "⚠️ Category approved, but no process state found.");
    }

    await bot.answerCallbackQuery(query.id, { text: `✅ Category "${sanitizeInput(categoryName)}" approved` });
    await safeSendMessage(bot, user.telegramId, `✅ Category "${sanitizeInput(categoryName)}" approved`);
  } catch (error) {
    console.error(`Error approving category "${categoryName}" for requester ${requesterChatId}:`, error);
    await bot.answerCallbackQuery(query.id, { text: "❌ Error approving category" });
    await safeSendMessage(bot, requesterChatId, "❌ Error approving category.");
  }
};

const handleRejectCategory = async (bot, query, user) => {
  const categoryName = query.data.split("_").slice(2, -1).join("_");
  const requesterChatId = query.data.split("_").pop();
  console.log(`User ${user.telegramId} (role: ${user.role}) attempting to reject category: ${categoryName}, requester: ${requesterChatId}`);

  if (user.role.toLowerCase() !== "admin") {
    console.error(`Permission denied for category rejection, user: ${user.telegramId}, role: ${user.role}`);
    return await bot.answerCallbackQuery(query.id, { text: "❌ Only admin can reject category" });
  }

  try {
    stateManager.setState("admin", user.telegramId, { step: "reject_reason", categoryName, requesterChatId });
    await safeSendMessage(bot, user.telegramId, "📝 Enter reason for category rejection:");
    await bot.answerCallbackQuery(query.id, { text: "📝 Enter rejection reason" });
  } catch (error) {
    console.error(`Error initiating category rejection for "${categoryName}", requester ${requesterChatId}:`, error);
    await bot.answerCallbackQuery(query.id, { text: "❌ Error rejecting category" });
    await safeSendMessage(bot, requesterChatId, "❌ Error rejecting category.");
  }
};

module.exports = {
  handleCallbackQuery,
};