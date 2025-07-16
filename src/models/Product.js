const mongoose = require("mongoose")

const productSchema = new mongoose.Schema(
  {
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
      index: "text",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true,
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
      index: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },
    likes: [
      {
        type: String,
      },
    ],
    views: {
      type: Number,
      default: 0,
    },
    comments: [
      {
        userId: {
          type: String,
          required: true,
        },
        username: String,
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: 500,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
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
      index: true,
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
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Compound indexes for performance
productSchema.index({ isActive: 1, category: 1 })
productSchema.index({ isActive: 1, price: 1 })
productSchema.index({ isActive: 1, rating: -1 })
productSchema.index({ isActive: 1, createdAt: -1 })
productSchema.index({ sellerId: 1, isActive: 1 })

// Text search index
productSchema.index({
  title: "text",
  description: "text",
  category: "text",
})

// Virtual for discounted price
productSchema.virtual("discountedPrice").get(function () {
  if (this.discount > 0) {
    return this.price * (1 - this.discount / 100)
  }
  return this.price
})

// Virtual for like count
productSchema.virtual("likeCount").get(function () {
  return this.likes ? this.likes.length : 0
})

// Virtual for comment count
productSchema.virtual("commentCount").get(function () {
  return this.comments ? this.comments.length : 0
})

// Virtual for availability
productSchema.virtual("isAvailable").get(function () {
  return this.stock > 0 && this.isActive
})

// Methods
productSchema.methods.addLike = function (userId) {
  if (!this.likes.includes(userId)) {
    this.likes.push(userId)
  }
  return this.save()
}

productSchema.methods.removeLike = function (userId) {
  this.likes = this.likes.filter((id) => id !== userId)
  return this.save()
}

productSchema.methods.incrementViews = function () {
  this.views += 1
  return this.save()
}

productSchema.methods.updateStock = function (quantity) {
  this.stock = Math.max(0, this.stock + quantity)
  return this.save()
}

productSchema.methods.addComment = function (comment) {
  this.comments.push(comment)
  this.updateRating()
  return this.save()
}

productSchema.methods.updateRating = function () {
  const ratings = this.comments.filter((comment) => comment.rating).map((comment) => comment.rating)

  if (ratings.length > 0) {
    this.rating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    this.ratingCount = ratings.length
  }
}

// Static methods
productSchema.statics.findActive = function (filters = {}) {
  return this.find({ ...filters, isActive: true })
}

productSchema.statics.findByCategory = function (category) {
  return this.find({ category, isActive: true }).sort({ createdAt: -1 })
}

productSchema.statics.findBySeller = function (sellerId) {
  return this.find({ sellerId, isActive: true }).sort({ createdAt: -1 })
}

productSchema.statics.search = function (query) {
  return this.find({
    $text: { $search: query },
    isActive: true,
  }).sort({ score: { $meta: "textScore" } })
}

productSchema.statics.getFeatured = function (limit = 10) {
  return this.find({ featured: true, isActive: true }).sort({ rating: -1, views: -1 }).limit(limit)
}

module.exports = mongoose.model("Product", productSchema)
