const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["premium", "order"], required: true },
    amount: { type: Number, required: true },
    txHash: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "confirmed", "failed"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("Payment", PaymentSchema);
