const mongoose = require("mongoose")

const orderSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    products: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
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
      required: true,
      min: 0,
    },
    shippingAddress: {
      street: String,
      city: String,
      region: String,
      postalCode: String,
      country: {
        type: String,
        default: "Uzbekistan",
      },
    },
    contactInfo: {
      phone: String,
      email: String,
      notes: String,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "transfer"],
      default: "cash",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    deliveryDate: Date,
    completedAt: Date,
    cancelledAt: Date,
    cancellationReason: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
orderSchema.index({ clientId: 1, status: 1 })
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ createdAt: -1 })

// Virtual for order number
orderSchema.virtual("orderNumber").get(function () {
  return this._id.toString().slice(-6).toUpperCase()
})

// Virtual for total items
orderSchema.virtual("totalItems").get(function () {
  return this.products.reduce((sum, item) => sum + item.quantity, 0)
})

// Virtual for status emoji
orderSchema.virtual("statusEmoji").get(function () {
  const emojis = {
    pending: "⏳",
    processing: "🔄",
    completed: "✅",
    cancelled: "❌",
  }
  return emojis[this.status] || "📋"
})

// Methods
orderSchema.methods.updateStatus = function (status, reason = null) {
  this.status = status

  if (status === "completed") {
    this.completedAt = new Date()
  } else if (status === "cancelled") {
    this.cancelledAt = new Date()
    if (reason) this.cancellationReason = reason
  }

  return this.save()
}

orderSchema.methods.calculateTotal = function () {
  this.totalPrice = this.products.reduce((sum, item) => {
    const discountedPrice = item.discount > 0 ? item.price * (1 - item.discount / 100) : item.price
    return sum + discountedPrice * item.quantity
  }, 0)

  return this.totalPrice
}

orderSchema.methods.addProduct = function (productData) {
  const existingItem = this.products.find((item) => item.product.toString() === productData.product.toString())

  if (existingItem) {
    existingItem.quantity += productData.quantity || 1
  } else {
    this.products.push(productData)
  }

  this.calculateTotal()
  return this.save()
}

orderSchema.methods.removeProduct = function (productId) {
  this.products = this.products.filter((item) => item.product.toString() !== productId.toString())

  this.calculateTotal()
  return this.save()
}

// Static methods
orderSchema.statics.findByClient = function (clientId, status = null) {
  const query = { clientId }
  if (status) query.status = status
  return this.find(query).sort({ createdAt: -1 })
}

orderSchema.statics.findByStatus = function (status) {
  return this.find({ status }).sort({ createdAt: -1 })
}

orderSchema.statics.getStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalValue: { $sum: "$totalPrice" },
      },
    },
  ])
}

module.exports = mongoose.model("Order", orderSchema)
