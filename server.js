const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const dotenv = require("dotenv")
const connectDB = require("./config/database")
const bot = require("./bot")
const { verifyToken } = require("./utils/auth")

dotenv.config()

// Initialize Express and Socket.IO
const app = express()
const server = http.createServer(app)
const io = socketIo(server, { cors: { origin: "*" } })

// Middleware
app.use(express.json())

// Connect to MongoDB
connectDB()

// Socket.IO: Real-time Chat
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id)

  socket.on("join", (userId) => {
    socket.join(userId)
  })

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
  })
})

// Make io available globally
global.io = io

// Express API for Notifications
app.get("/notifications", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]
  const decoded = verifyToken(token)

  if (!decoded) {
    return res.status(401).json({ error: "Invalid token" })
  }

  io.emit("notification", {
    to: decoded.id,
    message: "🔔 Yangi bildirishnoma!",
  })

  res.json({ message: "Notification sent" })
})

// Error Handling
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err)
})

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
  process.exit(1)
})

// Start Server
const PORT = process.env.PORT || 3002
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  
  console.log(`🤖 Telegram bot is active`)
})

