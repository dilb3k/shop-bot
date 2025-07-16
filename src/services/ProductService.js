const Product = require("../models/Product");
const { ValidationError, NotFoundError } = require("../core/ErrorHandler");

class ProductService {
    constructor(database, logger, validator) {
        this.database = database;
        this.logger = logger;
        this.validator = validator;
    }

    async createProduct(data) { // POST
        try {
            this.validator.validateProductData(data);
            const product = await Product.create(data);
            this.logger.info(`Product created: ${product._id}`);
            return product;
        } catch (error) {
            this.logger.error(`Failed to create product: ${error.message}`);
            throw new ValidationError(`Invalid product data: ${error.message}`);
        }
    }

    async getProductById(id) { // GET
        try {
            this.validator.validateObjectId(id);
            const product = await Product.findById(id).lean();
            if (!product) {
                throw new NotFoundError(`Product not found: ${id}`);
            }
            return product;
        } catch (error) {
            this.logger.error(`Failed to get product ${id}: ${error.message}`);
            throw error;
        }
    }

    async getProducts(query = {}) { // GET (List)
        try {
            const { category, minPrice, maxPrice, sortBy = "createdAt", order = "desc" } = query;
            const filter = {};
            if (category) filter.category = category;
            if (minPrice) filter.price = { $gte: minPrice };
            if (maxPrice) filter.price = { ...filter.price, $lte: maxPrice };

            const products = await Product.find(filter)
                .sort({ [sortBy]: order === "desc" ? -1 : 1 })
                .lean();
            return products;
        } catch (error) {
            this.logger.error(`Failed to get products: ${error.message}`);
            throw error;
        }
    }

    async updateProduct(id, data) { // PUT
        try {
            this.validator.validateObjectId(id);
            this.validator.validateProductUpdateData(data);
            const product = await Product.findByIdAndUpdate(
                id,
                { $set: data },
                { new: true, runValidators: true }
            ).lean();
            if (!product) {
                throw new NotFoundError(`Product not found: ${id}`);
            }
            this.logger.info(`Product updated: ${id}`);
            return product;
        } catch (error) {
            this.logger.error(`Failed to update product ${id}: ${error.message}`);
            throw error;
        }
    }

    async deleteProduct(id) { // DELETE
        try {
            this.validator.validateObjectId(id);
            const product = await Product.findByIdAndDelete(id);
            if (!product) {
                throw new NotFoundError(`Product not found: ${id}`);
            }
            this.logger.info(`Product deleted: ${id}`);
            return { message: "Product deleted successfully" };
        } catch (error) {
            this.logger.error(`Failed to delete product ${id}: ${error.message}`);
            throw error;
        }
    }

    async addComment(id, commentData) {
        try {
            this.validator.validateObjectId(id);
            this.validator.validateCommentData(commentData);
            const product = await Product.findByIdAndUpdate(
                id,
                { $push: { comments: commentData } },
                { new: true }
            );
            if (!product) {
                throw new NotFoundError(`Product not found: ${id}`);
            }
            this.logger.info(`Comment added to product ${id}`);
            return product.comments;
        } catch (error) {
            this.logger.error(`Failed to add comment to product ${id}: ${error.message}`);
            throw error;
        }
    }

    async likeProduct(id, userId) {
        try {
            this.validator.validateObjectId(id);
            this.validator.validateUserId(userId);
            const product = await Product.findByIdAndUpdate(
                id,
                { $addToSet: { likes: userId } },
                { new: true }
            );
            if (!product) {
                throw new NotFoundError(`Product not found: ${id}`);
            }
            this.logger.info(`User ${userId} liked product ${id}`);
            return product.likes;
        } catch (error) {
            this.logger.error(`Failed to like product ${id}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = ProductService;