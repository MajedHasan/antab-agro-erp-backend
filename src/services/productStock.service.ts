// src/services/product-stock.service.ts

import { createCrudService } from "./crud.service";
import ProductStock from "../models/productStock.model";
import mongoose from "mongoose";

const base = createCrudService(ProductStock, {
  allowedFilterFields: ["productId", "warehouseId"],
  defaultPopulate: ["productId", "warehouseId"],
});

export const productStockService = {
  ...base,

  async list(params: any = {}) {
    let { page = 1, limit = 15 } = params;

    // ✅ FIX: extract properly
    let locationType = params.locationType || params.filter?.locationType;
    let warehouseId = params.warehouseId || params.filter?.warehouseId;

    const productId = params.filter?.productId;

    // cleanup
    if (params.filter?.locationType) {
      delete params.filter.locationType;
    }
    if (params.filter?.warehouseId) {
      delete params.filter.warehouseId;
    }

    console.log("WarehouseID: ", warehouseId);

    const skip = (page - 1) * limit;

    const pipeline: any[] = [];

    // ✅ filter by productId FIRST
    if (productId) {
      pipeline.push({
        $match: {
          productId: new mongoose.Types.ObjectId(productId),
        },
      });
    }
    // ✅ filter by warehouseId FIRST
    if (warehouseId) {
      pipeline.push({
        $match: {
          warehouseId: new mongoose.Types.ObjectId(warehouseId),
        },
      });
    }

    // join warehouse
    pipeline.push(
      {
        $lookup: {
          from: "warehouseorfactories",
          localField: "warehouseId",
          foreignField: "_id",
          as: "warehouse",
        },
      },
      { $unwind: "$warehouse" },
    );

    // ✅ location filter
    if (locationType && locationType !== "All") {
      pipeline.push({
        $match: {
          $expr: {
            $eq: [{ $toLower: "$warehouse.type" }, locationType.toLowerCase()],
          },
        },
      });
    }

    // join product
    pipeline.push(
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "productId",
        },
      },
      { $unwind: "$productId" },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    );

    const res = await ProductStock.aggregate(pipeline);

    return {
      data: res[0]?.data || [],
      total: res[0]?.total?.[0]?.count || 0,
      page,
      limit,
    };
  },

  /**
   * ==========================================================
   * Reserve Stock For Sales
   * ==========================================================
   */
  async reserveForSales(
    productId: string,
    warehouseId: string,
    qty: number,
    session?: any,
  ) {
    const stock = await ProductStock.findOne({
      productId,
      warehouseId,
    }).session(session);

    if (!stock) throw new Error("Stock not found");

    const available =
      stock.quantity +
      stock.incomingTransfer -
      stock.reservedForSales -
      stock.reservedForTransfer;

    if (available < qty) {
      throw new Error("Not enough stock to reserve");
    }

    stock.reservedForSales += qty;
    stock.lastUpdated = new Date();

    await stock.save({ session });

    return stock;
  },

  /**
   * ==========================================================
   * Release Sales Reservation
   * ==========================================================
   */
  async releaseSalesReservation(
    productId: string,
    warehouseId: string,
    qty: number,
    session?: any,
  ) {
    const stock = await ProductStock.findOne({
      productId,
      warehouseId,
    }).session(session);

    if (!stock) return;

    stock.reservedForSales = Math.max(0, stock.reservedForSales - qty);

    stock.lastUpdated = new Date();
    await stock.save({ session });

    return stock;
  },

  /**
   * ==========================================================
   * Final Delivery — Physically Reduce Stock
   * ==========================================================
   */
  async deductPhysical(
    productId: string,
    warehouseId: string,
    qty: number,
    session?: any,
  ) {
    const stock = await ProductStock.findOne({
      productId,
      warehouseId,
    }).session(session);

    if (!stock) throw new Error("Stock not found");

    if (stock.quantity < qty) {
      throw new Error("Insufficient physical stock");
    }

    stock.quantity -= qty;
    stock.reservedForSales = Math.max(0, stock.reservedForSales - qty);

    stock.lastUpdated = new Date();

    await stock.save({ session });

    return stock;
  },
};
