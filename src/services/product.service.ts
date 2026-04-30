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

  async list(params: any = {}) {
    console.log("Params: ", params);

    // read locationType from params or params.filter
    const locationTypeRaw = params.locationType || params.filter?.locationType;
    const normalizedType =
      locationTypeRaw?.toLowerCase() === "factory"
        ? "Factory"
        : locationTypeRaw?.toLowerCase() === "warehouse"
          ? "Warehouse"
          : locationTypeRaw; // could be "All" or undefined

    // fetch product list using base CRUD
    const baseResult = await base.list(params);

    // get product IDs
    const productIds = baseResult.data.map((p: any) => p._id);

    // if "All" or no locationType → include all stocks
    const match: any = {
      productId: { $in: productIds },
    };

    if (normalizedType && normalizedType !== "All") {
      match["warehouse.type"] = {
        $regex: `^${normalizedType}$`,
        $options: "i",
      };
    }

    // fetch stock totals
    const stocks = await ProductStock.aggregate([
      {
        $lookup: {
          from: "warehouseorfactories",
          localField: "warehouseId",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      { $unwind: "$warehouse" },
      { $match: match },
      {
        $group: {
          _id: "$productId",
          totalStock: { $sum: "$quantity" },
        },
      },
    ]);

    const stockMap = new Map(stocks.map((s) => [String(s._id), s.totalStock]));

    // update product list with filtered stock totals
    baseResult.data = baseResult.data.map((p: any) => ({
      ...p,
      stock: stockMap.get(String(p._id)) || 0,
    }));

    return baseResult;
  },

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
      const account = await accountService.getAccountByPath(
        [
          "Assets",
          "Current Assets",
          "Inventory",
          "Finished Goods",
          product.name,
        ],
        "Assets",
        { session },
      );

      // const account = await accountService.createAutoAccountForEntity(
      //   {
      //     entityType: "Product",
      //     entityId: product._id.toString(),
      //     name: product.name,
      //     productCategory: "Finished", // FIXED for this service
      //   },
      //   { session },
      // );

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
