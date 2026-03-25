// src/services/product.service.ts

import mongoose from "mongoose";
import { createCrudService } from "./crud.service";
import Product from "../models/product.model";
import { accountService } from "./account.service";
import ProductStock from "../models/productStock.model";

const base = createCrudService(Product, {
  searchFields: ["name", "sku", "barcode"],
  allowedFilterFields: ["status"],
});

export const productService = {
  ...base,

  /**
   * ==========================================================
   * CREATE FINISHED PRODUCT
   * ==========================================================
   *
   * - Creates product
   * - Creates ledger account under Finished Goods
   * - Saves accountId inside product
   * - Transaction safe
   */
  async create(payload: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1️⃣ Create Product
      const product = await base.create(payload, { session });

      // 2️⃣ Create Ledger Account (ALWAYS Finished Goods)
      const account = await accountService.createAutoAccountForEntity(
        {
          entityType: "Product",
          entityId: product._id.toString(),
          name: product.name,
          productCategory: "Finished", // FIXED for this service
        },
        { session },
      );

      // 3️⃣ Attach accountId to product
      await Product.findByIdAndUpdate(
        product._id,
        { $set: { accountId: account._id } },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return await Product.findById(product._id).lean();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  },

  /**
   * ==========================================================
   * UPDATE PRODUCT
   * ==========================================================
   *
   * - Sync ledger name if product name changes
   */
  async update(id: string, payload: any) {
    const updated = await base.update(id, payload);

    if (updated?.accountId) {
      await accountService.syncAccountNameForEntity({
        entityType: "Product",
        entityId: id,
        newName: updated.name,
      });
    }

    return updated;
  },

  /**
   * ==========================================================
   * DELETE PRODUCT
   * ==========================================================
   *
   * - Block deletion if stock exists
   */
  async remove(id: string, options?: any) {
    const existingStock = await ProductStock.findOne({
      productId: id,
      $or: [
        { quantity: { $gt: 0 } },
        { reservedForSales: { $gt: 0 } },
        { reservedForTransfer: { $gt: 0 } },
        { incomingTransfer: { $gt: 0 } },
      ],
    });

    if (existingStock) {
      throw new Error(
        "Cannot delete product with active stock or reservations",
      );
    }

    return base.remove(id, options);
  },
};
