const jwt = require("jsonwebtoken")

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.telegramId,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  )
}

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET)
  } catch (error) {
    console.error("Token verification error:", error.message)
    return null
  }
}

module.exports = {
  generateToken,
  verifyToken,
}
