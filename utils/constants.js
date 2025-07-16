const ADMINS = [
  {
    username: "dilbek7011",
    phones: ["+998887060903", "998887060903", "887060903"],
  },
]

const PRODUCTS_PER_PAGE = 5
const COMMENTS_PER_PAGE = 5

const ORDER_STATUS = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
}

const USER_ROLES = {
  CLIENT: "client",
  SELLER: "seller",
  ADMIN: "admin",
}

module.exports = {
  ADMINS,
  PRODUCTS_PER_PAGE,
  COMMENTS_PER_PAGE,
  ORDER_STATUS,
  USER_ROLES,
}
