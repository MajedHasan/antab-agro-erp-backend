import { StockTransaction } from "./stockTransaction.model";
import { ClientSession } from "mongoose";

export type CostMethod = "FIFO" | "LIFO";

const COST_BEARING_TRANSACTIONS = [
  "purchase",
  "production_return",
  "transfer_in",
  "production",
  "return"
];

export const inventoryCostService = {
  /**
   * Automatic consumption using FIFO or LIFO.
   * Deducts from `remainingQuantity` and returns batch details + total cost.
   */
  async consume(
    itemType: string,
    itemId: string,
    locationId: string,
    quantityToConsume: number,
    method: CostMethod,
    session?: ClientSession,
  ) {
    let remaining = quantityToConsume;
    const consumedBatches: any[] = [];
    const sortDir = method === "FIFO" ? 1 : -1;

    const transactions = await StockTransaction.find({
      itemType,
      itemId,
      locationId,
      transactionType: { $in: COST_BEARING_TRANSACTIONS },
      remainingQuantity: { $gt: 0 },
    })
      .sort({ transactionDate: sortDir })
      .session(session ?? null)
      .exec();

    for (const tx of transactions) {
      if (remaining <= 0) break;
      const take = Math.min(tx.remainingQuantity, remaining);
      tx.remainingQuantity -= take;
      await tx.save({ session });

      consumedBatches.push({
        transactionId: tx._id,
        quantity: take,
        unitCost: tx.unitCost,
        totalCost: Math.round(take * tx.unitCost * 100) / 100,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      throw new Error(
        `Insufficient stock for ${itemType}/${itemId} at ${locationId}`,
      );
    }

    return {
      consumedBatches,
      totalCost: consumedBatches.reduce((s, b) => s + b.totalCost, 0),
    };
  },

  /**
   * Manual batch selection (super‑admin override).
   * Deducts exact quantities from specified purchase transaction IDs.
   */
  async consumeManual(
    itemType: string,
    itemId: string,
    locationId: string,
    batches: { transactionId: string; quantity: number }[],
    session?: ClientSession,
  ) {
    const consumed: any[] = [];
    for (const { transactionId, quantity } of batches) {
      const tx = await StockTransaction.findOne({
        _id: transactionId,
        itemType,
        itemId,
        locationId,
        transactionType: { $in: COST_BEARING_TRANSACTIONS },
        remainingQuantity: { $gte: quantity },
      }).session(session ?? null);

      if (!tx) {
        throw new Error(
          `Batch ${transactionId} has insufficient remaining quantity`,
        );
      }

      tx.remainingQuantity -= quantity;
      await tx.save({ session });

      consumed.push({
        transactionId: tx._id,
        quantity,
        unitCost: tx.unitCost,
        totalCost: Math.round(quantity * tx.unitCost * 100) / 100,
      });
    }

    return {
      consumedBatches: consumed,
      totalCost: consumed.reduce((s, b) => s + b.totalCost, 0),
    };
  },

  /**
   * Record a consumption transaction and decrement the aggregated stock table.
   */
  async recordConsumption(
    itemType: string,
    itemId: any,
    locationId: any,
    quantity: number,
    totalCost: number,
    StockModel: any,
    idField: string,
    sourceId?: string,
    sourceModel?: string,
    createdBy?: string,
    session?: ClientSession,
  ) {
    const locationFilter: any = { [idField]: itemId };
    if (StockModel.modelName === "ProductStock") {
      locationFilter.warehouseId = locationId;
    } else {
      locationFilter.factoryId = locationId;
    }

    await StockModel.findOneAndUpdate(
      locationFilter,
      { $inc: { quantity: -quantity }, $set: { lastUpdated: new Date() } },
      { session },
    );

    await StockTransaction.create(
      [
        {
          itemType,
          itemId,
          locationId,
          transactionType: "consumption",
          quantity: -quantity,
          unitCost: totalCost / quantity,
          totalCost,
          sourceId,
          sourceModel,
          createdBy,
        },
      ],
      { session },
    );
  },
};
