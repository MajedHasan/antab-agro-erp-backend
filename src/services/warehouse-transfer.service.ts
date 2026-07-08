// src/services/warehouse-transfer.service.ts
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
import { stockTransactionService } from "../modules/stockTransaction/stockTransaction.service";
import { reservationService } from "../modules/stockTransaction/reservation.service";
import { inventoryCostService } from "../modules/stockTransaction/inventoryCost.service";
import { voucherService } from "./voucher.service";
import { accountService } from "./account.service";
import Product from "../models/product.model";
import WarehouseOrFactory from "../models/warehouseOrFactory.model";

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
  items: { productId: string; receivedQty: number }[];
};

const POPULATE = [
  { path: "sender", select: "name code type _id" },
  { path: "receiver", select: "name code type _id" },
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

// ─── helpers ───────────────────────────────────────────
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

/** Extract a human-readable location name from a populated or raw object */
function locationName(loc: any) {
  return (
    loc?.name ||
    loc?.warehouseName ||
    loc?.factoryName ||
    loc?.title ||
    loc?.code ||
    (typeof loc === "string" ? loc : String(loc?._id || ""))
  );
}

/** Fetch a product name (with optional cache, but here we just do a DB lookup) */
async function productName(id: string, session?: ClientSession): Promise<string> {
  const product = await Product.findById(id).session(session ?? null).lean();
  return product?.name || `Unknown Product (${id})`;
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
    return transfer.status === "REQUESTED";
  }
  return false;
}

function addLog(
  transfer: IWarehouseTransfer,
  user: UserCtx,
  status: TransferStatus | "CREATED" | "UPDATED",
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
      id: transfer.sender?._id?.toString() || transfer.sender,
      name: locationName(transfer.sender),
    },
    receiver: {
      id: transfer.receiver?._id?.toString() || transfer.receiver,
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

// ──────────── Batch‑level reservation helpers ────────────
async function reserveBatchStock(doc: any, userId: string, session: ClientSession) {
  const ids: Types.ObjectId[] = [];
  for (const item of doc.items) {
    const productId = String(item.productId);
    const qty = item.finalQty;
    const senderId = String(doc.sender?._id || doc.sender);

    const { reservationId } = await reservationService.reserve(
      "Product",
      productId,
      senderId,
      qty,
      "FIFO",
      String(doc._id),
      "WarehouseTransfer",
      userId,
      session,
    );
    ids.push(reservationId);
  }
  doc.reservationIds = ids;
}

async function releaseBatchReservation(doc: any, session: ClientSession) {
  if (!doc.reservationIds?.length) return;
  for (const reservationId of doc.reservationIds) {
    await reservationService.release(
      reservationId,
      "transfer_out",
      String(doc._id),
      "WarehouseTransfer",
      ProductStock,
      "warehouseId",
      "",
      session,
      true, // cancelOnly
    );
  }
  doc.reservationIds = [];
}

// ─── Aggregated ProductStock helpers ────────────────────
async function reserveVirtualStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.finalQty;

    const sourceStock = await ProductStock.findOne({
      productId: item.productId,
      warehouseId: transfer.sender?._id?.toString(),
    }).session(session);

    if (!sourceStock) {
      throw new Error(`Source stock not found for product ${item.productId}`);
    }

    const available = calcAvailable(sourceStock);
    if (available < qty) {
      throw new Error(`Insufficient stock for product ${item.productId}`);
    }

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.sender?._id?.toString() },
      { $inc: { reservedForTransfer: qty }, $set: { lastUpdated: now() } },
      { session },
    );

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.receiver?._id?.toString() },
      { $inc: { incomingTransfer: qty }, $setOnInsert: { quantity: 0, reservedForSales: 0, reservedForTransfer: 0 }, $set: { lastUpdated: now() } },
      { upsert: true, session },
    );
  }
}

async function releaseVirtualStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.finalQty;

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.sender?._id?.toString() },
      { $inc: { reservedForTransfer: -qty }, $set: { lastUpdated: now() } },
      { session },
    );

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.receiver?._id?.toString() },
      { $inc: { incomingTransfer: -qty }, $set: { lastUpdated: now() } },
      { session },
    );
  }
}

async function finalizePhysicalStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.finalQty;

    const sourceStock = await ProductStock.findOne({
      productId: item.productId,
      warehouseId: transfer.sender?._id?.toString(),
    }).session(session);

    if (!sourceStock) {
      throw new Error(`Source stock not found for product ${item.productId}`);
    }

    if ((sourceStock.quantity || 0) < qty) {
      throw new Error(`Insufficient physical stock for product ${item.productId}`);
    }

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.sender?._id?.toString() },
      { $inc: { quantity: -qty, reservedForTransfer: -qty }, $set: { lastUpdated: now() } },
      { session },
    );

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.receiver?._id?.toString() },
      { $inc: { quantity: qty, incomingTransfer: -qty }, $setOnInsert: { reservedForSales: 0, reservedForTransfer: 0 }, $set: { lastUpdated: now() } },
      { upsert: true, session },
    );
  }
}

async function finalizeReceivedStock(transfer: any, session: ClientSession) {
  for (const item of transfer.items) {
    const qty = item.receivedQty || 0;
    if (qty <= 0) continue;
    const sourceStock = await ProductStock.findOne({
      productId: item.productId,
      warehouseId: transfer.sender,
    }).session(session);
    if (!sourceStock) throw new Error(`Source stock not found for ${item.productId}`);
    if ((sourceStock.quantity || 0) < qty) throw new Error(`Insufficient stock for ${item.productId}`);

    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.sender },
      { $inc: { quantity: -qty, reservedForTransfer: -qty }, $set: { lastUpdated: now() } },
      { session },
    );
    await ProductStock.findOneAndUpdate(
      { productId: item.productId, warehouseId: transfer.receiver },
      { $inc: { quantity: qty, incomingTransfer: -qty }, $setOnInsert: { reservedForSales: 0, reservedForTransfer: 0 }, $set: { lastUpdated: now() } },
      { upsert: true, session },
    );
  }
}

// ─── Accounting helpers ─────────────────────────────────
async function getProductLocationAccount(
  productId: string,
  locationId: string,
  session?: ClientSession,
) {
  const prod = await Product.findById(productId).session(session ?? null).lean();
  if (!prod) throw new Error("Product not found");
  const loc = await WarehouseOrFactory.findById(locationId).session(session ?? null).lean();
  if (!loc) throw new Error("Location not found");
  return (accountService as any).getAccountByPath(
    ["Assets", "Current Assets", "Inventory", "Finished Goods", prod.name],
    "Asset",
    { session },
  );
}

async function getDamageLossAccount(productName: string, session?: ClientSession) {
  return (accountService as any).getAccountByPath(
    ["Expense", "Cost of Goods Sold", "Goods Damage", productName],
    "Expense",
    { session },
  );
}

// ─── Core business logic ────────────────────────────────
/**
 * Create stock transactions and a balanced accounting voucher.
 * @param transfer - fully populated transfer document
 * @param userId - user performing the action
 * @param useReceivedQty - if true, use receivedQty; else finalQty
 */
async function createStockTransactionsAndVoucher(
  transfer: any,
  userId: string,
  useReceivedQty: boolean,
  session: ClientSession,
) {
  const voucherLines: any[] = [];
  const senderName = locationName(transfer.sender);
  const receiverName = locationName(transfer.receiver);

  for (const item of transfer.items) {
    const qty = useReceivedQty ? (item.receivedQty || 0) : item.finalQty;
    if (qty <= 0) continue;

    const prodId = String(item.productId?._id || item.productId);
    const senderId = String(transfer.sender?._id || transfer.sender);
    const receiverId = String(transfer.receiver?._id || transfer.receiver);

    // Resolve product name (populated or fetch)
    const pName = item.productId?.name || (await productName(prodId, session));

    const { totalCost } = await inventoryCostService.consume("Product", prodId, senderId, qty, "FIFO", session);
    const unitCost = totalCost / qty;

    // Stock movement records
    await stockTransactionService.create({
      itemType: "Product",
      itemId: prodId,
      locationId: senderId,
      transactionType: "transfer_out",
      quantity: -qty,
      unitCost,
      totalCost,
      transactionDate: now(),
      createdBy: userId,
      remainingQuantity: 0,
    }, session);

    await stockTransactionService.create({
      itemType: "Product",
      itemId: prodId,
      locationId: receiverId,
      transactionType: "transfer_in",
      quantity: qty,
      unitCost,
      totalCost,
      transactionDate: now(),
      createdBy: userId,
      remainingQuantity: qty,
    }, session);

    // Voucher lines – now with clean names
    const senderAccount = await getProductLocationAccount(prodId, senderId, session);
    const receiverAccount = await getProductLocationAccount(prodId, receiverId, session);

    voucherLines.push({
      accountId: receiverAccount._id,
      debit: totalCost,
      credit: 0,
      narration: `Transfer in of ${pName} from ${senderName} to ${receiverName}`,
    });
    voucherLines.push({
      accountId: senderAccount._id,
      debit: 0,
      credit: totalCost,
      narration: `Transfer out of ${pName} to ${receiverName} from ${senderName}`,
    });
  }

  // Create the voucher
  const voucher = await voucherService.create({
    voucherNo: `TR-${transfer.transferNo}-${Date.now()}`,
    date: now(),
    type: "Journal",
    narration: `Stock transfer ${transfer.transferNo} from ${senderName} to ${receiverName}`,
    lines: voucherLines,
    status: "Approved",
    createdBy: userId,
  }, session);
  transfer.voucherId = voucher._id;
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
        status: "REQUESTED",
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
    await reserveBatchStock(doc, actor.userId, session);
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

  if (doc.status !== "REQUESTED" || doc.locked) {
    throw new Error("Only draft transfers can be updated");
  }

  const directBefore = isDirectFactoryTransfer(doc);
  if (directBefore) {
    await releaseVirtualStock(doc, session);
    await releaseBatchReservation(doc, session);
  }

  if (payload.transferNo !== undefined) doc.transferNo = payload.transferNo;
  if (payload.transferType !== undefined) doc.transferType = payload.transferType;
  if (payload.transferMode !== undefined) doc.transferMode = payload.transferMode;
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
    await reserveBatchStock(doc, actor.userId, session);
  }

  await doc.save({ session });
  return getTransferById(String(doc._id), session);
}

async function removeTransferDoc(id: string, session: ClientSession) {
  const doc = await WarehouseTransfer.findById(id).session(session);
  if (!doc) throw new Error("Transfer not found");

  if (doc.status === "SENT" || doc.status === "COMPLETED") {
    throw new Error("Cannot delete after dispatch");
  }

  if (
    isDirectFactoryTransfer(doc) ||
    doc.status === "RECEIVER_NSM_APPROVED" ||
    doc.status === "SENDER_NSM_APPROVED"
  ) {
    await releaseVirtualStock(doc, session);
    await releaseBatchReservation(doc, session);
  }

  await WarehouseTransfer.findByIdAndDelete(id, { session });
  return { deleted: true };
}

// ─── Public service object ──────────────────────────────
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

      if (doc.status !== "REQUESTED") {
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
        await reserveBatchStock(doc, actor.userId, session);
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
      await reserveBatchStock(doc, actor.userId, session);

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
          ["SENDER_NSM_APPROVED", "SENT", "COMPLETED"].includes(doc.status)) ||
        (isFactoryRequestTransfer(doc) &&
          ["RECEIVER_NSM_APPROVED", "SENT", "COMPLETED"].includes(doc.status)) ||
        (isDirectFactoryTransfer(doc) &&
          ["REQUESTED", "SENT", "COMPLETED"].includes(doc.status));

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

      doc.status = "SENT";
      doc.locked = true;
      doc.dispatchedBy = asObjectId(actor.userId);
      doc.dispatchedAt = now();

      addLog(doc, actor, "SENT");

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  // ─── Receive (with partial support) ────────────────────
  async receive(id: string, payload: ReceivePayload, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id)
        .populate(POPULATE)
        .session(session);

      if (!doc) throw new Error("Transfer not found");

      if (doc.status !== "SENT") {
        throw new Error("Transfer must be sent before receiving");
      }

      if (!payload?.mediaId) {
        throw new Error("Signed document mediaId is required");
      }

      if (!doc.printSnapshot) {
        throw new Error("Print snapshot is required before receiving");
      }

      // Update received quantities
      for (const incoming of payload.items) {
        const item = doc.items.find((i: any) => String(i.productId?._id) === incoming.productId);
        if (!item) throw new Error(`Product ${incoming.productId} not in transfer`);
        item.receivedQty = (item.receivedQty || 0) + Number(incoming.receivedQty);
      }

      const allFullyReceived = doc.items.every((item: any) => (item.receivedQty || 0) >= item.finalQty);

      if (allFullyReceived) {
        await releaseBatchReservation(doc, session);
        await finalizePhysicalStock(doc, session);
        await createStockTransactionsAndVoucher(doc, actor.userId, false, session);
        doc.status = "COMPLETED";
        doc.receivedBy = asObjectId(actor.userId);
        doc.receivedAt = now();
        addLog(doc, actor, "COMPLETED", payload.remarks);
      } else {
        doc.status = "HOLD";
        doc.receivedBy = asObjectId(actor.userId);
        doc.receivedAt = now();
        addLog(doc, actor, "HOLD", payload.remarks || "Partial receipt – on hold");
      }

      doc.documents = {
        ...(doc.documents || {}),
        signed: {
          mediaId: asObjectId(payload.mediaId),
          uploadedBy: asObjectId(actor.userId),
          uploadedByName: actor.name || actor.userId,
          uploadedAt: now(),
        },
      };

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  // ─── Complete Received (HOLD → AWAITING_REMAINING) ─────
  async completeReceived(id: string, remarks: string | undefined, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).populate(POPULATE).session(session);
      if (!doc) throw new Error("Transfer not found");
      if (doc.status !== "HOLD") throw new Error("Transfer is not on hold");

      await releaseBatchReservation(doc, session);
      await finalizeReceivedStock(doc, session);
      await createStockTransactionsAndVoucher(doc, actor.userId, true, session);

      doc.status = "AWAITING_REMAINING";
      addLog(doc, actor, "AWAITING_REMAINING", remarks || "Received quantities processed");
      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  // ─── Reverse Remaining ─────────────────────────────────
  async reverseRemaining(id: string, remarks: string | undefined, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).populate(POPULATE).session(session);
      if (!doc) throw new Error("Transfer not found");
      if (doc.status !== "AWAITING_REMAINING") throw new Error("Transfer must be awaiting remaining");

      for (const item of doc.items) {
        const received = item.receivedQty || 0;
        const short = item.finalQty - received;
        if (short > 0) {
          await ProductStock.findOneAndUpdate(
            { productId: item.productId?._id, warehouseId: doc.sender?._id },
            { $inc: { reservedForTransfer: -short } },
            { session },
          );
          await ProductStock.findOneAndUpdate(
            { productId: item.productId?._id, warehouseId: doc.receiver?._id },
            { $inc: { incomingTransfer: -short } },
            { session },
          );
        }
      }

      doc.status = "COMPLETED";
      addLog(doc, actor, "COMPLETED", remarks || "Remaining reversed");
      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },

  // ─── Damage Remaining (with voucher) ───────────────────
  async damageRemaining(id: string, payload: { mediaId: string; reason?: string }, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).populate(POPULATE).session(session);
      if (!doc) throw new Error("Transfer not found");
      if (doc.status !== "AWAITING_REMAINING")
        throw new Error("Transfer must be awaiting remaining");

      // Build damage map
      const damageQtyByProduct: Record<string, number> = {};
      for (const item of doc.items) {
        const received = item.receivedQty || 0;
        const short = item.finalQty - received;
        if (short > 0) {
          damageQtyByProduct[String(item.productId?._id)] = (damageQtyByProduct[String(item.productId?._id)] || 0) + short;
        }
      }
      if (Object.keys(damageQtyByProduct).length === 0)
        throw new Error("No undelivered quantity to damage");

      const voucherLines: any[] = [];

      for (const [prodId, qty] of Object.entries(damageQtyByProduct)) {
        const senderId = String(doc.sender?._id || doc.sender);
        const receiverId = String(doc.receiver?._id || doc.receiver);

        // Product name for voucher
        const product = await Product.findById(prodId).session(session).lean();
        if (!product) throw new Error(`Product ${prodId} not found`);
        const pName = product.name;

        // Adjust sender stock: physical loss + release reservation
        await ProductStock.findOneAndUpdate(
          { productId: prodId, warehouseId: senderId },
          { $inc: { quantity: -qty, reservedForTransfer: -qty }, $set: { lastUpdated: now() } },
          { session },
        );

        // Adjust receiver: cancel incoming transfer
        await ProductStock.findOneAndUpdate(
          { productId: prodId, warehouseId: receiverId },
          { $inc: { incomingTransfer: -qty }, $set: { lastUpdated: now() } },
          { session },
        );

        // Cost consumption
        const { totalCost } = await inventoryCostService.consume("Product", prodId, senderId, qty, "FIFO", session);

        // Wastage stock transaction
        await stockTransactionService.create({
          itemType: "Product",
          itemId: prodId,
          locationId: senderId,
          transactionType: "wastage",
          quantity: -qty,
          unitCost: totalCost / qty,
          totalCost,
          transactionDate: now(),
          createdBy: actor.userId,
          remainingQuantity: 0,
          sourceId: doc._id,
          sourceModel: "WarehouseTransfer",
        }, session);

        // Voucher entries
        const senderAccount = await getProductLocationAccount(prodId, senderId, session);
        const damageAccount = await getDamageLossAccount(pName, session);

        voucherLines.push({
          accountId: damageAccount._id,
          debit: totalCost,
          credit: 0,
          narration: `Goods damaged in transit: ${pName} – Transfer ${doc.transferNo}`,
        });
        voucherLines.push({
          accountId: senderAccount._id,
          debit: 0,
          credit: totalCost,
          narration: `Inventory write-off for damaged ${pName} – Transfer ${doc.transferNo}`,
        });
      }

      if (voucherLines.length > 0) {
        await voucherService.create({
          voucherNo: `DMG-${doc.transferNo}-${Date.now()}`,
          date: now(),
          type: "Journal",
          narration: `Damage write-off for transfer ${doc.transferNo} – ${payload.reason || "Damaged during transit"}`,
          lines: voucherLines,
          status: "Approved",
          createdBy: actor.userId,
        }, session);
      }

      // Mark completed & attach damage doc
      doc.status = "COMPLETED";
      doc.documents = {
        ...(doc.documents || {}),
        damage: {
          mediaId: asObjectId(payload.mediaId),
          uploadedBy: asObjectId(actor.userId),
          uploadedByName: actor.name || actor.userId,
          uploadedAt: now(),
          reason: payload.reason || "Damaged during transit",
        },
      };
      addLog(doc, actor, "COMPLETED", "Remaining damaged and transfer completed");
      await doc.save({ session });

      return getTransferById(String(doc._id), session);
    });
  },

  // ─── Add More Received ─────────────────────────────────
  async addMoreReceived(id: string, payload: { items: { productId: string; additionalQty: number }[] }, user: UserCtx) {
    return withTransaction(async (session) => {
      const actor = normalizeUser(user);
      const doc = await WarehouseTransfer.findById(id).populate(POPULATE).session(session);
      if (!doc) throw new Error("Transfer not found");
      if (doc.status !== "AWAITING_REMAINING") throw new Error("Transfer must be awaiting remaining");

      const addMap: Record<string, number> = {};
      for (const inc of payload.items) {
        const item = doc.items.find((i: any) => String(i.productId?._id) === inc.productId);

        if (!item) throw new Error(`Product ${inc.productId} not in transfer`);
        const addQty = Number(inc.additionalQty);
        if (addQty <= 0) continue;
        addMap[String(item.productId?._id)] = (addMap[String(item.productId?._id)] || 0) + addQty;
        item.receivedQty = (item.receivedQty || 0) + addQty;
      }

      if (Object.keys(addMap).length === 0) throw new Error("No additional quantity provided");

      for (const [prodId, qty] of Object.entries(addMap)) {
        const senderId = String(doc.sender?._id || doc.sender);
        const receiverId = String(doc.receiver?._id || doc.receiver);

        // Fetch product name for voucher narration
        const product = await Product.findById(prodId).session(session).lean();
        const pName = product?.name || "Unknown Product";

        await ProductStock.findOneAndUpdate(
          { productId: prodId, warehouseId: senderId },
          { $inc: { quantity: -qty, reservedForTransfer: -qty } },
          { session },
        );
        await ProductStock.findOneAndUpdate(
          { productId: prodId, warehouseId: receiverId },
          { $inc: { quantity: qty, incomingTransfer: -qty } },
          { session },
        );

        const { totalCost } = await inventoryCostService.consume("Product", prodId, senderId, qty, "FIFO", session);
        const unitCost = totalCost / qty;

        await stockTransactionService.create({
          itemType: "Product", itemId: prodId, locationId: senderId,
          transactionType: "transfer_out", quantity: -qty, unitCost, totalCost,
          transactionDate: now(), createdBy: actor.userId, remainingQuantity: 0,
        }, session);
        await stockTransactionService.create({
          itemType: "Product", itemId: prodId, locationId: receiverId,
          transactionType: "transfer_in", quantity: qty, unitCost, totalCost,
          transactionDate: now(), createdBy: actor.userId, remainingQuantity: qty,
        }, session);

        // Voucher for additional qty – now with real names
        const senderAccount = await getProductLocationAccount(prodId, senderId, session);
        const receiverAccount = await getProductLocationAccount(prodId, receiverId, session);

        await voucherService.create({
          voucherNo: `TR-${doc.transferNo}-ADD-${Date.now()}`,
          date: now(),
          type: "Journal",
          narration: `Additional stock received for transfer ${doc.transferNo} from ${locationName(doc.sender)} to ${locationName(doc.receiver)}`,
          lines: [
            {
              accountId: receiverAccount._id,
              debit: totalCost,
              credit: 0,
              narration: `Additional transfer in of ${pName} from ${locationName(doc.sender)} to ${locationName(doc.receiver)}`,
            },
            {
              accountId: senderAccount._id,
              debit: 0,
              credit: totalCost,
              narration: `Additional transfer out of ${pName} to ${locationName(doc.receiver)} from ${locationName(doc.sender)}`,
            },
          ],
          status: "Approved",
          createdBy: actor.userId,
        }, session);
      }

      const allFullyReceived = doc.items.every((item: any) => (item.receivedQty || 0) >= item.finalQty);
      if (allFullyReceived) {
        doc.status = "COMPLETED";
        addLog(doc, actor, "COMPLETED", "All remaining quantities now received");
      }

      await doc.save({ session });
      return getTransferById(String(doc._id), session);
    });
  },
};