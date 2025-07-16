class ErrorHandler {
  constructor(logger) {
    this.logger = logger
  }

  handle(error, context = {}) {
    this.logger.error("Application error:", error, context)

    // Handle specific error types
    if (error.name === "ValidationError") {
      return this.handleValidationError(error)
    }

    if (error.name === "CastError") {
      return this.handleCastError(error)
    }

    if (error.code === 11000) {
      return this.handleDuplicateError(error)
    }

    return this.handleGenericError(error)
  }

  handleValidationError(error) {
    const errors = Object.values(error.errors).map((err) => err.message)
    return {
      type: "validation",
      message: "Ma'lumotlar noto'g'ri",
      details: errors,
    }
  }

  handleCastError(error) {
    return {
      type: "cast",
      message: "Noto'g'ri ID format",
      details: [error.message],
    }
  }

  handleDuplicateError(error) {
    const field = Object.keys(error.keyValue)[0]
    return {
      type: "duplicate",
      message: `${field} allaqachon mavjud`,
      details: [error.message],
    }
  }

  handleGenericError(error) {
    return {
      type: "generic",
      message: "Ichki server xatosi",
      details: [error.message],
    }
  }

  middleware() {
    return (error, req, res, next) => {
      const handledError = this.handle(error, {
        url: req.url,
        method: req.method,
        ip: req.ip,
      })

      const statusCode = this.getStatusCode(handledError.type)

      res.status(statusCode).json({
        success: false,
        error: handledError,
      })
    }
  }

  getStatusCode(errorType) {
    const statusCodes = {
      validation: 400,
      cast: 400,
      duplicate: 409,
      generic: 500,
    }

    return statusCodes[errorType] || 500
  }
}

module.exports = ErrorHandler
