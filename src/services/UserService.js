const User = require("../models/User");
const { ValidationError, NotFoundError } = require("../core/ErrorHandler");

class UserService {
    constructor(database, logger, validator) {
        this.database = database;
        this.logger = logger;
        this.validator = validator;
    }

    async createUser(data) { // POST
        try {
            this.validator.validateUserData(data);
            const user = await User.create(data);
            this.logger.info(`User created: ${user.telegramId}`);
            return user;
        } catch (error) {
            this.logger.error(`Failed to create user: ${error.message}`);
            throw new ValidationError(`Invalid user data: ${error.message}`);
        }
    }

    async getUserById(telegramId) { // GET
        try {
            const user = await User.findOne({ telegramId })
                .populate("cart")
                .lean();
            if (!user) {
                throw new NotFoundError(`User not found: ${telegramId}`);
            }
            return user;
        } catch (error) {
            this.logger.error(`Failed to get user ${telegramId}: ${error.message}`);
            throw error;
        }
    }

    async updateUser(telegramId, data) { // PUT
        try {
            this.validator.validateUserUpdateData(data);
            const user = await User.findOneAndUpdate(
                { telegramId },
                { $set: data },
                { new: true, runValidators: true }
            ).lean();
            if (!user) {
                throw new NotFoundError(`User not found: ${telegramId}`);
            }
            this.logger.info(`User updated: ${telegramId}`);
            return user;
        } catch (error) {
            this.logger.error(`Failed to update user ${telegramId}: ${error.message}`);
            throw error;
        }
    }

    async deleteUser(telegramId) { // DELETE
        try {
            const user = await User.findOneAndDelete({ telegramId });
            if (!user) {
                throw new NotFoundError(`User not found: ${telegramId}`);
            }
            this.logger.info(`User deleted: ${telegramId}`);
            return { message: "User deleted successfully" };
        } catch (error) {
            this.logger.error(`Failed to delete user ${telegramId}: ${error.message}`);
            throw error;
        }
    }

    async addToCart(telegramId, productId) {
        try {
            this.validator.validateObjectId(productId);
            const user = await User.findOneAndUpdate(
                { telegramId },
                { $addToSet: { cart: productId } },
                { new: true }
            ).populate("cart");
            if (!user) {
                throw new NotFoundError(`User not found: ${telegramId}`);
            }
            this.logger.info(`Product ${productId} added to cart for user ${telegramId}`);
            return user.cart;
        } catch (error) {
            this.logger.error(`Failed to add product to cart: ${error.message}`);
            throw error;
        }
    }

    async removeFromCart(telegramId, productId) {
        try {
            this.validator.validateObjectId(productId);
            const user = await User.findOneAndUpdate(
                { telegramId },
                { $pull: { cart: productId } },
                { new: true }
            ).populate("cart");
            if (!user) {
                throw new NotFoundError(`User not found: ${telegramId}`);
            }
            this.logger.info(`Product ${productId} removed from cart for user ${telegramId}`);
            return user.cart;
        } catch (error) {
            this.logger.error(`Failed to remove product from cart: ${error.message}`);
            throw error;
        }
    }
}

module.exports = UserService;
