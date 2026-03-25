// src/services/product-stock.service.ts

import { createCrudService } from "./crud.service";
import ProductStock from "../models/productStock.model";

const base = createCrudService(ProductStock, {
  allowedFilterFields: ["productId", "warehouseId"],
  defaultPopulate: ["productId", "warehouseId"],
});

export const productStockService = {
  ...base,

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
