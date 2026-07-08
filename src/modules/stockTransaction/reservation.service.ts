// src/modules/stockTransaction/reservation.service.ts
import { StockTransaction } from "./stockTransaction.model";
import { ClientSession } from "mongoose";

export type CostMethod = "FIFO" | "LIFO";

export const reservationService = {
  /**
   * Reserve stock from free batches.
   * Returns reservation ID and cost breakdown.
   */
  async reserve(
    itemType: string,
    itemId: string,
    locationId: string,
    quantity: number,
    method: CostMethod,
    sourceId: string,
    sourceModel: string,
    createdBy: string,
    session?: ClientSession,
  ) {
    const sortDir = method === "FIFO" ? 1 : -1;

    const batches = await StockTransaction.find({
      itemType,
      itemId,
      locationId,
      transactionType: { $in: ["purchase", "production_return", "transfer_in", "production", "return"] },
      $expr: { $gt: [{ $subtract: ["$remainingQuantity", "$reserved"] }, 0] },
    })
      .sort({ transactionDate: sortDir })
      .session(session ?? null)
      .exec();

    let remaining = quantity;
    const consumed: any[] = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const free = batch.remainingQuantity - batch.reserved;
      const take = Math.min(free, remaining);

      batch.reserved += take;
      await batch.save({ session });

      consumed.push({
        batchId: batch._id.toString(),
        quantity: take,
        unitCost: batch.unitCost,
        totalCost: Math.round(take * batch.unitCost * 100) / 100,
      });
      remaining -= take;
    }

    if (remaining > 0) throw new Error("Insufficient free stock");

    const totalCost = consumed.reduce((s, b) => s + b.totalCost, 0);

    const [reservationTx] = await StockTransaction.create(
      [
        {
          itemType,
          itemId,
          locationId,
          transactionType: "reservation",
          quantity: 0,
          unitCost: 0,
          totalCost: 0,
          sourceId,
          sourceModel,
          createdBy,
          batchDetails: consumed,
        },
      ],
      { session },
    );

    return {
      reservationId: reservationTx._id,
      consumedBatches: consumed,
      totalCost,
    };
  },

  /**
   * Release a reservation.
   *
   * When `cancelOnly` is `false` (default): performs a full release – decreases
   * reserved and remaining quantities on the batches, deducts aggregated stock,
   * creates the movement transaction, and marks the reservation as fulfilled.
   *
   * When `cancelOnly` is `true`: only decrements `reserved` on the batches
   * and deletes the reservation transaction. No stock movement or aggregated
   * stock change occurs. Useful when cancelling or rejecting a transfer/sale.
   */
  async release(
    reservationId: string,
    realTransactionType: string,
    realSourceId: string,
    realSourceModel: string,
    StockModel: any,
    idField: string,
    createdBy: string,
    session?: ClientSession,
    cancelOnly = false,   // <-- new parameter, default false to preserve existing behaviour
  ) {
    const reservation = await StockTransaction.findById(reservationId).session(session ?? null);
    if (!reservation || !reservation.batchDetails)
      throw new Error("Reservation not found or corrupted");

    const batchDetails = reservation.batchDetails as any[];

    if (cancelOnly) {
      // --- cancel‑only mode: just free the reservation, no stock movement ---
      for (const detail of batchDetails) {
        await StockTransaction.findByIdAndUpdate(
          detail.batchId,
          { $inc: { reserved: -detail.quantity } },
          { session },
        );
      }
      // Delete the reservation transaction
      await StockTransaction.findByIdAndDelete(reservationId, { session });
      return { totalQty: 0, totalCost: 0, consumedBatches: batchDetails };
    }

    // --- full release (original logic unchanged) ---
    let totalQty = 0;
    let totalCost = 0;

    for (const detail of batchDetails) {
      await StockTransaction.findByIdAndUpdate(
        detail.batchId,
        {
          $inc: {
            reserved: -detail.quantity,
            remainingQuantity: -detail.quantity,
          },
        },
        { session },
      );
      totalQty += detail.quantity;
      totalCost += detail.totalCost;
    }

    // Deduct aggregated stock
    const locationFilter: any = { [idField]: reservation.itemId };
    if (StockModel.modelName === "ProductStock") {
      locationFilter.warehouseId = reservation.locationId;
    } else {
      locationFilter.factoryId = reservation.locationId;
    }

    await StockModel.findOneAndUpdate(
      locationFilter,
      { $inc: { quantity: -totalQty }, $set: { lastUpdated: new Date() } },
      { session },
    );

    // Record the actual movement
    await StockTransaction.create(
      [
        {
          itemType: reservation.itemType,
          itemId: reservation.itemId,
          locationId: reservation.locationId,
          transactionType: realTransactionType,
          quantity: -totalQty,
          unitCost: totalCost / totalQty,
          totalCost,
          sourceId: realSourceId,
          sourceModel: realSourceModel,
          createdBy,
        },
      ],
      { session },
    );

    // Mark reservation as fulfilled
    reservation.transactionType = "reservation_release";
    await reservation.save({ session });

    return { totalQty, totalCost, consumedBatches: batchDetails };
  },
};