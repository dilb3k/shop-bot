const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const { Server } = require("socket.io");
const Web3 = require("web3");

const User = require("./models/User");
const Product = require("./models/Product");
const Category = require("./models/Category");
const Order = require("./models/Order");
const Conversation = require("./models/Conversation");
const Message = require("./models/Message");
const Payment = require("./models/Payment");

const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

module.exports = (server, app) => {
    const io = new Server(server, { cors: { origin: "*" } });

    const authMiddleware = (roles = []) => {
        return (req, res, next) => {
            const token = req.headers.authorization?.split(" ")[1];
            if (!token) return res.status(401).json({ msg: "Token kerak" });
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = decoded;
                if (roles.length && !roles.includes(decoded.role)) {
                    return res.status(403).json({ msg: "Ruxsat yo‘q" });
                }
                next();
            } catch {
                res.status(401).json({ msg: "Token xato" });
            }
        };
    };

    // AUTH
    app.post("/auth/register", async (req, res) => {
        try {
            const { username, email, password } = req.body;
            const hash = await bcrypt.hash(password, 10);
            const user = await User.create({ username, email, password: hash });
            res.json(user);
        } catch (err) { res.status(400).json({ msg: err.message }); }
    });

    app.post("/auth/login", async (req, res) => {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: "User topilmadi" });
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ msg: "Parol xato" });
        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({ token, user });
    });

    // CATEGORIES
    app.post("/categories", authMiddleware(["admin"]), async (req, res) => {
        res.json(await Category.create(req.body));
    });
    app.get("/categories", async (req, res) => {
        res.json(await Category.find());
    });

    // PRODUCTS
    app.post("/products", authMiddleware(["seller"]), upload.array("images"), async (req, res) => {
        const images = req.files.map(f => f.path);
        res.json(await Product.create({ ...req.body, seller: req.user.id, images }));
    });
    app.get("/products", async (req, res) => {
        const filter = req.query.category ? { category: req.query.category } : {};
        res.json(await Product.find(filter).populate("category seller"));
    });
    app.put("/products/:id", authMiddleware(["seller"]), async (req, res) => {
        res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true }));
    });
    app.delete("/products/:id", authMiddleware(["seller"]), async (req, res) => {
        await Product.findByIdAndDelete(req.params.id);
        res.json({ msg: "O‘chirildi" });
    });

    // ORDERS
    app.post("/orders", authMiddleware(["client"]), async (req, res) => {
        res.json(await Order.create({ ...req.body, client: req.user.id }));
    });
    app.put("/orders/:id", authMiddleware(["seller", "admin"]), async (req, res) => {
        res.json(await Order.findByIdAndUpdate(req.params.id, req.body, { new: true }));
    });

    // CHAT SOCKET.IO
    io.on("connection", (socket) => {
        socket.on("join", (userId) => {
            socket.join(userId);
        });

        socket.on("sendMessage", async ({ conversationId, sender, text, image }) => {
            const msg = await Message.create({ conversationId, sender, text, image });
            const conv = await Conversation.findById(conversationId);
            conv.participants.forEach(p => io.to(p.toString()).emit("message", msg));
        });

        socket.on("typing", ({ conversationId, sender }) => {
            io.to(conversationId).emit("typing", sender);
        });

        socket.on("seen", async ({ messageId, userId }) => {
            await Message.findByIdAndUpdate(messageId, { $addToSet: { seenBy: userId } });
        });
    });

    // WEB3 PAYMENTS
    const web3 = new Web3(process.env.WEB3_PROVIDER);

    app.post("/payments", authMiddleware(), async (req, res) => {
        const { type, amount, txHash } = req.body;
        const payment = await Payment.create({ user: req.user.id, type, amount, txHash });
        res.json(payment);
    });

    app.get("/payments/verify/:hash", async (req, res) => {
        try {
            const tx = await web3.eth.getTransaction(req.params.hash);
            if (tx && tx.blockNumber) {
                await Payment.findOneAndUpdate({ txHash: req.params.hash }, { status: "confirmed" });
                return res.json({ confirmed: true });
            }
            res.json({ confirmed: false });
        } catch (err) { res.status(400).json({ msg: err.message }); }
    });
};
