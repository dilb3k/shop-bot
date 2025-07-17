const mongoose = require("mongoose")

const connectDB = async () => {
  try {
    const conn = await mongoose.connect("mongodb+srv://dilbekshermatov:1@cluster0.tnpmt7w.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    })

    console.log(`✅ MongoDB connected: ${conn.connection.host}`)
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message)
    process.exit(1)
  }
}

module.exports = connectDB
