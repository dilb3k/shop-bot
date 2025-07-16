const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    index: true,
  },
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  ],
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "cancelled"],
    default: "pending",
    index: true,
  },
  totalPrice: {
    type: Number,
    default: 0,
    min: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

// Indexes for better performance
orderSchema.index({ clientId: 1 })
orderSchema.index({ status: 1 })
orderSchema.index({ createdAt: -1 })

module.exports = mongoose.model("Order", orderSchema)
