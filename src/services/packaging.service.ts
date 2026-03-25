// src/services/packaging.service.ts

import mongoose from "mongoose";
import { createCrudService } from "./crud.service";
import PackagingItem from "../models/packagingItems.model";
import { accountService } from "./account.service";
import { PackagingStock } from "../models/packagingItems.model";

const base = createCrudService(PackagingItem, {
  searchFields: ["name", "sku"],
  allowedFilterFields: ["isReusable", "isActive"],
});

export const packagingService = {
  ...base,

  /**
   * ==========================================================
   * CREATE PACKAGING ITEM
   * ==========================================================
   */
  async create(payload: any) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const item = await base.create(payload, { session });

      const account = await accountService.createAutoAccountForEntity(
        {
          entityType: "Product",
          entityId: item._id.toString(),
          name: item.name,
          productCategory: "Packaging",
        },
        { session },
      );

      await PackagingItem.findByIdAndUpdate(
        item._id,
        { $set: { accountId: account._id } },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return await PackagingItem.findById(item._id).lean();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  },

  /**
   * ==========================================================
   * UPDATE PACKAGING
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
    const stock = await PackagingStock.findOne({
      packagingItemId: id,
      quantity: { $gt: 0 },
    });

    if (stock) {
      throw new Error("Cannot delete packaging item with stock");
    }

    return base.remove(id, options);
  },
};
