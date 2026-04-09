// src/services/workorder.service.ts

import { createCrudService } from "./crud.service";
import WorkOrderModel, {
  WORK_ORDER_STATUSES,
  WORK_ORDER_ITEM_TYPES,
} from "../models/workorder.model";
import goodReceiptModel from "../models/good-receipt.model";

/* =====================================================
   BASE CRUD
===================================================== */

const base = createCrudService(WorkOrderModel, {
  softDeleteField: "deletedAt",
  defaultPopulate: [
    "supplier",
    "warehouseOrFactory",
    "createdBy",
    "updatedBy",
    "approvedBy",
    "cancelledBy",
    "items.itemId",
  ],
  searchFields: ["workOrderNo", "status", "subject", "reference"],
  allowedFilterFields: [
    "supplier",
    "warehouseOrFactory",
    "status",
    "issueDate",
    "expectedDeliveryDate",
  ],
});

/* =====================================================
   HELPERS
===================================================== */

type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

const toNumber = (v: any, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

const normalizeItems = (items: any[] = []) => {
  return items.map((it, i) => {
    if (!it.itemType) throw new Error(`Item ${i + 1}: itemType is required`);

    if (!WORK_ORDER_ITEM_TYPES.includes(it.itemType))
      throw new Error(`Item ${i + 1}: invalid itemType`);

    if (!it.itemId) throw new Error(`Item ${i + 1}: itemId is required`);

    const quantity = toNumber(it.quantity);
    if (quantity <= 0) throw new Error(`Item ${i + 1}: quantity must be > 0`);

    const unitPrice = toNumber(it.unitPrice);

    return {
      itemType: it.itemType,
      itemId: it.itemId,
      name: it.name || "",
      description: it.description || "",
      quantity,
      unit: it.unit || "",
      unitPrice,
      lineTotal: quantity * unitPrice,
      remarks: it.remarks || "",
    };
  });
};

const normalizePayload = (payload: any) => {
  return {
    ...payload,
    supplier: payload?.supplier,
    warehouseOrFactory: payload?.warehouseOrFactory,
    issueDate: payload?.issueDate,
    expectedDeliveryDate: payload?.expectedDeliveryDate || null,

    subject: payload?.subject || "",
    reference: payload?.reference || "",

    discountPercent: toNumber(payload?.discountPercent),
    taxPercent: toNumber(payload?.taxPercent),

    items: normalizeItems(payload?.items || []),

    notes: payload?.notes || "",
    terms: payload?.terms || "",

    status: payload?.status || "Pending",
  };
};

const validatePayload = (payload: any) => {
  if (!payload.supplier) throw new Error("Supplier is required");
  if (!payload.warehouseOrFactory)
    throw new Error("Warehouse/Factory is required");
  if (!payload.issueDate) throw new Error("Issue date is required");
  if (!payload.items?.length) throw new Error("At least one item is required");
};

/* =====================================================
   PROGRESS CALCULATION
===================================================== */

const buildReceivedMap = (grItems: any[]) => {
  const map = new Map<string, number>();

  for (const g of grItems) {
    map.set(String(g._id), toNumber(g.receivedQty));
  }

  return map;
};

const enrichWorkOrder = (wo: any, receivedMap: Map<string, number>) => {
  const items = wo.items.map((item: any) => {
    const received = receivedMap.get(String(item._id)) || 0;
    const remaining = item.quantity - received;

    return {
      ...item,
      receivedQty: received,
      remainingQty: remaining,
    };
  });

  const totalOrdered = items.reduce((a: number, i: any) => a + i.quantity, 0);
  const totalReceived = items.reduce(
    (a: number, i: any) => a + i.receivedQty,
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
};

/* =====================================================
   STATUS TRANSITION HELPER
===================================================== */

const transitionStatus = async (
  id: string,
  allowedFrom: WorkOrderStatus[],
  to: WorkOrderStatus,
  extra: any = {},
) => {
  const wo = await base.model.findById(id);
  if (!wo) throw new Error("Work order not found");

  if (!allowedFrom.includes(wo.status)) {
    throw new Error(`Cannot move from ${wo.status} → ${to}`);
  }

  wo.status = to;
  Object.assign(wo, extra);

  await wo.save();
  return wo;
};

/* =====================================================
   SERVICE
===================================================== */

export const workOrderService = {
  ...base,

  /* ================= CREATE ================= */
  async create(payload: any) {
    return base.withTransaction(async (session) => {
      const data = normalizePayload(payload);
      validatePayload(data);

      const created = await base.create(data, { session }); // ✅ FIXED await
      return created;
    });
  },

  /* ================= UPDATE ================= */
  async update(id: string, payload: any) {
    return base.withTransaction(async (session) => {
      const data = normalizePayload(payload);
      validatePayload(data);

      return base.update(id, data, { session });
    });
  },

  /* ================= LIST ================= */
  async list(params: any = {}) {
    const result = await base.list(params);

    if (!result?.data?.length) return result;

    const ids = result.data.map((w: any) => w._id);

    const grItems = await goodReceiptModel.aggregate([
      { $match: { workOrderId: { $in: ids } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.workOrderItemId",
          receivedQty: { $sum: "$items.receivedQty" },
        },
      },
    ]);

    const map = buildReceivedMap(grItems);

    return {
      ...result,
      data: result.data.map((wo: any) => enrichWorkOrder(wo, map)),
    };
  },

  /* ================= GET BY ID ================= */
  async getById(id: string) {
    const wo = await base.getById(id);
    if (!wo) return null;

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

    const map = buildReceivedMap(grItems);

    return enrichWorkOrder(wo, map);
  },

  /* =====================================================
     STATUS FLOW
  ====================================================== */

  async moveToProcessing(id: string, userId?: string) {
    return transitionStatus(id, ["Pending"], "Processing", {
      updatedBy: userId,
    });
  },

  async moveToUnderReview(id: string, userId?: string) {
    return transitionStatus(id, ["Processing"], "UnderReview", {
      updatedBy: userId,
    });
  },

  async approve(id: string, userId: string) {
    return transitionStatus(id, ["UnderReview"], "Approved", {
      approvedBy: userId,
      updatedBy: userId,
    });
  },

  async markCompleted(id: string, userId?: string) {
    return transitionStatus(id, ["Approved"], "Completed", {
      updatedBy: userId,
    });
  },

  async cancel(id: string, userId: string, reason?: string) {
    return transitionStatus(
      id,
      ["Pending", "Processing", "UnderReview"],
      "Cancelled",
      {
        cancelledBy: userId,
        cancelReason: reason || "",
        cancelledAt: new Date(),
        updatedBy: userId,
      },
    );
  },

  /* ================= FLEXIBLE STATUS ================= */
  async setStatus(id: string, status: WorkOrderStatus, userId?: string) {
    const wo = await base.model.findById(id);
    if (!wo) throw new Error("Work order not found");

    const flow: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      Pending: ["Processing", "Cancelled"],
      Processing: ["UnderReview", "Cancelled"],
      UnderReview: ["Approved", "Cancelled"],
      Approved: ["Completed"],
      Completed: [],
      Cancelled: [],
    };

    if (!flow[wo.status]?.includes(status)) {
      throw new Error(`Invalid transition ${wo.status} → ${status}`);
    }

    wo.status = status;
    if (userId) wo.updatedBy = userId;

    await wo.save();
    return wo;
  },
};
