// src/services/otherProduct.service.ts

import mongoose from "mongoose";
import { createCrudService } from "./crud.service";
import OtherProducts from "../models/otherProducts.model";
import { accountService } from "./account.service";
import { OtherProductStock } from "../models/otherProducts.model";

const base = createCrudService(OtherProducts, {
  searchFields: ["name", "sku"],
  allowedFilterFields: ["isReusable", "isActive"],
});

export const otherProductService = {
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

      //   const account = await accountService.createAutoAccountForEntity(
      //     {
      //       entityType: "Product",
      //       entityId: item._id.toString(),
      //       name: item.name,
      //       productCategory: "OtherProduct",
      //     },
      //     { session },
      //   );

      const itemOfOtherGoodsAcc = await accountService.getAccountByPath(
        ["Assets", "Current Assets", "Inventory", "Other Goods", item.name],
        "Asset",
        { session },
      );

      await OtherProducts.findByIdAndUpdate(
        item._id,
        { $set: { accountId: itemOfOtherGoodsAcc._id } },
        { session },
      );

      await session.commitTransaction();
      session.endSession();

      return await OtherProducts.findById(item._id).lean();
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
        entityId: updated?.accountId,
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
    const stock = await OtherProductStock.findOne({
      otherProductId: id,
      quantity: { $gt: 0 },
    });

    if (stock) {
      throw new Error("Cannot delete packaging item with stock");
    }

    return base.remove(id, options);
  },
};
