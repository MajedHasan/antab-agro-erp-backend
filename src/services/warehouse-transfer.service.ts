// src/services/warehouse-transfer.service.ts

import mongoose from "mongoose";
import { Types } from "mongoose";
import { createCrudService } from "./crud.service";
import WarehouseTransfer from "../models/warehouse-transfer.model";
import ProductStock from "../models/productStock.model";

/**
 * ==========================================================
 * BASE CRUD
 * ----------------------------------------------------------
 * Gives:
 * - list
 * - getById
 * - update
 * - remove
 * - bulkCreate
 * - bulkDelete
 * ==========================================================
 */
const base = createCrudService(WarehouseTransfer, {
  allowedFilterFields: ["fromWarehouseId", "toWarehouseId", "status"],
  defaultPopulate: [
    { path: "fromWarehouseId" },
    { path: "toWarehouseId" },
    { path: "createdBy", select: "name email" },
    { path: "receivedBy", select: "name email" },
    { path: "approvedBy", select: "name email" },
    {
      path: "items.productId",
      select: "name sku unit salePrice",
    },
  ],
});

/**
 * ==========================================================
 * Helper
 * ==========================================================
 */
function calculateAvailable(stock: any) {
  return (
    (stock?.quantity || 0) +
    (stock?.incomingTransfer || 0) -
    (stock?.reservedForSales || 0) -
    (stock?.reservedForTransfer || 0)
  );
}

/**
 * ==========================================================
 * TRANSFER SERVICE
 * ==========================================================
 */
export const warehouseTransferService = {
  // ✅ Attach CRUD
  ...base,

  /**
   * ==========================================================
   * CREATE
   * ----------------------------------------------------------
   * 1. Validate stock
   * 2. Reserve stock
   * 3. Create transfer
   * ==========================================================
   */
  async create(payload: any) {
    return base.withTransaction(async (session) => {
      const {
        fromWarehouseId,
        toWarehouseId,
        items = [],
        isVirtualTransfer,
      } = payload;

      if (!items.length) {
        throw new Error("Transfer must contain items");
      }

      // ✅ 1. Validate stock FIRST
      for (const item of items) {
        const stock = await ProductStock.findOne({
          productId: item.productId,
          warehouseId: fromWarehouseId,
        }).session(session);

        if (!stock) {
          throw new Error(`Stock not found for product ${item.productId}`);
        }

        const available = calculateAvailable(stock);

        if (available < item.quantity) {
          throw new Error(`Insufficient stock for product ${item.productId}`);
        }
      }

      // ✅ 2. Reserve stock
      for (const item of items) {
        await ProductStock.findOneAndUpdate(
          {
            productId: item.productId,
            warehouseId: fromWarehouseId,
          },
          {
            $inc: { reservedForTransfer: item.quantity },
            $set: { lastUpdated: new Date() },
          },
          { session },
        );

        // Virtual transfer → mark incoming on destination
        if (isVirtualTransfer) {
          await ProductStock.findOneAndUpdate(
            {
              productId: item.productId,
              warehouseId: toWarehouseId,
            },
            {
              $inc: { incomingTransfer: item.quantity },
              $setOnInsert: {
                quantity: 0,
                reservedForSales: 0,
                reservedForTransfer: 0,
              },
            },
            { upsert: true, session },
          );
        }
      }

      // ✅ 3. Create transfer AFTER reservation
      const [transfer] = await WarehouseTransfer.create(
        [
          {
            ...payload,
            status: "CREATED",
            createdAt: new Date(),
          },
        ],
        { session },
      );

      return transfer;
    });
  },

  /**
   * ==========================================================
   * RECEIVE
   * ==========================================================
   */
  async receive(transferId: string, userId: string) {
    return base.withTransaction(async (session) => {
      const transfer =
        await WarehouseTransfer.findById(transferId).session(session);

      if (!transfer) throw new Error("Transfer not found");

      if (transfer.status !== "CREATED") {
        throw new Error("Transfer already processed");
      }

      transfer.status = "RECEIVED_BY_WAREHOUSE";
      transfer.receivedBy = new Types.ObjectId(userId);
      transfer.receivedAt = new Date();

      await transfer.save({ session });

      return transfer;
    });
  },

  /**
   * ==========================================================
   * FINAL APPROVE
   * ==========================================================
   */
  async finalApprove(transferId: string, userId: string) {
    return base.withTransaction(async (session) => {
      const transfer =
        await WarehouseTransfer.findById(transferId).session(session);

      if (!transfer) throw new Error("Transfer not found");

      if (transfer.status !== "RECEIVED_BY_WAREHOUSE") {
        throw new Error("Transfer must be received first");
      }

      for (const item of transfer.items) {
        const qty = item.quantity;

        // ✅ Check source again for safety
        const sourceStock = await ProductStock.findOne({
          productId: item.productId,
          warehouseId: transfer.fromWarehouseId,
        }).session(session);

        if (!sourceStock) {
          throw new Error("Source stock not found");
        }

        if (sourceStock.quantity < qty) {
          throw new Error(
            `Insufficient physical stock for product ${item.productId}`,
          );
        }

        // ✅ Deduct from source
        await ProductStock.findOneAndUpdate(
          {
            productId: item.productId,
            warehouseId: transfer.fromWarehouseId,
          },
          {
            $inc: {
              quantity: -qty,
              reservedForTransfer: -qty,
            },
          },
          { session },
        );

        // ✅ Add to destination
        await ProductStock.findOneAndUpdate(
          {
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
          },
          {
            $inc: {
              quantity: qty,
              incomingTransfer: -qty,
            },
            $setOnInsert: {
              reservedForSales: 0,
              reservedForTransfer: 0,
            },
          },
          { upsert: true, session },
        );
      }

      transfer.status = "FINAL_APPROVED";
      transfer.approvedBy = new Types.ObjectId(userId);
      transfer.approvedAt = new Date();

      await transfer.save({ session });

      return transfer;
    });
  },

  /**
   * ==========================================================
   * CANCEL
   * ==========================================================
   */
  async cancel(transferId: string, userId: string) {
    return base.withTransaction(async (session) => {
      const transfer =
        await WarehouseTransfer.findById(transferId).session(session);

      if (!transfer) throw new Error("Transfer not found");

      if (transfer.status === "FINAL_APPROVED") {
        throw new Error("Cannot cancel after final approval");
      }

      for (const item of transfer.items) {
        await ProductStock.findOneAndUpdate(
          {
            productId: item.productId,
            warehouseId: transfer.fromWarehouseId,
          },
          {
            $inc: { reservedForTransfer: -item.quantity },
          },
          { session },
        );

        if (transfer.isVirtualTransfer) {
          await ProductStock.findOneAndUpdate(
            {
              productId: item.productId,
              warehouseId: transfer.toWarehouseId,
            },
            {
              $inc: { incomingTransfer: -item.quantity },
            },
            { session },
          );
        }
      }

      transfer.status = "CANCELLED";
      transfer.cancelledBy = new Types.ObjectId(userId);
      transfer.cancelledAt = new Date();

      await transfer.save({ session });

      return transfer;
    });
  },
};
