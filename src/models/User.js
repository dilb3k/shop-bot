const mongoose = require("mongoose")

const userSchema = new mongoose.Schema(
  {
    telegramId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      trim: true,
      sparse: true,
    },
    firstName: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ["client", "seller", "admin"],
      default: "client",
      index: true,
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
      index: true,
    },
    preferences: {
      language: {
        type: String,
        default: "uz",
        enum: ["uz", "ru", "en"],
      },
      notifications: {
        type: Boolean,
        default: true,
      },
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Indexes for performance
userSchema.index({ telegramId: 1, isActive: 1 })
userSchema.index({ role: 1, isActive: 1 })
userSchema.index({ createdAt: -1 })

// Virtual for cart count
userSchema.virtual("cartCount").get(function () {
  return this.cart ? this.cart.length : 0
})

// Methods
userSchema.methods.updateActivity = function () {
  this.lastActivity = new Date()
  return this.save()
}

userSchema.methods.addToCart = function (productId) {
  if (!this.cart.includes(productId)) {
    this.cart.push(productId)
  }
  return this.save()
}

userSchema.methods.removeFromCart = function (productId) {
  this.cart = this.cart.filter((id) => !id.equals(productId))
  return this.save()
}

userSchema.methods.clearCart = function () {
  this.cart = []
  return this.save()
}

// Static methods
userSchema.statics.findByTelegramId = function (telegramId) {
  return this.findOne({ telegramId, isActive: true })
}

userSchema.statics.findActiveUsers = function (role = null) {
  const query = { isActive: true }
  if (role) query.role = role
  return this.find(query).sort({ createdAt: -1 })
}

module.exports = mongoose.model("User", userSchema)
