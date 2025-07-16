class NotificationService {
    constructor(io, logger) {
        this.io = io;
        this.logger = logger;
    }

    sendNotification(userId, notification) {
        try {
            this.io.to(userId).emit("notification", {
                ...notification,
                timestamp: new Date().toISOString(),
            });
            this.logger.info(`Notification sent to user ${userId}: ${notification.type}`);
        } catch (error) {
            this.logger.error(`Failed to send notification to ${userId}: ${error.message}`);
            throw error;
        }
    }

    async sendOrderUpdate(clientId, orderId, status) {
        try {
            const notification = {
                type: "order_update",
                message: `Your order ${orderId} is now ${status}`,
                orderId,
                status,
            };
            this.sendNotification(clientId, notification);
        } catch (error) {
            this.logger.error(`Failed to send order update to ${clientId}: ${error.message}`);
            throw error;
        }
    }

    async sendProductUpdate(userId, productId, message) {
        try {
            const notification = {
                type: "product_update",
                message,
                productId,
            };
            this.sendNotification(userId, notification);
        } catch (error) {
            this.logger.error(`Failed to send product update to ${userId}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = NotificationService;