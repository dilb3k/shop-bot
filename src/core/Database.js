const mongoose = require("mongoose")

class Database {
  constructor() {
    this.connection = null
    this.isConnected = false
  }

  async connect() {
    try {
      if (this.isConnected) {
        return this.connection
      }

      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
      }

      this.connection = await mongoose.connect(process.env.MONGODB_URI, options)
      this.isConnected = true

      mongoose.connection.on("error", (error) => {
        console.error("MongoDB connection error:", error)
        this.isConnected = false
      })

      mongoose.connection.on("disconnected", () => {
        console.warn("MongoDB disconnected")
        this.isConnected = false
      })

      mongoose.connection.on("reconnected", () => {
        console.info("MongoDB reconnected")
        this.isConnected = true
      })

      return this.connection
    } catch (error) {
      this.isConnected = false
      throw new Error(`Database connection failed: ${error.message}`)
    }
  }

  async disconnect() {
    try {
      if (this.connection) {
        await mongoose.connection.close()
        this.isConnected = false
      }
    } catch (error) {
      throw new Error(`Database disconnection failed: ${error.message}`)
    }
  }

  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1
  }
}

module.exports = Database
