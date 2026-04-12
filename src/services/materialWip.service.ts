import mongoose from "mongoose";
import MaterialWIP from "../models/materialWip.model";
import BOM from "../models/bom.model";
import ProductStock from "../models/productStock.model";
import { RawMaterialStock } from "../models/rawMaterials.model";
import { PackagingStock } from "../models/packagingItems.model";
import { calculateConsumption, convertUnit } from "../utils/bomCalculation";

export const materialWipService = {
  /**
   * ==========================================================
   * 1️⃣ START MATERIAL WIP
   * ==========================================================
   */
  async startWip({ rawMaterialId, quantity, factoryId, userId }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 🔒 Check existing active WIP
      const existing = await MaterialWIP.findOne({
        rawMaterialId,
        factoryId,
        status: "ACTIVE",
      }).session(session);

      if (existing) {
        throw new Error("This raw material is already in active WIP");
      }

      const stock = await RawMaterialStock.findOne({
        rawMaterialId,
        factoryId,
      }).session(session);

      if (!stock) throw new Error("Stock not found");

      if (stock.quantity < quantity)
        throw new Error("Insufficient raw material stock");

      // 🔥 Deduct stock
      await RawMaterialStock.updateOne(
        { rawMaterialId, factoryId },
        { $inc: { quantity: -quantity } },
        { session },
      );

      const wip = await MaterialWIP.create(
        [
          {
            rawMaterialId,
            factoryId,
            initialQuantity: quantity,
            remainingQuantity: quantity,
            unit: stock.unit,
            createdBy: userId,
          },
        ],
        { session },
      );

      await session.commitTransaction();
      return wip[0];
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  /**
   * ==========================================================
   * 2️⃣ GET PRODUCTS POSSIBLE FROM MATERIAL
   * ==========================================================
   */
  async getPossibleProducts(rawMaterialId: string) {
    return BOM.find({
      "components.itemId": rawMaterialId,
      isActive: true,
    }).populate("productId");
  },

  /**
   * ==========================================================
   * 3️⃣ CONVERT MATERIAL → PRODUCT
   * ==========================================================
   */
  async convertToProduct({
    wipId,
    factoryId,
    products,
    remainingRawQuantity,
  }: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const wip = await MaterialWIP.findById(wipId).session(session);
      if (!wip) throw new Error("WIP not found");

      if (wip.status !== "ACTIVE") throw new Error("WIP already completed");

      // validate, do not trust client factoryId
      if (String(factoryId) !== String(wip.factoryId)) {
        throw new Error("Factory mismatch");
      }

      // 🔒 MUST have products
      if (!products || products.length === 0) {
        throw new Error("At least one product is required");
      }

      // 🔒 MUST have remaining
      if (remainingRawQuantity === undefined || remainingRawQuantity === null) {
        throw new Error("Remaining raw quantity is required");
      }

      let expectedRawUsed = 0;
      const otherMaterials: any[] = [];

      for (const p of products) {
        const qty = Number(p.quantityProduced);

        if (isNaN(qty) || qty <= 0) {
          throw new Error("Invalid product quantity");
        }

        const bom = await BOM.findOne({
          productId: p.productId,
          isActive: true,
        }).session(session);

        if (!bom) throw new Error("BOM not found");

        const components = calculateConsumption(bom, qty);

        for (const c of components) {
          const compQty = Number(c.quantity);

          if (isNaN(compQty) || compQty <= 0) {
            throw new Error("Invalid component quantity");
          }

          if (String(c.itemId) === String(wip.rawMaterialId)) {
            const converted = convertUnit(compQty, c.unit, wip.unit);

            if (isNaN(converted)) {
              throw new Error("Unit conversion failed");
            }

            expectedRawUsed += converted;
            continue;
          }

          const StockModel =
            c.itemType === "RawMaterial" ? RawMaterialStock : PackagingStock;

          const idField =
            c.itemType === "RawMaterial" ? "rawMaterialId" : "packagingItemId";

          const stock = await StockModel.findOne({
            [idField]: c.itemId,
            factoryId,
          }).session(session);

          if (!stock) throw new Error(`${c.itemType} stock not found`);

          if (stock.quantity < compQty) {
            throw new Error(`Shortage of ${c.itemType}`);
          }

          await StockModel.updateOne(
            { [idField]: c.itemId, factoryId },
            { $inc: { quantity: -compQty } },
            { session },
          );

          otherMaterials.push({
            itemType: c.itemType,
            itemId: c.itemId,
            quantity: compQty,
            unit: stock.unit,
          });
        }

        await ProductStock.findOneAndUpdate(
          { productId: p.productId, warehouseId: factoryId },
          { $inc: { quantity: qty } },
          { upsert: true, session },
        );
      }

      const remaining = Number(remainingRawQuantity);

      if (isNaN(remaining)) {
        throw new Error("Invalid remaining raw quantity");
      }

      if (remaining < 0) {
        throw new Error("Remaining quantity cannot be negative");
      }

      // 🔒 Prevent remaining > initial stock
      if (remaining > wip.initialQuantity) {
        throw new Error("Remaining cannot exceed initial quantity");
      }

      // 🔒 Prevent no-production case
      if (remaining === wip.initialQuantity) {
        throw new Error("No production done. Remaining equals initial.");
      }

      const actualUsed = wip.initialQuantity - remaining;

      if (actualUsed <= 0) {
        throw new Error("No material consumed. Check your input.");
      }

      const round = (n: number) => Number(n.toFixed(6));

      // NOTE: variance is ONLY for analytics, NOT inventory adjustment, as inventory is adjusted based on actual used and not expected used
      const variance = round(round(actualUsed) - round(expectedRawUsed));

      let varianceType: "GAIN" | "LOSS" | "PERFECT" = "PERFECT";
      if (variance > 0) varianceType = "LOSS";
      else if (variance < 0) varianceType = "GAIN";

      // if (variance < 0) {
      //   await RawMaterialStock.updateOne(
      //     { rawMaterialId: wip.rawMaterialId, factoryId },
      //     { $inc: { quantity: Math.abs(variance) } },
      //     { session },
      //   );
      // }

      // ONLY return physical remaining stock
      await RawMaterialStock.updateOne(
        { rawMaterialId: wip.rawMaterialId, factoryId },
        { $inc: { quantity: remaining } },
        { session },
      );

      wip.remainingQuantity = remaining;

      // 🔥 ALWAYS COMPLETE AFTER CONVERSION
      wip.status = "COMPLETED";
      wip.completedAt = new Date();

      wip.conversions.push({
        products,
        expectedRawUsed,
        actualRawUsed: actualUsed,
        variance,
        varianceType,
        otherMaterialsUsed: otherMaterials,
      });

      await wip.save({ session });

      await session.commitTransaction();
      return wip;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  /**
   * ==========================================================
   * 4️⃣ COMPLETE MANUALLY
   * ==========================================================
   */
  async completeWip(wipId: string) {
    const wip = await MaterialWIP.findById(wipId);
    if (!wip) throw new Error("WIP not found");

    wip.status = "COMPLETED";
    wip.completedAt = new Date();

    await wip.save();
    return wip;
  },

  /**
   * ==========================================================
   * 5️⃣ LIST WIP
   * ==========================================================
   */
  async listWip({ factoryId, status }: any) {
    const filter: any = {};
    if (factoryId) filter.factoryId = factoryId;
    if (status) filter.status = status;

    return MaterialWIP.find(filter)
      .populate("rawMaterialId")
      .sort({ createdAt: -1 });
  },
};
