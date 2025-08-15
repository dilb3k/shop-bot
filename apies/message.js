const express = require("express");
const { getMessages, sendMessage } = require("../handlers/messageHandlers");
const { verifyToken } = require("../utils/auth");

const router = express.Router();

router.get("/:chatId", verifyToken, getMessages);
router.post("/", verifyToken, sendMessage);

module.exports = router;