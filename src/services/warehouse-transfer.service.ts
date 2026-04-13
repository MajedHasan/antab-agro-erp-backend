import mongoose, { ClientSession, Types } from "mongoose";
import { createCrudService } from "./crud.service";
import WarehouseTransfer, {
  IWarehouseTransfer,
  ITransferItem,
  QtyHistoryStage,
  TransferMode,
  TransferStatus,
  TransferType,
} from "../models/warehouse-transfer.model";
import ProductStock from "../models/productStock.model";

type UserCtx = {
  userId: string;
  name?: string;
  role?: string;
};

type ServiceCtx = {
  user?: UserCtx;
  session?: ClientSession;
};

type ItemInput = {
  productId: string;
  quantity?: number;
  requestedQty?: number;
  finalQty?: number;
  unit?: string;
  costPrice?: number;
  note?: string;
};

type CreatePayload = {
  transferNo?: string;
  transferType: TransferType;
  transferMode: TransferMode;
  sender: string;
  receiver: string;
  items: ItemInput[];
  remarks?: string;
};

type StagePayload = {
  items?: ItemInput[];
  remarks?: string;
};

type ReceivePayload = {
  mediaId: string;
  remarks?: string;
};

const POPULATE = [
  { path: "sender" },
  { path: "receiver" },
  { path: "createdBy", select: "name email role" },
  { path: "receiverNsmApprovedBy", select: "name email role" },
  { path: "senderReviewedBy", select: "name email role" },
  { path: "senderNsmApprovedBy", select: "name email role" },
  { path: "dispatchedBy", select: "name email role" },
  { path: "receivedBy", select: "name email role" },
  { path: "items.productId", select: "name sku unit salePrice" },
];

const crudBase = createCrudService(WarehouseTransfer, {
  defaultPopulate: POPULATE,
  defaultSort: "-createdAt",
  searchFields: ["transferNo"],
  allowedFilterFields: [
    "sender",
    "receiver",
    "status",
    "transferType",
    "transferMode",
    "createdBy",
  ],
});

function now() {
  return new Date();
}

function asObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error(`Invalid ObjectId: ${id}`);
  }
  return new Types.ObjectId(id);
}

function normalizeQty(value: any, fieldName = "qty") {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${fieldName} must be a positive number`);
  }
  return n;
}

function makeTransferNo() {
  return `TR-${Date.now()}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;
}

function getRole(user?: UserCtx) {
  return user?.role || "USER";
}

function locationName(loc: any) {
  return (
    loc?.name ||
    loc?.warehouseName ||
    loc?.factoryName ||
    loc?.title ||
    loc?.code ||
    String(loc?._id || "")
  );
}

function calcAvailable(stock: any) {
  return (
    (stock?.quantity || 0) +
    (stock?.incomingTransfer || 0) -
    (stock?.reservedForSales || 0) -
    (stock?.reservedForTransfer || 0)
  );
}

function isDirectFactoryTransfer(transfer: any) {
  return (
    transfer.transferType === "FACTORY_TO_WAREHOUSE" &&
    transfer.transferMode === "DIRECT"
  );
}

function isFactoryRequestTransfer(transfer: any) {
  return (
    transfer.transferType === "FACTORY_TO_WAREHOUSE" &&
    transfer.transferMode === "REQUEST"
  );
}

function isWarehouseToWarehouse(transfer: any) {
  return transfer.transferType === "WAREHOUSE_TO_WAREHOUSE";
}

function canDispatchTransfer(transfer: any) {
  if (isWarehouseToWarehouse(transfer)) {
    return transfer.status === "SENDER_NSM_APPROVED";
  }

  if (isFactoryRequestTransfer(transfer)) {
    return transfer.status === "RECEIVER_NSM_APPROVED";
  }

  if (isDirectFactoryTransfer(transfer)) {
    return transfer.status === "DRAFT";
  }

  return false;
}

function addLog(
  transfer: IWarehouseTransfer,
  user: UserCtx,
  status: TransferStatus | "CREATED" | "UPDATED" | "DRAFT",
  remarks?: string,
) {
  transfer.approvalLogs.push({
    actionBy: asObjectId(user.userId),
    role: getRole(user),
    status,
    remarks,
    actionAt: now(),
  });
}

function buildSnapshot(transfer: any, user: UserCtx) {
  return {
    transferNo: transfer.transferNo,
    sender: {
      id: transfer.sender?._id || transfer.sender,
      name: locationName(transfer.sender),
    },
    receiver: {
      id: transfer.receiver?._id || transfer.receiver,
      name: locationName(transfer.receiver),
    },
    items: (transfer.items || []).map((item: any) => ({
      productId: item.productId?._id || item.productId,
      name: item.productId?.name,
      sku: item.productId?.sku,
      qty: item.finalQty,
      unit: item.unit,
    })),
    printedBy: asObjectId(user.userId),
    printedByName: user.name || user.userId,
    printedAt: now(),
  };
}

function buildItemsFromPayload(
  incomingItems: ItemInput[],
  userId: string,
  stage: QtyHistoryStage,
  existingItems: ITransferItem[] = [],
) {
  if (!Array.isArray(incomingItems) || incomingItems.length === 0) {
    throw new Error("Transfer must contain at least one item");
  }

  const existingMap = new Map(
    existingItems.map((item) => [String(item.productId), item]),
  );

  return incomingItems.map((incoming) => {
    const productId = asObjectId(String(incoming.productId));
    const requestedQty = normalizeQty(
      incoming.requestedQty ?? incoming.quantity ?? incoming.finalQty,
      "requestedQty",
    );
    const finalQty = normalizeQty(
      incoming.finalQty ?? incoming.quantity ?? incoming.requestedQty,
      "finalQty",
    );

    const prev = existingMap.get(String(productId));
    const qtyHistory = prev?.qtyHistory?.length ? [...prev.qtyHistory] : [];

    if (!prev) {
      qtyHistory.push({
        stage: "CREATED",
        qty: finalQty,
        changedBy: asObjectId(userId),
        changedAt: now(),
        note: incoming.note,
      });
    } else if (prev.finalQty !== finalQty || stage !== "CREATED") {
      qtyHistory.push({
        stage,
        qty: finalQty,
        changedBy: asObjectId(userId),
        changedAt: now(),
        note: incoming.note,
      });
    }

    return {
      productId,
      requestedQty,
      finalQty,
      unit: incoming.unit ?? prev?.unit,
      costPrice: incoming.costPrice ?? prev?.costPrice,
      qtyHistory,
    };
  });
}

async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    session.endSession();
  }
}

async function getTransferById(id: string, session?: ClientSession) {
  let query = WarehouseTransfer.findById(id).populate(POPULATE);
  if (session) query = query.session(session);
  return query.exec();
}

async function reserveVirtualStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.finalQty;

    const sourceStock = await ProductStock.findOne({
      productId: item.productId,
      warehouseId: transfer.sender,
    }).session(session);

    if (!sourceStock) {
      throw new Error(`Source stock not found for product ${item.productId}`);
    }

    const available = calcAvailable(sourceStock);
    if (available < qty) {
      throw new Error(`Insufficient stock for product ${item.productId}`);
    }

    await ProductStock.findOneAndUpdate(
      {
        productId: item.productId,
        warehouseId: transfer.sender,
      },
      {
        $inc: { reservedForTransfer: qty },
        $set: { lastUpdated: now() },
      },
      { session },
    );

    await ProductStock.findOneAndUpdate(
      {
        productId: item.productId,
        warehouseId: transfer.receiver,
      },
      {
        $inc: { incomingTransfer: qty },
        $setOnInsert: {
          quantity: 0,
          reservedForSales: 0,
          reservedForTransfer: 0,
          // incomingTransfer: 0,
        },
        $set: { lastUpdated: now() },
      },
      { upsert: true, session },
    );
  }
}

async function releaseVirtualStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.finalQty;

    await ProductStock.findOneAndUpdate(
      {
        productId: item.productId,
        warehouseId: transfer.sender,
      },
      {
        $inc: { reservedForTransfer: -qty },
        $set: { lastUpdated: now() },
      },
      { session },
    );

    await ProductStock.findOneAndUpdate(
      {
        productId: item.productId,
        warehouseId: transfer.receiver,
      },
      {
        $inc: { incomingTransfer: -qty },
        $set: { lastUpdated: now() },
      },
      { session },
    );
  }
}

async function finalizePhysicalStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.finalQty;

    const sourceStock = await ProductStock.findOne({
      productId: item.productId,
      warehouseId: transfer.sender,
    }).session(session);

    if (!sourceStock) {
      throw new Error(`Source stock not found for product ${item.productId}`);
    }

    if ((sourceStock.quantity || 0) < qty) {
      throw new Error(
        `Insufficient physical stock for product ${item.productId}`,
      );
    }

    await ProductStock.findOneAndUpdate(
      {
        productId: item.productId,
        warehouseId: transfer.sender,
      },
      {
        $inc: {
          quantity: -qty,
          reservedForTransfer: -qty,
        },
        $set: { lastUpdated: now() },
      },
      { session },
    );

    await ProductStock.findOneAndUpdate(
      {
        productId: item.productId,
        warehouseId: transfer.receiver,
      },
      {
        $inc: {
          quantity: qty,
          incomingTransfer: -qty,
        },
        $setOnInsert: {
          // quantity: 0,
          reservedForSales: 0,
          reservedForTransfer: 0,
          // incomingTransfer: 0,
        },
        $set: { lastUpdated: now() },
      },
      { upsert: true, session },
    );
  }
}

function normalizeUser(user?: UserCtx) {
  if (!user?.userId) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function createTransferDoc(
  payload: CreatePayload,
  user: UserCtx,
  session: ClientSession,
) {
  const actor = normalizeUser(user);

  if (!payload.transferType) throw new Error("transferType is required");
  if (!payload.transferMode) throw new Error("transferMode is required");
  if (!payload.sender) throw new Error("sender is required");
  if (!payload.receiver) throw new Error("receiver is required");

  if (String(payload.sender) === String(payload.receiver)) {
    throw new Error("Sender and receiver cannot be the same");
  }

  if (
    payload.transferType === "WAREHOUSE_TO_WAREHOUSE" &&
    payload.transferMode !== "REQUEST"
  ) {
    throw new Error("Warehouse to warehouse transfer must be REQUEST mode");
  }

  const items = buildItemsFromPayload(payload.items, actor.userId, "CREATED");

  const [doc] = await WarehouseTransfer.create(
    [
      {
        transferNo: payload.transferNo?.trim() || makeTransferNo(),
        transferType: payload.transferType,
        transferMode: payload.transferMode,
        sender: payload.sender,
        receiver: payload.receiver,
        items,
        status: "DRAFT",
        locked: false,
        createdBy: asObjectId(actor.userId),
        approvalLogs: [],
      },
    ],
    { session },
  );

  addLog(doc, actor, "CREATED", payload.remarks);

  if (isDirectFactoryTransfer(doc)) {
    await reserveVirtualStock(doc, session);
  }

  await doc.save({ session });
  return getTransferById(String(doc._id), session);
}

async function updateTransferDoc(
  id: string,
  payload: any,
  user: UserCtx,
  session: ClientSession,
) {
  const actor = normalizeUser(user);
  const doc = await WarehouseTransfer.findById(id).session(session);
  if (!doc) throw new Error("Transfer not found");

  const nextTransferType = payload.transferType ?? doc.transferType;
  const nextTransferMode = payload.transferMode ?? doc.transferMode;

  if (
    nextTransferType === "WAREHOUSE_TO_WAREHOUSE" &&
    nextTransferMode !== "REQUEST"
  ) {
    throw new Error("Warehouse to warehouse transfer must be REQUEST mode");
  }

  if (doc.status !== "DRAFT" || doc.locked) {
    throw new Error("Only draft transfers can be updated");
  }

  const directBefore = isDirectFactoryTransfer(doc);
  if (directBefore) {
    await releaseVirtualStock(doc, session);
  }

  if (payload.transferNo !== undefined) doc.transferNo = payload.transferNo;
  if (payload.transferType !== undefined)
    doc.transferType = payload.transferType;
  if (payload.transferMode !== undefined)
    doc.transferMode = payload.transferMode;
  if (payload.sender !== undefined) doc.sender = payload.sender;
  if (payload.receiver !== undefined) doc.receiver = payload.receiver;

  if (payload.items) {
    doc.items = buildItemsFromPayload(
      payload.items,
      actor.userId,
      "DRAFT_UPDATED",
      doc.items as any,
    ) as any;
  }

  addLog(doc, actor, "UPDATED", payload.remarks);

  if (isDirectFactoryTransfer(doc)) {
    await reserveVirtualStock(doc, session);
  }

  await doc.save({ session });
  return getTransferById(String(doc._id), session);
}

async function removeTransferDoc(id: string, session: ClientSession) {
  const doc = await WarehouseTransfer.findById(id).session(session);
  if (!doc) throw new Error("Transfer not found");

  if (doc.status === "DISPATCHED" || doc.status === "COMPLETED") {
    throw new Error("Cannot delete after dispatch");
  }

  if (
    isDirectFactoryTransfer(doc) ||
    doc.status === "RECEIVER_NSM_APPROVED" ||
    doc.status === "SENDER_NSM_APPROVED"
  ) {
    await releaseVirtualStock(doc, session);
  }

  await WarehouseTransfer.findByIdAndDelete(id, { session });
  return { deleted: true };
}

export const warehouseTransferCrudService = crudBase;

export const warehouseTransferService = {
  ...crudBase,

  async create(payload: CreatePayload, ctx: ServiceCtx = {}) {
    return withTransaction(async (session) => {
      return createTransferDoc(
        payload,
        ctx.user || { userId: "" },
        ctx.session || session,
      );
    });
  },

  async update(id: string, payload: any, ctx: ServiceCtx = {}) {
    return withTransaction(async (session) => {
      return updateTransferDoc(
        id,
        payload,
        ctx.user || { userId: "" },
        ctx.session || session,
      );
    });
  },

  async remove(id: string, ctx: ServiceCtx = {}) {
    return withTransaction(async (session) => {
      return removeTransferDoc(id, ctx.session || session);
    });
  },

  async bulkCreate(items: CreatePayload[], ctx: ServiceCtx = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("bulkCreate requires an array of payloads");
    }

    return withTransaction(async (session) => {
      const created: any[] = [];
      for (const payload of items) {
        created.push(
          await createTransferDoc(
            payload,
            ctx.user || { userId: "" },
            ctx.session || session,
          ),
        );
      }
      return created;
    });
  },

  async bulkDelete(filters: any[], ctx: ServiceCtx = {}) {
    if (!Array.isArray(filters) || filters.length === 0) {
      throw new Error("bulkDelete requires filters");
    }

    return withTransaction(async (session) => {
      const ids = new Set<string>();

      for (const filter of filters) {
        const docs = await WarehouseTransfer.find(filter)
          .select("_id")
          .session(ctx.session || session);
        for (const d of docs) ids.add(String(d._id));
      }

      let deleted = 0;
      for (const id of ids) {
        await removeTransferDoc(id, ctx.session || session);
        deleted += 1;
      }

      return { deleted };
    });
  },

  async receiverNSMApprove(id: string, payload: StagePayload, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).session(session);
      if (!doc) throw new Error("Transfer not found");

      if (doc.status !== "DRAFT") {
        throw new Error("Transfer is not in draft stage");
      }

      if (payload.items?.length) {
        doc.items = buildItemsFromPayload(
          payload.items,
          actor.userId,
          "RECEIVER_NSM_APPROVED",
          doc.items as any,
        ) as any;
      }

      if (isWarehouseToWarehouse(doc)) {
        doc.status = "RECEIVER_NSM_APPROVED";
        doc.locked = false;
      } else if (isFactoryRequestTransfer(doc)) {
        doc.status = "RECEIVER_NSM_APPROVED";
        doc.locked = true;
        await reserveVirtualStock(doc, session);
      } else {
        throw new Error(
          "Receiver NSM approval is not valid for this transfer type",
        );
      }

      doc.receiverNsmApprovedBy = asObjectId(actor.userId);
      doc.receiverNsmApprovedAt = now();

      addLog(doc, actor, "RECEIVER_NSM_APPROVED", payload.remarks);

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async senderReview(id: string, payload: StagePayload, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).session(session);
      if (!doc) throw new Error("Transfer not found");

      if (!isWarehouseToWarehouse(doc)) {
        throw new Error(
          "Sender review is only for warehouse to warehouse transfers",
        );
      }

      if (doc.status !== "RECEIVER_NSM_APPROVED") {
        throw new Error("Transfer must be receiver NSM approved first");
      }

      if (payload.items?.length) {
        doc.items = buildItemsFromPayload(
          payload.items,
          actor.userId,
          "SENDER_REVIEWED",
          doc.items as any,
        ) as any;
      }

      doc.status = "SENDER_REVIEWED";
      doc.senderReviewedBy = asObjectId(actor.userId);
      doc.senderReviewedAt = now();

      addLog(doc, actor, "SENDER_REVIEWED", payload.remarks);

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async senderNSMApprove(id: string, payload: StagePayload, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).session(session);
      if (!doc) throw new Error("Transfer not found");

      if (!isWarehouseToWarehouse(doc)) {
        throw new Error(
          "Sender NSM approval is only for warehouse to warehouse transfers",
        );
      }

      if (doc.status !== "SENDER_REVIEWED") {
        throw new Error("Transfer must be sender reviewed first");
      }

      if (payload.items?.length) {
        doc.items = buildItemsFromPayload(
          payload.items,
          actor.userId,
          "SENDER_NSM_APPROVED",
          doc.items as any,
        ) as any;
      }

      await reserveVirtualStock(doc, session);

      doc.status = "SENDER_NSM_APPROVED";
      doc.locked = true;
      doc.senderNsmApprovedBy = asObjectId(actor.userId);
      doc.senderNsmApprovedAt = now();

      addLog(doc, actor, "SENDER_NSM_APPROVED", payload.remarks);

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async generatePrintSnapshot(id: string, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id)
        .populate(POPULATE)
        .session(session);
      if (!doc) throw new Error("Transfer not found");

      const canPrint =
        (isWarehouseToWarehouse(doc) &&
          ["SENDER_NSM_APPROVED", "DISPATCHED", "COMPLETED"].includes(
            doc.status,
          )) ||
        (isFactoryRequestTransfer(doc) &&
          ["RECEIVER_NSM_APPROVED", "DISPATCHED", "COMPLETED"].includes(
            doc.status,
          )) ||
        (isDirectFactoryTransfer(doc) &&
          ["DRAFT", "DISPATCHED", "COMPLETED"].includes(doc.status));

      if (!canPrint) {
        throw new Error("Transfer is not ready for print snapshot");
      }

      doc.printSnapshot = buildSnapshot(doc, actor);
      addLog(doc, actor, "UPDATED", "Print snapshot generated");

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async dispatch(id: string, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id)
        .populate(POPULATE)
        .session(session);
      if (!doc) throw new Error("Transfer not found");

      if (!canDispatchTransfer(doc)) {
        throw new Error("Transfer is not ready for dispatch");
      }

      if (!doc.printSnapshot) {
        doc.printSnapshot = buildSnapshot(doc, actor);
      }

      doc.status = "DISPATCHED";
      doc.locked = true;
      doc.dispatchedBy = asObjectId(actor.userId);
      doc.dispatchedAt = now();

      addLog(doc, actor, "DISPATCHED");

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async receive(id: string, payload: ReceivePayload, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).session(session);
      if (!doc) throw new Error("Transfer not found");

      if (doc.status !== "DISPATCHED") {
        throw new Error("Transfer must be dispatched before receiving");
      }

      if (!payload?.mediaId) {
        throw new Error("Signed document mediaId is required");
      }

      if (!doc.printSnapshot) {
        throw new Error("Print snapshot is required before receiving");
      }

      await finalizePhysicalStock(doc, session);

      doc.documents = {
        ...(doc.documents || {}),
        signed: {
          mediaId: asObjectId(payload.mediaId),
          uploadedBy: asObjectId(actor.userId),
          uploadedByName: actor.name || actor.userId,
          uploadedAt: now(),
        },
      };

      doc.status = "COMPLETED";
      doc.receivedBy = asObjectId(actor.userId);
      doc.receivedAt = now();

      addLog(doc, actor, "COMPLETED", payload.remarks);

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async cancel(id: string, payload: { reason?: string }, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).session(session);
      if (!doc) throw new Error("Transfer not found");

      if (doc.status === "DISPATCHED" || doc.status === "COMPLETED") {
        throw new Error("Cannot cancel after dispatch");
      }

      if (
        doc.status === "RECEIVER_NSM_APPROVED" ||
        doc.status === "SENDER_NSM_APPROVED" ||
        isDirectFactoryTransfer(doc)
      ) {
        await releaseVirtualStock(doc, session);
      }

      doc.status = "CANCELLED";
      doc.locked = true;
      doc.cancelledBy = asObjectId(actor.userId);
      doc.cancelledAt = now();
      doc.cancelReason = payload?.reason || "Cancelled";

      addLog(doc, actor, "CANCELLED", payload?.reason);

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  async reject(id: string, payload: { reason?: string }, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).session(session);
      if (!doc) throw new Error("Transfer not found");

      if (doc.status === "DISPATCHED" || doc.status === "COMPLETED") {
        throw new Error("Cannot reject after dispatch");
      }

      if (
        doc.status === "RECEIVER_NSM_APPROVED" ||
        doc.status === "SENDER_NSM_APPROVED" ||
        isDirectFactoryTransfer(doc)
      ) {
        await releaseVirtualStock(doc, session);
      }

      doc.status = "REJECTED";
      doc.locked = true;
      doc.rejectedBy = asObjectId(actor.userId);
      doc.rejectedAt = now();
      doc.rejectReason = payload?.reason || "Rejected";

      addLog(doc, actor, "REJECTED", payload?.reason);

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },
};
