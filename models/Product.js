const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  price: { type: Number, required: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  images: [{ type: String }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  rating: { type: Number, default: 0 },
  premium: { type: Boolean, default: false }
}, { timestamps: true });

ProductSchema.index({ title: "text", description: "text" });

module.exports = mongoose.model("Product", ProductSchema);
