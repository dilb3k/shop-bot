const mongoose = require("mongoose")

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        maxlength: 50,
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500,
        default: "",
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
})

categorySchema.index({ name: 1 })

module.exports = mongoose.model("Category", categorySchema)