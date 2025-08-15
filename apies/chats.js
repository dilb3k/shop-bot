const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const { verifyToken } = require("../utils/auth");

// Get or create conversation
router.get("/conversation/:productId", verifyToken, async (req, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.telegramId;

        const chatId = `${userId}_${productId}`;
        let conversation = await Conversation.findOne({ chatId });

        if (!conversation) {
            conversation = new Conversation({ chatId });
            await conversation.save();
        }

        const messages = await Message.find({
            $or: [
                { fromId: userId, productId },
                { toId: userId, productId }
            ]
        }).sort({ createdAt: 1 });

        res.json({ conversation, messages });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all conversations for user
router.get("/conversations", verifyToken, async (req, res) => {
    try {
        const userId = req.user.telegramId;
        const conversations = await Conversation.find({
            chatId: { $regex: `^${userId}_|_${userId}$` }
        });

        const conversationDetails = await Promise.all(conversations.map(async (conv) => {
            const lastMessage = await Message.findOne({
                $or: [
                    { fromId: userId, chatId: conv.chatId },
                    { toId: userId, chatId: conv.chatId }
                ]
            }).sort({ createdAt: -1 });

            return {
                ...conv.toObject(),
                lastMessage
            };
        }));

        res.json(conversationDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send message
router.post("/message", verifyToken, async (req, res) => {
    try {
        const { productId, toId, text } = req.body;
        const fromId = req.user.telegramId;

        const message = new Message({
            fromId,
            toId,
            productId,
            text
        });

        await message.save();

        const conversation = await Conversation.findOneAndUpdate(
            { chatId: `${fromId}_${productId}` },
            { updatedAt: Date.now() },
            { upsert: true }
        );

        global.io.to(toId).emit("message", message);

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark messages as read
router.put("/messages/read", verifyToken, async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.telegramId;

        await Message.updateMany(
            { toId: userId, productId, isRead: false },
            { isRead: true }
        );

        res.json({ message: "Messages marked as read" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;