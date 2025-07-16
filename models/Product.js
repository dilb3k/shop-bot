const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({
  sellerId: {
    type: String,
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  images: [
    {
      type: String,
      required: true,
    },
  ],
  category: {
    type: String,
    default: "Uncategorized",
    trim: true,
    maxlength: 50,
  },
  stock: {
    type: Number,
    default: 0,
    min: 0,
  },
  likes: [
    {
      type: String,
    },
  ],
  comments: [
    {
      userId: String,
      username: String,
      text: {
        type: String,
        trim: true,
        maxlength: 500,
      },
      reply: {
        userId: String,
        username: String,
        text: {
          type: String,
          trim: true,
          maxlength: 500,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
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

// Indexes for better performance
productSchema.index({ sellerId: 1 })
productSchema.index({ category: 1 })
productSchema.index({ price: 1 })
productSchema.index({ rating: -1 })
productSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Product", productSchema)
