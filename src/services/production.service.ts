// src/services/production.service.ts

import mongoose from "mongoose";
import BOM from "../models/bom.model";
import ProductionWIP from "../models/wip.model";
import ProductStock from "../models/productStock.model";
import { RawMaterialStock } from "../models/rawMaterials.model";
import { PackagingStock } from "../models/packagingItems.model";
import { calculateConsumption, convertUnit } from "../utils/bomCalculation";

export const productionService = {
  /**
   * ==========================================================
   * 1️⃣ START PRODUCTION (ALWAYS CREATE NEW WIP)
   * ==========================================================
   * - Deduct raw + packaging immediately
   * - Store quantityPerUnit
   */
  async startProduction(payload: {
    productId: string;
    quantity: number;
    factoryId: string;
    userId?: string;
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { productId, quantity, factoryId, userId } = payload;

      const bom = await BOM.findOne({
        productId,
        isActive: true,
      }).session(session);

      if (!bom) throw new Error("Active BOM not found");

      const components = calculateConsumption(bom, quantity);

      const formattedComponents: any[] = [];

      for (const c of components) {
        const StockModel =
          c.itemType === "RawMaterial" ? RawMaterialStock : PackagingStock;

        const idField =
          c.itemType === "RawMaterial" ? "rawMaterialId" : "packagingItemId";

        const stock = await StockModel.findOne({
          [idField]: c.itemId,
          factoryId,
        }).session(session);

        if (!stock) throw new Error(`Stock not found for ${c.itemType}`);

        const requiredQty = convertUnit(
          c.quantity,
          c.unit,
          stock.unit || c.unit,
        );

        if (stock.quantity < requiredQty)
          throw new Error(`Insufficient stock for ${c.itemType}`);

        // 🔥 Deduct immediately
        await StockModel.findOneAndUpdate(
          { [idField]: c.itemId, factoryId },
          { $inc: { quantity: -requiredQty } },
          { session },
        );

        // 🔥 Calculate per-unit quantity
        const quantityPerUnit = requiredQty / quantity;

        formattedComponents.push({
          itemType: c.itemType,
          itemId: c.itemId,
          quantityPerUnit,
          totalConsumedQuantity: requiredQty,
          unit: stock.unit || c.unit,
        });
      }

      const wip = await ProductionWIP.create(
        [
          {
            factoryId,
            productId,
            plannedQuantity: quantity,
            components: formattedComponents,
            createdBy: userId,
            startedBy: userId,
            startedAt: new Date(),
          },
        ],
        { session },
      ).then((res) => res[0]);

      await session.commitTransaction();
      return { success: true, wip };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  /**
   * ==========================================================
   * 2️⃣ COMPLETE PRODUCTION (PARTIAL SUPPORT)
   * ==========================================================
   */
  async completeProduction(payload: {
    wipId: string;
    quantity: number;
    userId?: string;
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { wipId, quantity, userId } = payload;

      const wip = await ProductionWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");

      const remaining = wip.plannedQuantity - wip.finishedProduced;

      if (quantity > remaining) throw new Error("Quantity exceeds planned");

      wip.finishedProduced += quantity;

      if (wip.finishedProduced >= wip.plannedQuantity) {
        wip.status = "COMPLETED";
        wip.completedAt = new Date();
        wip.completedBy = userId;
      }

      await wip.save({ session });

      await session.commitTransaction();
      return { success: true, wip };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  /**
   * ==========================================================
   * 3️⃣ MANUAL CLOSE (FORCE COMPLETE)
   * ==========================================================
   */
  async closeProduction(wipId: string, userId?: string) {
    const wip = await ProductionWIP.findById(wipId);
    if (!wip) throw new Error("WIP not found");

    wip.status = "COMPLETED";
    wip.completedAt = new Date();
    wip.completedBy = userId;

    await wip.save();

    return { success: true, wip };
  },

  /**
   * ==========================================================
   * 4️⃣ TRANSFER FINISHED FACTORY → WAREHOUSE
   * ==========================================================
   */
  async transferToWarehouse(payload: {
    wipId: string;
    warehouseId: string;
    quantity: number;
    userId?: string;
  }) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { wipId, warehouseId, quantity, userId } = payload;

      const wip = await ProductionWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");

      const available = wip.finishedProduced - wip.transferredToWarehouse;

      if (quantity > available)
        throw new Error("Not enough finished goods in factory");

      await ProductStock.findOneAndUpdate(
        { productId: wip.productId, warehouseId },
        {
          $inc: { quantity },
          $setOnInsert: { unit: "pcs" },
        },
        { upsert: true, session },
      );

      wip.transferredToWarehouse += quantity;
      wip.transferredAt = new Date();
      wip.transferredBy = userId;

      await wip.save({ session });

      await session.commitTransaction();
      return { success: true };
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  /**
   * ==========================================================
   * 5️⃣ MATERIALS CURRENTLY INSIDE WIP (CORRECT VERSION)
   * ==========================================================
   * Shows ONLY remaining material not yet converted
   */
  async getMaterialsInWip(factoryId: string) {
    return ProductionWIP.aggregate([
      {
        $match: {
          factoryId: new mongoose.Types.ObjectId(factoryId),
          status: { $in: ["IN_PROGRESS", "COMPLETED"] },
        },
      },
      {
        $addFields: {
          remainingQty: {
            $subtract: ["$plannedQuantity", "$finishedProduced"],
          },
        },
      },
      {
        $match: { remainingQty: { $gt: 0 } }, // 🔥 VERY IMPORTANT
      },
      { $unwind: "$components" },
      {
        $group: {
          _id: {
            itemId: "$components.itemId",
            itemType: "$components.itemType",
          },
          materialInWip: {
            $sum: {
              $multiply: ["$remainingQty", "$components.quantityPerUnit"],
            },
          },
        },
      },
    ]);
  },

  /**
   * ==========================================================
   * 6️⃣ FINISHED GOODS INSIDE FACTORY (NOT TRANSFERRED)
   * ==========================================================
   */
  async getFinishedInFactory(factoryId: string) {
    return ProductionWIP.aggregate([
      {
        $match: {
          factoryId: new mongoose.Types.ObjectId(factoryId),
        },
      },
      {
        $group: {
          _id: "$productId",
          totalFactoryStock: {
            $sum: {
              $subtract: ["$finishedProduced", "$transferredToWarehouse"],
            },
          },
        },
      },
      {
        $match: { totalFactoryStock: { $gt: 0 } },
      },
    ]);
  },

  /**
   * ==========================================================
   * 7️⃣ LIST WIP
   * ==========================================================
   * Supports filtering by:
   * - factoryId
   * - status
   * - search by product
   */
  async listWip(filters: {
    search?: string;
    status?: string;
    factoryId?: string;
  }) {
    const { search, status, factoryId } = filters;

    const query: any = {};

    if (status) query.status = status;
    if (factoryId) query.factoryId = factoryId;

    // 🔥 Build aggregation pipeline for search
    const pipeline: any[] = [
      { $match: query },
      // Join Product
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },

      // Join Factory
      {
        $lookup: {
          from: "warehouseorfactories",
          localField: "factoryId",
          foreignField: "_id",
          as: "factory",
        },
      },
      { $unwind: { path: "$factory", preserveNullAndEmptyArrays: true } },
    ];

    // 🔎 Search by product name / sku
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "product.name": { $regex: search, $options: "i" } },
            { "product.sku": { $regex: search, $options: "i" } },
          ],
        },
      });
    }

    pipeline.push({
      $sort: { createdAt: -1 },
    });

    return ProductionWIP.aggregate(pipeline);
  },
};
