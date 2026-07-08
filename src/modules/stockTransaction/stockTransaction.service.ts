import { createCrudService } from "../../services/crud.service";
import { StockTransaction } from "./stockTransaction.model";

const base = createCrudService(StockTransaction, {
  searchFields: ["itemType", "sourceModel", "batch"],
  allowedFilterFields: [
    "itemType",
    "itemId",
    "locationId",
    "transactionType",
    "sourceId",
    "sourceModel",
    "batch",
    "transactionDate",
  ],
  defaultPopulate: ["itemId", "locationId", "createdBy"],
});

export const stockTransactionService = {
  ...base,

  /**
   * Get the most recent purchase unit cost for an item at a location.
   */
  async getLatestUnitCost(
    itemType: string,
    itemId: string,
    locationId: string,
  ) {

    const tx = await StockTransaction.findOne({
      itemType,
      itemId,
      locationId,
      transactionType: { $in: ["purchase", "production_return", "transfer_in", "production", "return"] },
      $expr: { $gt: [{ $subtract: ["$remainingQuantity", "$reserved"] }, 0] },
    })
      .sort({ transactionDate: -1 })
      .lean();
    
    return tx?.unitCost ?? 0;
  },

  /**
   * Get all purchase batches that still have free stock (remaining - reserved > 0).
   * `sortDirection`: 1 for FIFO, -1 for LIFO.
   */
  async getAvailableBatches(
    itemType: string,
    itemId: string,
    locationId: string,
    sortDirection: 1 | -1 = -1,
  ) {
    return StockTransaction.find({
      itemType,
      itemId,
      locationId,
      transactionType: {$in: ["purchase", "production_return", "transfer_in", "production", "return"]},
      $expr: {
        $gt: [{ $subtract: ["$remainingQuantity", "$reserved"] }, 0],
      },
    })
      .sort({ transactionDate: sortDirection })
      .lean();
  },

  /**
   * Get the full lifecycle of a single purchase batch.
   * Returns the purchase document plus every subsequent movement that references it.
   */
  async getBatchHistory(batchTransactionId: string) {
    const purchase = await StockTransaction.findById(batchTransactionId).lean();
    if (!purchase) throw new Error("Batch not found");

    const related = await StockTransaction.find({
      $or: [
        { "batchDetails.batchId": batchTransactionId },
        { sourceId: batchTransactionId, sourceModel: "StockTransaction" },
      ],
    })
      .sort({ transactionDate: 1 })
      .lean();

    return { purchase, movements: related };
  },
};
