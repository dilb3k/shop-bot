const { ADMINS } = require("./constants")

const checkAdmin = (username, phone) => {
  const cleanPhone = phone ? phone.replace(/\D/g, "") : ""

  return ADMINS.some(
    (admin) =>
      (username && admin.username.toLowerCase() === username.toLowerCase()) ||
      (cleanPhone && admin.phones.some((p) => p.replace(/\D/g, "") === cleanPhone)),
  )
}

module.exports = {
  checkAdmin,
}
