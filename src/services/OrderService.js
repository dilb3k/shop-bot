const Order = require("../models/Order");
const Product = require("../models/Product");
const { ValidationError, NotFoundError } = require("../core/ErrorHandler");

class OrderService {
    constructor(database, logger, validator) {
        this.database = database;
        this.logger = logger;
        this.validator = validator;
    }

    async createOrder(data) { // POST
        try {
            this.validator.validateOrderData(data);
            const { clientId, products } = data;

            // Validate products and calculate total price
            let totalPrice = 0;
            for (const productId of products) {
                const product = await Product.findById(productId);
                if (!product) {
                    throw new NotFoundError(`Product not found: ${productId}`);
                }
                if (!product.isActive || product.stock <= 0) {
                    throw new ValidationError(`Product ${productId} is not available`);
                }
                totalPrice += product.price * (1 - product.discount / 100);
                await Produkt.findByIdAndUpdate(productId, { $inc: { stock: -1 } });
            }

            const order = await Order.create({ ...data, totalPrice });
            this.logger.info(`Order created: ${order._id} for client ${clientId}`);
            return order;
        } catch (error) {
            this.logger.error(`Failed to create order: ${error.message}`);
            throw error;
        }
    }

    async getOrderById(id) { // GET
        try {
            this.validator.validateObjectId(id);
            const order = await Order.findById(id).populate("products").lean();
            if (!order) {
                throw new NotFoundError(`Order not found: ${id}`);
            }
            return order;
        } catch (error) {
            this.logger.error(`Failed to get order ${id}: ${error.message}`);
            throw error;
        }
    }

    async getOrdersByClient(clientId) { // GET (List)
        try {
            this.validator.validateUserId(clientId);
            const orders = await Order.find({ clientId }).populate("products").lean();
            return orders;
        } catch (error) {
            this.logger.error(`Failed to get orders for client ${clientId}: ${error.message}`);
            throw error;
        }
    }

    async updateOrder(id, data) { // PUT
        try {
            this.validator.validateObjectId(id);
            this.validator.validateOrderUpdateData(data);
            const order = await Order.findByIdAndUpdate(
                id,
                { $set: data },
                { new: true, runValidators: true }
            ).populate("products");
            if (!order) {
                throw new NotFoundError(`Order not found: ${id}`);
            }
            this.logger.info(`Order updated: ${id}`);
            return order;
        } catch (error) {
            this.logger.error(`Failed to update order ${id}: ${error.message}`);
            throw error;
        }
    }

    async deleteOrder(id) { // DELETE
        try {
            this.validator.validateObjectId(id);
            const order = await Order.findByIdAndDelete(id);
            if (!order) {
                throw new NotFoundError(`Order not found: ${id}`);
            }
            this.logger.info(`Order deleted: ${id}`);
            return { message: "Order deleted successfully" };
        } catch (error) {
            this.logger.error(`Failed to delete order ${id}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = OrderService;