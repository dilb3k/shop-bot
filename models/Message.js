const mongoose = require("mongoose")

const messageSchema = new mongoose.Schema({
  fromId: {
    type: String,
    required: true,
    index: true,
  },
  toId: {
    type: String,
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null,
  },
  text: {
    type: String,
    trim: true,
    required: true,
    maxlength: 1000,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Indexes for better performance
messageSchema.index({ fromId: 1, toId: 1 })
messageSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Message", messageSchema)
