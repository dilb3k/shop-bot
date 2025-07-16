const Joi = require("joi")

class Validator {
  constructor() {
    this.schemas = {
      user: Joi.object({
        telegramId: Joi.string().required(),
        username: Joi.string().optional(),
        firstName: Joi.string().optional(),
        phone: Joi.string()
          .pattern(/^\+?[1-9]\d{1,14}$/)
          .optional(),
        role: Joi.string().valid("client", "seller", "admin").default("client"),
      }),

      product: Joi.object({
        title: Joi.string().min(3).max(100).required(),
        price: Joi.number().positive().required(),
        discount: Joi.number().min(0).max(100).default(0),
        description: Joi.string().max(1000).optional(),
        category: Joi.string().max(50).default("Uncategorized"),
        stock: Joi.number().min(0).default(0),
        images: Joi.array().items(Joi.string()).max(5).default([]),
      }),

      order: Joi.object({
        clientId: Joi.string().required(),
        products: Joi.array().items(Joi.string()).min(1).required(),
        status: Joi.string().valid("pending", "processing", "completed", "cancelled").default("pending"),
      }),
    }
  }

  validateUser(data) {
    return this.validate(this.schemas.user, data)
  }

  validateProduct(data) {
    return this.validate(this.schemas.product, data)
  }

  validateOrder(data) {
    return this.validate(this.schemas.order, data)
  }

  validate(schema, data) {
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
    })

    if (error) {
      throw new Error(`Validation error: ${error.details.map((d) => d.message).join(", ")}`)
    }

    return value
  }

  isValidObjectId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id)
  }

  isValidUserId(userId) {
    return typeof userId === "string" && userId.length > 0
  }

  sanitizeInput(input) {
    if (typeof input !== "string") return ""
    return input.trim().replace(/[<>]/g, "")
  }

  validatePrice(price) {
    const numPrice = Number(price)
    return !isNaN(numPrice) && numPrice > 0
  }

  validateDiscount(discount) {
    const numDiscount = Number(discount)
    return !isNaN(numDiscount) && numDiscount >= 0 && numDiscount <= 100
  }

  validateStock(stock) {
    const numStock = Number(stock)
    return !isNaN(numStock) && numStock >= 0
  }
}

module.exports = Validator
