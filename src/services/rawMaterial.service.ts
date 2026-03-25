// src/services/rawMaterial.service.ts

import mongoose from "mongoose";
import { createCrudService } from "./crud.service";
import RawMaterial from "../models/rawMaterials.model";
import { accountService } from "./account.service";
import { RawMaterialStock } from "../models/rawMaterials.model";

const base = createCrudService(RawMaterial, {
  searchFields: ["name", "sku", "category"],
  allowedFilterFields: ["category", "isActive"],
});

export const rawMaterialService = {
  ...base,

  /**
   * ==========================================================
   * CREATE RAW MATERIAL
   * ==========================================================
   */
  async create(payload: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1️⃣ Create Raw Material
      const raw = await base.create(payload, { session });

      // 2️⃣ Create Ledger Account
      const account = await accountService.createAutoAccountForEntity(
        {
          entityType: "Product",
          entityId: raw._id.toString(),
          name: raw.name,
          productCategory: "Raw",
        },
        { session },
      );

      // 3️⃣ Attach accountId
      await RawMaterial.findByIdAndUpdate(
        raw._id,
        { $set: { accountId: account._id } },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return await RawMaterial.findById(raw._id).lean();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  },

  /**
   * ==========================================================
   * UPDATE RAW MATERIAL
   * ==========================================================
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
   * DELETE PROTECTION
   * ==========================================================
   */
  async remove(id: string, options?: any) {
    const stock = await RawMaterialStock.findOne({
      rawMaterialId: id,
      quantity: { $gt: 0 },
    });

    if (stock) {
      throw new Error("Cannot delete raw material with stock");
    }

    return base.remove(id, options);
  },
};
