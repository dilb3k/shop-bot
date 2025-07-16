const mongoose = require("mongoose")

const conversationSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  inAdminConversation: {
    type: Boolean,
    default: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

conversationSchema.pre("save", function(next) {
  this.updatedAt = Date.now()
  next()
})

module.exports = mongoose.model("Conversation", conversationSchema)