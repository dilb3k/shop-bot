const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Order = require("../models/Order");
const { verifyToken } = require("../utils/auth");

// Middleware to check role
const checkRole = (roles) => (req, res, next) => {
    const user = req.user;
    if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    next();
};

// Register or login user
router.post("/register", async (req, res) => {
    try {
        const { telegramId, username, firstName, phone } = req.body;
        let user = await User.findOne({ telegramId });

        if (!user) {
            user = new User({ telegramId, username, firstName, phone });
            await user.save();
        }

        const token = generateToken(user); // Assume generateToken is defined in utils/auth
        res.json({ user, token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user profile
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId })
            .populate("cart");
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user profile
router.put("/profile", verifyToken, async (req, res) => {
    try {
        const { username, firstName, phone } = req.body;
        const user = await User.findOneAndUpdate(
            { telegramId: req.user.telegramId },
            { username, firstName, phone },
            { new: true }
        );
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get all users
router.get("/", verifyToken, checkRole(["admin"]), async (req, res) => {
    try {
        const { role, page = 1, limit = 10 } = req.query;
        const query = role ? { role } : {};
        const users = await User.find(query)
            .limit(limit * 1)
            .skip((page - 1) * limit);
        const total = await User.countDocuments(query);
        res.json({ users, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Update user role
router.put("/:id/role", verifyToken, checkRole(["admin"]), async (req, res) => {
    try {
        const { role } = req.body;
        if (!["client", "seller", "admin"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add/remove from cart
router.post("/cart", verifyToken, async (req, res) => {
    try {
        const { productId, action } = req.body;
        const user = await User.findOne({ telegramId: req.user.telegramId });

        if (action === "add") {
            if (!user.cart.includes(productId)) {
                user.cart.push(productId);
            }
        } else if (action === "remove") {
            user.cart = user.cart.filter(id => id.toString() !== productId);
        }

        await user.save();
        await user.populate("cart");
        res.json(user.cart);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get seller rating
router.get("/seller/:id/rating", async (req, res) => {
    try {
        const orders = await Order.find({
            status: "completed",
            "products.sellerId": req.params.id
        });

        const rating = orders.reduce((acc, order) => acc + order.rating, 0) / orders.length || 0;
        res.json({ rating, count: orders.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;