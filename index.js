const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const dotenv = require("dotenv");
const { createServer } = require("http");
const { Server } = require("socket.io");
const compression = require("compression"); // Added for response compression
const morgan = require("morgan"); // Added for HTTP request logging

// Load environment variables
dotenv.config();

// Validate critical environment variables
const requiredEnvVars = ["TELEGRAM_BOT_TOKEN", "MONGODB_URI", "PORT"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Import core modules
const Database = require("./src/core/Database");
const Logger = require("./src/core/Logger");
const bot = require("./bot/index");

const RateLimiter = require("./src/core/RateLimiter");
const ErrorHandler = require("./src/core/ErrorHandler");
const Validator = require("./src/core/Validator");

// Import services
const UserService = require("./src/services/UserService");
const ProductService = require("./src/services/ProductService");
const OrderService = require("./src/services/OrderService");
const NotificationService = require("./src/services/NotificationService");

class EcommerceBotApplication {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: { origin: process.env.CORS_ORIGIN || "*", methods: ["GET", "POST"] },
      pingTimeout: 20000,
      pingInterval: 25000,
    });

    this.logger = new Logger();
    this.database = new Database(process.env.MONGODB_URI);
    this.rateLimiter = new RateLimiter();
    this.errorHandler = new ErrorHandler(this.logger);
    this.validator = new Validator();

    this.services = {};
    this.bot = null;

    this.setupMiddleware();
    this.setupServices();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security headers
    this.app.use(helmet());

    // Enable CORS
    this.app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));

    // Compress responses
    this.app.use(compression());

    // HTTP request logging
    this.app.use(morgan("combined", { stream: { write: (msg) => this.logger.info(msg.trim()) } }));

    // Parse JSON and URL-encoded bodies
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting
    this.app.use(this.rateLimiter.middleware());
  }

  setupServices() {
    this.services = {
      user: new UserService(this.database, this.logger, this.validator),
      product: new ProductService(this.database, this.logger, this.validator),
      order: new OrderService(this.database, this.logger, this.validator),
      notification: new NotificationService(this.io, this.logger),
    };
  }

  setupErrorHandling() {
    // Handle uncaught exceptions
    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught Exception:", error);
      this.gracefulShutdown(1);
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error("Unhandled Rejection at:", promise, "reason:", reason);
      this.gracefulShutdown(1);
    });

    // Handle SIGTERM (e.g., Docker stop)
    process.on("SIGTERM", () => {
      this.logger.info("SIGTERM received, shutting down gracefully");
      this.gracefulShutdown(0);
    });

    // Handle SIGINT (e.g., Ctrl+C)
    process.on("SIGINT", () => {
      this.logger.info("SIGINT received, shutting down gracefully");
      this.gracefulShutdown(0);
    });
  }

  async initialize() {
    try {
      // Connect to database
      await this.database.connect();
      this.logger.info("✅ Database connected successfully");

      // Initialize Telegram Bot
      this.bot = new bot(
        process.env.TELEGRAM_BOT_TOKEN,
        this.services,
        this.logger,
        this.errorHandler
      );
      await this.bot.initialize();
      this.logger.info("✅ Telegram Bot initialized successfully");

      // Setup Socket.IO
      this.setupSocketIO();
      this.logger.info("✅ Socket.IO initialized successfully");

      // Setup API routes
      this.setupRoutes();
      this.logger.info("✅ API routes initialized successfully");

      // Start server
      const PORT = process.env.PORT || 3002;
      this.server.listen(PORT, () => {
        this.logger.info(`🚀 Server running on port ${PORT}`);
        this.logger.info("🤖 Professional E-commerce Bot is ready!");
      });
    } catch (error) {
      this.logger.error("❌ Failed to initialize application:", error);
      process.exit(1);
    }
  }

  setupSocketIO() {
    this.io.on("connection", (socket) => {
      this.logger.info(`Socket connected: ${socket.id}`);

      socket.on("join", (userId) => {
        if (this.validator.isValidUserId(userId)) {
          socket.join(userId);
          this.logger.info(`User ${userId} joined socket room`);
          this.services.notification.sendNotification(userId, {
            type: "connection",
            message: `User ${userId} connected to real-time updates`,
          });
        }
      });

      socket.on("disconnect", () => {
        this.logger.info(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get("/health", (req, res) => {
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || "2.0.0",
        memory: process.memoryUsage(),
      });
    });

    // API routes
    this.app.use("/api/users", require("./src/routes/userRoutes")(this.services));
    this.app.use("/api/products", require("./src/routes/productRoutes")(this.services));
    this.app.use("/api/orders", require("./src/routes/orderRoutes")(this.services));
    this.app.use("/api/notifications", require("./src/routes/notificationRoutes")(this.services));

    // Handle 404
    this.app.use((req, res, next) => {
      res.status(404).json({ error: "Route not found" });
    });

    // Error handling middleware
    this.app.use(this.errorHandler.middleware());
  }

  async gracefulShutdown(exitCode = 0) {
    try {
      this.logger.info("Starting graceful shutdown...");

      // Stop Telegram Bot
      if (this.bot) {
        await this.bot.stop();
        this.logger.info("✅ Telegram Bot stopped");
      }

      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => this.server.close(resolve));
        this.logger.info("✅ HTTP Server closed");
      }

      // Disconnect database
      if (this.database) {
        await this.database.disconnect();
        this.logger.info("✅ Database disconnected");
      }

      this.logger.info("✅ Graceful shutdown completed");
      process.exit(exitCode);
    } catch (error) {
      this.logger.error("❌ Error during graceful shutdown:", error);
      process.exit(1);
    }
  }
}

// Initialize and start the application
const app = new EcommerceBotApplication();
app.initialize().catch((error) => {
  console.error("Failed to start application:", error);
  process.exit(1);
});

module.exports = app;