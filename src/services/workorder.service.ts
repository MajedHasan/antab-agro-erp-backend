// src/services/workorder.service.ts

import { createCrudService } from "./crud.service";
import WorkOrderModel from "../models/workorder.model";
import goodReceiptModel from "../models/good-receipt.model";

const base = createCrudService(WorkOrderModel, {
  softDeleteField: "deletedAt",
  defaultPopulate: [
    "supplier",
    "warehouseOrFactory",
    "createdBy",
    "approvedBy",
  ],
  searchFields: ["workOrderNo", "status"],
  allowedFilterFields: [
    "supplier",
    "warehouseOrFactory",
    "status",
    "issueDate",
  ],
});

export const workOrderService = {
  ...base,

  async list(
    params: { filter?: any; page?: number; limit?: number; q?: string } = {},
  ) {
    const { filter, page, limit, q } = params;

    const workOrders = await base.list({ filter, page, limit, q });

    if (!workOrders?.data?.length) {
      return workOrders;
    }

    const workOrderIds = workOrders.data.map((w) => w._id);

    /* --------------------------------------------------
     GET ALL GR ITEM RECEIVED QTY
  -------------------------------------------------- */

    const grItems = await goodReceiptModel.aggregate([
      {
        $match: {
          workOrderId: { $in: workOrderIds },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.workOrderItemId",
          receivedQty: { $sum: "$items.receivedQty" },
        },
      },
    ]);

    const receivedMap = new Map();

    for (const g of grItems) {
      receivedMap.set(String(g._id), g.receivedQty);
    }

    /* --------------------------------------------------
     ENRICH WORK ORDER ITEMS
  -------------------------------------------------- */

    const enrichedWorkOrders = workOrders.data.map((wo: any) => {
      const items = wo.items.map((item: any) => {
        const received = receivedMap.get(String(item._id)) || 0;
        const remaining = item.quantity - received;

        return {
          ...item,
          receivedQty: received,
          remainingQty: remaining,
        };
      });

      /* ----------------------------------------------
       CALCULATE WORK ORDER PROGRESS
    ---------------------------------------------- */

      const totalOrdered = items.reduce(
        (acc: number, i: any) => acc + i.quantity,
        0,
      );

      const totalReceived = items.reduce(
        (acc: number, i: any) => acc + i.receivedQty,
        0,
      );

      const progress =
        totalOrdered > 0
          ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
          : 0;

      return {
        ...wo,
        items,
        receivedQuantity: totalReceived,
        progress,
      };
    });

    return {
      ...workOrders,
      data: enrichedWorkOrders,
    };
  },

  /* ==============================
     GET BY ID
     - Enrich items with received & remaining qty
     - Optional filter on items
  ============================== */
  async getById(id: string, options: { itemFilter?: any } = {}) {
    const wo = await base.getById(id);
    if (!wo) return null;

    // Get all received quantities for this work order
    const grItems = await goodReceiptModel.aggregate([
      { $match: { workOrderId: wo._id } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.workOrderItemId",
          receivedQty: { $sum: "$items.receivedQty" },
        },
      },
    ]);

    const receivedMap = new Map(
      grItems.map((g) => [String(g._id), g.receivedQty]),
    );

    // Enrich items
    let items = wo.items.map((item: any) => {
      const received = receivedMap.get(String(item._id)) || 0;
      const remaining = item.quantity - received;
      return { ...item, receivedQty: received, remainingQty: remaining };
    });

    // Apply optional item filter
    if (options.itemFilter) {
      items = items.filter((item: any) => {
        return Object.keys(options.itemFilter).every(
          (key) => item[key] === options.itemFilter[key],
        );
      });
    }

    const totalOrdered = items.reduce(
      (acc: any, i: any) => acc + i.quantity,
      0,
    );
    const totalReceived = items.reduce(
      (acc: any, i: any) => acc + i.receivedQty,
      0,
    );
    const progress =
      totalOrdered > 0
        ? Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
        : 0;

    return { ...wo, items, receivedQuantity: totalReceived, progress };
  },

  /* =====================================================
     APPROVE WORK ORDER
     - Status becomes Approved
     - No stock change here
  ====================================================== */
  async approve(id: string, userId: string) {
    const wo = await base.model.findById(id);
    if (!wo) throw new Error("Work order not found");

    if (wo.status !== "Pending" && wo.status !== "Processing")
      throw new Error("Work order cannot be approved");

    wo.status = "Approved";
    wo.approvedBy = userId;
    await wo.save();

    return wo;
  },

  /* =====================================================
     CANCEL WORK ORDER
  ====================================================== */
  async cancel(id: string, userId: string, reason: string) {
    const wo = await base.model.findById(id);
    if (!wo) throw new Error("Work order not found");

    wo.status = "Cancelled";
    (wo as any).cancelledBy = userId;
    (wo as any).cancelReason = reason;
    (wo as any).cancelledAt = new Date();

    await wo.save();

    return wo;
  },

  /* =====================================================
     MARK COMPLETED
     ❌ NO STOCK INCREASE HERE ANYMORE
     ✅ Only status change
  ====================================================== */
  async markCompleted(id: string) {
    const wo = await base.model.findById(id);
    if (!wo) throw new Error("Work order not found");

    wo.status = "Completed";
    await wo.save();

    return wo;
  },
};
