const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const { verifyToken } = require("../utils/auth");

// Middleware to check role
const checkRole = (roles) => (req, res, next) => {
    const user = req.user;
    if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    next();
};

// Create order
router.post("/", verifyToken, async (req, res) => {
    try {
        const { productIds } = req.body;
        const products = await Product.find({ _id: { $in: productIds } });

        const totalPrice = products.reduce((sum, product) => {
            const price = product.price * (1 - product.discount / 100);
            return sum + price;
        }, 0);

        const order = new Order({
            clientId: req.user.telegramId,
            products: productIds,
            totalPrice
        });

        await order.save();

        // Clear cart
        await User.findOneAndUpdate(
            { telegramId: req.user.telegramId },
            { $set: { cart: [] } }
        );

        global.io.emit("notification", {
            to: req.user.telegramId,
            message: "🔔 New order created!"
        });

        res.status(201).json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user orders
router.get("/", verifyToken, async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { clientId: req.user.telegramId };
        if (status) query.status = status;

        const orders = await Order.find(query)
            .populate("products")
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        const total = await Order.countDocuments(query);

        res.json({ orders, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seller: Get orders containing their products
router.get("/seller", verifyToken, checkRole(["seller"]), async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { status };

        const orders = await Order.find()
            .populate({
                path: "products",
                match: { sellerId: req.user.telegramId }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const filteredOrders = orders.filter(order => order.products.length > 0);
        const total = filteredOrders.length;

        res.json({ orders: filteredOrders, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin/Seller: Update order status
router.put("/:id/status", verifyToken, checkRole(["seller", "admin"]), async (req, res) => {
    try {
        const { status } = req.body;
        if (!["pending", "processing", "completed", "cancelled"].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const order = await Order.findById(req.params.id).populate("products");
        if (!order) return res.status(404).json({ error: "Order not found" });

        if (req.user.role === "seller") {
            const hasAccess = order.products.some(product => product.sellerId === req.user.telegramId);
            if (!hasAccess) return res.status(403).json({ error: "Unauthorized" });
        }

        order.status = status;
        await order.save();

        global.io.emit("notification", {
            to: order.clientId,
            message: `🔔 Order status updated to ${status}`
        });

        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;