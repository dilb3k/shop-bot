const express = require("express")
const http = require("http")
const socketIo = require("socket.io")
const dotenv = require("dotenv")
const connectDB = require("./config/database")
const bot = require("./bot") // Telegram bot kodlari shu faylda bo'lishi kerak
const { verifyToken } = require("./utils/auth")

dotenv.config()

// Express va Socket.IO
const app = express()
const server = http.createServer(app)
const io = socketIo(server, { cors: { origin: "*" } })

app.use(express.json())

// MongoDB bilan ulanish
connectDB()

// Socket.IO ulanishlari
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id)

  socket.on("join", (userId) => {
    socket.join(userId)
  })

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id)
  })
})

// Socketni global qilish
global.io = io

// Test route — ishlayotganini tekshirish uchun
app.get("/", (req, res) => {
  res.send("✅ Bot ishlayapti - Fly.io");
})

// Telegram bildirishnomasi uchun route
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

// Errorlar
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err)
})

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err)
  process.exit(1)
})

// Serverni ishga tushirish — MUHIM: 0.0.0.0
const PORT = process.env.PORT || 8300
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`🤖 Telegram bot is active`)
})
