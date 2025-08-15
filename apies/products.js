const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const User = require("../models/User");
const { verifyToken } = require("../utils/auth");

// Middleware to check role
const checkRole = (roles) => (req, res, next) => {
    const user = req.user;
    if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "Unauthorized" });
    }
    next();
};

// Get all products with filters
router.get("/", async (req, res) => {
    try {
        const { category, minPrice, maxPrice, sortBy = "createdAt", order = "desc", page = 1, limit = 10 } = req.query;
        const query = { isActive: true };

        if (category) query.category = category;
        if (minPrice) query.price = { ...query.price, $gte: Number(minPrice) };
        if (maxPrice) query.price = { ...query.price, $lte: Number(maxPrice) };

        const sort = {};
        sort[sortBy] = order === "desc" ? -1 : 1;

        const products = await Product.find(query)
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);
        const total = await Product.countDocuments(query);

        res.json({ products, total });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single product
router.get("/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product || !product.isActive) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seller: Create product
router.post("/", checkRole(["seller"]), async (req, res) => {
    try {
        const { title, price, discount, description, images, category, stock } = req.body;
        const product = new Product({
            sellerId: req.user.telegramId,
            title,
            price,
            discount,
            description,
            images,
            category,
            stock
        });
        await product.save();
        res.status(201).json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seller: Update product
router.put("/:id", checkRole(["seller"]), async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.telegramId });
        if (!product) return res.status(404).json({ error: "Product not found" });

        const updates = req.body;
        Object.assign(product, updates);
        await product.save();
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Seller: Delete product
router.delete("/:id", checkRole(["seller"]), async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, sellerId: req.user.telegramId });
        if (!product) return res.status(404).json({ error: "Product not found" });

        product.isActive = false;
        await product.save();
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add/remove like
router.post("/:id/like", verifyToken, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });

        const userId = req.user.telegramId;
        if (product.likes.includes(userId)) {
            product.likes = product.likes.filter(id => id !== userId);
        } else {
            product.likes.push(userId);
        }

        await product.save();
        res.json(product.likes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add comment
router.post("/:id/comment", async (req, res) => {
    try {
        const { text } = req.body;
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });

        product.comments.push({
            userId: req.user.telegramId,
            username: req.user.username,
            text
        });

        await product.save();
        res.json(product.comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add rating
router.post("/:id/rating", async (req, res) => {
    try {
        const { rating } = req.body;
        if (rating < 0 || rating > 5) {
            return res.status(400).json({ error: "Invalid rating" });
        }

        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ error: "Product not found" });

        product.rating = ((product.rating * product.ratingCount) + rating) / (product.ratingCount + 1);
        product.ratingCount += 1;

        await product.save();
        res.json({ rating: product.rating, ratingCount: product.ratingCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;