const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    unique: true,
    required: true,
    index: true,
  },
  username: String,
  firstName: String,
  phone: String,
  role: {
    type: String,
    enum: ["client", "seller", "admin"],
    default: "client",
  },
  cart: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  ratingCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Index for better performance
userSchema.index({ telegramId: 1 })
userSchema.index({ role: 1 })

module.exports = mongoose.model("User", userSchema)

