// src/services/production.ts
import mongoose from "mongoose";
import BOM from "../models/bom.model";
import { RawMaterialStock } from "../models/rawMaterials.model";
import { PackagingStock } from "../models/packagingItems.model";
import ProductStock from "../models/productStock.model";
import { calculateConsumption } from "../utils/bomCalculation";

export async function produceProductTransactional(
  productId,
  qty,
  warehouseId,
  factoryId
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const bom = await BOM.findOne({ productId, isActive: true }).session(
      session
    );
    if (!bom) throw new Error("BOM not found");

    const components = calculateConsumption(bom, qty);

    // check stock
    for (const c of components) {
      if (c.itemType === "RawMaterial") {
        const stock = await RawMaterialStock.findOne({
          rawMaterialId: c.itemId,
          factoryId,
        }).session(session);
        if (!stock || stock.quantity < c.quantity)
          throw new Error("Insufficient RM");
      } else {
        const stock = await PackagingStock.findOne({
          packagingItemId: c.itemId,
          factoryId,
        }).session(session);
        if (!stock || stock.quantity < c.quantity)
          throw new Error("Insufficient Packaging");
      }
    }

    // deduct stock
    for (const c of components) {
      if (c.itemType === "RawMaterial") {
        await RawMaterialStock.findOneAndUpdate(
          { rawMaterialId: c.itemId, factoryId },
          {
            $inc: { quantity: -c.quantity },
            $set: { lastUpdated: new Date() },
          },
          { session }
        );
      } else {
        await PackagingStock.findOneAndUpdate(
          { packagingItemId: c.itemId, factoryId },
          {
            $inc: { quantity: -c.quantity },
            $set: { lastUpdated: new Date() },
          },
          { session }
        );
      }
    }

    // add finished product to warehouse
    await ProductStock.findOneAndUpdate(
      { productId, warehouseId },
      { $inc: { quantity: qty }, $set: { lastUpdated: new Date() } },
      { upsert: true, session }
    );

    await session.commitTransaction();
    session.endSession();
    return true;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}
