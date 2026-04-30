// src/services/sales-return.service.ts
import { createCrudService } from "./crud.service";
import SalesReturn from "../models/sales-return.model";
import SalesInvoice from "../models/sales-invoice.model";
import SalesOrder from "../models/sales-order.model";
import ProductStock from "../models/productStock.model";
import { Types } from "mongoose";
import QRCode from "qrcode";

type ReturnRole = "M.O" | "A.M" | "R.M" | "N.S.M" | "WAREHOUSE";
type ReturnStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "READY_FOR_PRINT"
  | "PRINTED"
  | "SENT_TO_WAREHOUSE"
  | "WAREHOUSE_RECEIVED"
  | "HOLD"
  | "RESOLVED"
  | "COMPLETED"
  | "REJECTED"
  | "CANCELLED";

const defaultPopulate = [
  {
    path: "customerId",
    select: "name phoneNumber type creditLimit currentDue attachments",
  },
  {
    path: "invoiceReturns.invoiceId",
    select:
      "invoiceNo invoiceDate paymentStatus balanceAmount paidAmount grandTotal warehouseId customerId items",
  },
  { path: "invoiceReturns.orderId", select: "orderNo" },
  { path: "invoiceReturns.items.productId", select: "name price image" },
  { path: "createdBy", select: "name phoneNumber" },
  { path: "updatedBy", select: "name phoneNumber" },
];

const base = createCrudService(SalesReturn, {
  searchFields: ["returnNo"],
  allowedFilterFields: ["status", "customerId", "returnNo"],
  defaultPopulate,
});

function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function todayStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  })
    .format(date)
    .replace(/-/g, "");
}

function firstLetter(s?: string) {
  if (!s || typeof s !== "string") return "X";
  const t = s.trim();
  return t.length ? t[0].toUpperCase() : "X";
}

function mkKey(invoiceId: any, productId: any) {
  return `${invoiceId.toString()}|${productId.toString()}`;
}

function getSoldPieces(invoiceItem: any) {
  return (
    (Number(invoiceItem.qty || 0) || 0) +
    (Number(invoiceItem.bonusQty || 0) || 0)
  );
}

function getInvoiceLineUnitValue(invoiceItem: any) {
  const soldPieces = getSoldPieces(invoiceItem);
  if (soldPieces <= 0) return 0;
  return round2(Number(invoiceItem.lineTotal || 0) / soldPieces);
}

function getLineReturnAmount(invoiceItem: any, qty: number) {
  return round2(getInvoiceLineUnitValue(invoiceItem) * (Number(qty) || 0));
}

function getRequestedQty(item: any) {
  return Number(item.requestedQty || 0);
}

function getEffectiveQtyByStatus(item: any, status: ReturnStatus) {
  switch (status) {
    case "PENDING_AM":
      return getRequestedQty(item);

    case "PENDING_RM":
      return Number(item.amQty || item.requestedQty || 0);

    case "PENDING_NSM":
      return Number(item.rmQty || item.amQty || item.requestedQty || 0);

    case "READY_FOR_PRINT":
    case "PRINTED":
    case "SENT_TO_WAREHOUSE":
      return Number(
        item.nsmQty || item.rmQty || item.amQty || item.requestedQty || 0,
      );

    case "HOLD":
    case "RESOLVED":
    case "WAREHOUSE_RECEIVED":
    case "COMPLETED":
      return Number(
        item.warehouseReceivedQty ||
          item.finalApprovedQty ||
          item.nsmQty ||
          item.rmQty ||
          item.amQty ||
          item.requestedQty ||
          0,
      );

    case "REJECTED":
    case "CANCELLED":
      return 0;

    default:
      return 0;
  }
}

function getCurrentStageQtyForRole(
  item: any,
  role: "A.M" | "R.M" | "N.S.M",
  payloadQty?: number,
) {
  if (typeof payloadQty === "number" && !Number.isNaN(payloadQty)) {
    return Math.max(0, payloadQty);
  }

  if (role === "A.M") return Number(item.requestedQty || 0);
  if (role === "R.M") return Number(item.amQty || item.requestedQty || 0);
  return Number(item.rmQty || item.amQty || item.requestedQty || 0);
}

function getStageField(role: "A.M" | "R.M" | "N.S.M") {
  if (role === "A.M") return "amQty";
  if (role === "R.M") return "rmQty";
  return "nsmQty";
}

function getPrevStageQty(item: any, role: "A.M" | "R.M" | "N.S.M") {
  if (role === "A.M") return Number(item.requestedQty || 0);
  if (role === "R.M") return Number(item.amQty || item.requestedQty || 0);
  return Number(item.rmQty || item.amQty || item.requestedQty || 0);
}

function getStatusAfterApprove(role: "A.M" | "R.M" | "N.S.M") {
  if (role === "A.M") return "PENDING_RM" as const;
  if (role === "R.M") return "PENDING_NSM" as const;
  return "READY_FOR_PRINT" as const;
}

function getExpectedStatusForApprove(role: "A.M" | "R.M" | "N.S.M") {
  if (role === "A.M") return "PENDING_AM" as const;
  if (role === "R.M") return "PENDING_RM" as const;
  return "PENDING_NSM" as const;
}

async function getDealerModel() {
  return SalesReturn.db.model("Dealer");
}

async function getDealerById(customerId: any, session?: any) {
  const Dealer = await getDealerModel();
  let query = Dealer.findById(customerId);
  if (session) query = query.session(session);
  const dealer = await query;
  if (!dealer) throw new Error("Dealer not found");
  return dealer;
}

async function getInvoiceById(invoiceId: string, session?: any) {
  let query = SalesInvoice.findById(invoiceId);
  if (session) query = query.session(session);
  const invoice = await query;
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}

async function getOrderById(orderId: string, session?: any) {
  let query = SalesOrder.findById(orderId);
  if (session) query = query.session(session);
  const order = await query;
  if (!order) throw new Error("Order not found");
  return order;
}

function buildReturnQrPayload(returnDoc: any) {
  const invoiceIds = (returnDoc.invoiceReturns || []).map((b: any) =>
    String(b.invoiceId),
  );

  return JSON.stringify({
    returnId: String(returnDoc._id),
    returnNo: String(returnDoc.returnNo),
    customerId: String(returnDoc.customerId),
    invoiceIds,
    totalApprovedAmount: Number(returnDoc.totalApprovedAmount || 0),
    totalRequestedAmount: Number(returnDoc.totalRequestedAmount || 0),
    status: String(returnDoc.status),
  });
}

async function generateReturnQrImage(returnDoc: any): Promise<string> {
  const payload = returnDoc.qrCode || buildReturnQrPayload(returnDoc);
  return QRCode.toDataURL(payload, {
    type: "image/png",
    margin: 2,
    width: 260,
    errorCorrectionLevel: "M",
  });
}

async function generateReturnNo(payload: any, session: any) {
  const Dealer = SalesReturn.db.model("Dealer");

  const dealer = await Dealer.findById(payload.customerId)
    .select("territory area region zone")
    .session(session)
    .lean();

  const prefix =
    firstLetter(dealer?.territory?.name) +
    firstLetter(dealer?.area?.name) +
    firstLetter(dealer?.region?.name) +
    firstLetter(dealer?.zone?.name);

  const dateStamp = todayStamp();
  const regex = new RegExp(`^SR-${prefix}-${dateStamp}-(\\d{5})$`);

  const last = await SalesReturn.find({ returnNo: regex })
    .sort({ returnNo: -1 })
    .limit(1)
    .select("returnNo")
    .session(session)
    .lean();

  let next = 1;
  if (last.length) {
    const m = last[0].returnNo.match(regex);
    if (m?.[1]) next = parseInt(m[1], 10) + 1;
  }

  return `SR-${prefix}-${dateStamp}-${String(next).padStart(5, "0")}`;
}

async function getReturnUsageSnapshot(
  invoiceIds: string[],
  excludeReturnId?: string,
  session?: any,
) {
  const invoiceObjectIds = invoiceIds.map((id) => new Types.ObjectId(id));

  const query: any = {
    "invoiceReturns.invoiceId": { $in: invoiceObjectIds },
    status: { $nin: ["REJECTED", "CANCELLED"] },
  };

  if (excludeReturnId) {
    query._id = { $ne: new Types.ObjectId(excludeReturnId) };
  }

  let q = SalesReturn.find(query).select("status invoiceReturns");
  if (session) q = q.session(session);

  const returns = await q.lean();

  const qtyByInvoiceProduct = new Map<string, number>();
  const amountByInvoice = new Map<string, number>();

  for (const ret of returns || []) {
    for (const block of ret.invoiceReturns || []) {
      const invoiceId = String(block.invoiceId);

      for (const item of block.items || []) {
        const qty = getEffectiveQtyByStatus(item, ret.status as ReturnStatus);
        const invoiceItem = {
          qty: item.soldQty,
          bonusQty: item.soldBonusQty,
          lineTotal: item.soldLineTotal,
        };

        const amount = getLineReturnAmount(invoiceItem, qty);
        const key = mkKey(invoiceId, item.productId);

        qtyByInvoiceProduct.set(key, (qtyByInvoiceProduct.get(key) || 0) + qty);
        amountByInvoice.set(
          invoiceId,
          (amountByInvoice.get(invoiceId) || 0) + amount,
        );
      }
    }
  }

  return { qtyByInvoiceProduct, amountByInvoice };
}

function findReturnBlock(returnDoc: any, invoiceId: string) {
  return (returnDoc.invoiceReturns || []).find(
    (b: any) => String(b.invoiceId) === String(invoiceId),
  );
}

function findBlockItem(block: any, productId: string) {
  return (block?.items || []).find(
    (i: any) => String(i.productId) === String(productId),
  );
}

function recalcSummary(returnDoc: any) {
  let requested = 0;
  let approved = 0;
  let received = 0;

  for (const block of returnDoc.invoiceReturns || []) {
    for (const item of block.items || []) {
      requested += getRequestedQty(item);
      approved += Number(item.finalApprovedQty || 0);
      received += Number(item.warehouseReceivedQty || 0);
    }
  }

  returnDoc.totalRequestedAmount = round2(requested);
  returnDoc.totalApprovedAmount = round2(approved);
  returnDoc.totalReceivedAmount = round2(received);
}

async function validateCapacityAgainstInvoices(
  returnDoc: any,
  session: any,
  excludeReturnId?: string,
  role?: "A.M" | "R.M" | "N.S.M" | "WAREHOUSE" | "CREATE",
) {
  const invoiceIds = (returnDoc.invoiceReturns || []).map((b: any) =>
    String(b.invoiceId),
  );
  const usage = await getReturnUsageSnapshot(
    invoiceIds,
    excludeReturnId,
    session,
  );

  for (const block of returnDoc.invoiceReturns || []) {
    const invoice = await getInvoiceById(String(block.invoiceId), session);

    if (String(invoice.customerId) !== String(returnDoc.customerId)) {
      throw new Error("Invoice does not belong to the selected dealer");
    }

    if (invoice.status !== "ACTIVE") {
      throw new Error(`Invoice ${invoice.invoiceNo} is not active`);
    }

    if (
      invoice.paymentStatus === "PAID" ||
      Number(invoice.balanceAmount || 0) <= 0
    ) {
      throw new Error(
        `Fully paid invoice ${invoice.invoiceNo} cannot be returned`,
      );
    }

    const invoiceBalanceSnapshot = Number(
      block.balanceAmountSnapshot || invoice.balanceAmount || 0,
    );
    const invoiceUsedAmount = Number(
      usage.amountByInvoice.get(String(block.invoiceId)) || 0,
    );
    const invoiceRemainingAmount = round2(
      invoiceBalanceSnapshot - invoiceUsedAmount,
    );

    let blockStageAmount = 0;

    for (const item of block.items || []) {
      const invoiceItem = (invoice.items || []).find(
        (invItem: any) => String(invItem.productId) === String(item.productId),
      );

      if (!invoiceItem) {
        throw new Error(
          `Product ${String(item.productId)} was not sold in invoice ${invoice.invoiceNo}`,
        );
      }

      const soldPieces = getSoldPieces(invoiceItem);
      const key = mkKey(block.invoiceId, item.productId);
      const usedQty = Number(usage.qtyByInvoiceProduct.get(key) || 0);

      const stageQty =
        role && role !== "CREATE"
          ? getCurrentStageQtyForRole(
              item,
              role === "CREATE" ? "A.M" : (role as "A.M" | "R.M" | "N.S.M"),
              undefined,
            )
          : getRequestedQty(item);

      if (stageQty <= 0) {
        throw new Error(
          `Return qty must be greater than zero for product ${invoiceItem.productId}`,
        );
      }

      const remainingQty = soldPieces - usedQty;

      if (stageQty > remainingQty) {
        throw new Error(
          `Return qty for product ${String(item.productId)} exceeds available qty in invoice ${invoice.invoiceNo}`,
        );
      }

      blockStageAmount += getLineReturnAmount(invoiceItem, stageQty);
    }

    if (blockStageAmount > invoiceRemainingAmount) {
      throw new Error(
        `Return amount for invoice ${invoice.invoiceNo} exceeds remaining refundable amount`,
      );
    }
  }
}

function getStageQtyFromPayload(
  payloadBlock: any,
  payloadItem: any,
  role: "A.M" | "R.M" | "N.S.M",
  currentItem: any,
) {
  const qtyFromPayload =
    payloadItem?.qty !== undefined ? Number(payloadItem.qty) : undefined;

  if (typeof qtyFromPayload === "number" && !Number.isNaN(qtyFromPayload)) {
    return Math.max(0, qtyFromPayload);
  }

  return getCurrentStageQtyForRole(currentItem, role);
}

async function applyApprovalStage(
  returnDoc: any,
  role: "A.M" | "R.M" | "N.S.M",
  payload: any,
  session: any,
  userId: string,
) {
  const payloadBlocks = Array.isArray(payload?.invoiceReturns)
    ? payload.invoiceReturns
    : [];
  const payloadBlockMap = new Map<string, any>();
  for (const b of payloadBlocks) {
    payloadBlockMap.set(String(b.invoiceId), b);
  }

  for (const block of returnDoc.invoiceReturns || []) {
    const payloadBlock = payloadBlockMap.get(String(block.invoiceId)) || {};
    const payloadItemMap = new Map<string, any>();
    for (const i of payloadBlock.items || []) {
      payloadItemMap.set(String(i.productId), i);
    }

    const invoice = await getInvoiceById(String(block.invoiceId), session);

    for (const item of block.items || []) {
      const payloadItem = payloadItemMap.get(String(item.productId));
      const qty = getStageQtyFromPayload(payloadBlock, payloadItem, role, item);

      const invoiceItem = (invoice.items || []).find(
        (invItem: any) => String(invItem.productId) === String(item.productId),
      );
      const soldPieces = getSoldPieces(invoiceItem);

      const key = mkKey(block.invoiceId, item.productId);
      const usage = await getReturnUsageSnapshot(
        [String(block.invoiceId)],
        String(returnDoc._id),
        session,
      );
      const usedQty = Number(usage.qtyByInvoiceProduct.get(key) || 0);
      const remainingQty = soldPieces - usedQty;

      if (qty <= 0) {
        throw new Error(
          `Qty must be greater than zero for product ${String(item.productId)}`,
        );
      }

      if (qty > remainingQty) {
        throw new Error(
          `Qty for product ${String(item.productId)} exceeds available quantity on invoice ${invoice.invoiceNo}`,
        );
      }

      const stageField = getStageField(role);
      item[stageField] = qty;
      item.status = "APPROVED";
      item.qtyAuditLogs = item.qtyAuditLogs || [];
      item.qtyAuditLogs.push({
        stage: role,
        qty,
        remarks: payloadItem?.notes || payloadItem?.remarks || payload?.remarks,
        userId: new Types.ObjectId(userId),
        actionDate: new Date(),
      });

      if (role === "N.S.M") {
        item.finalApprovedQty = qty;
        item.returnAmountEstimate = getLineReturnAmount(invoiceItem, qty);
        item.finalReturnAmount = item.returnAmountEstimate;
      } else {
        item.returnAmountEstimate = getLineReturnAmount(invoiceItem, qty);
      }
    }
  }

  returnDoc.totalApprovedAmount = round2(
    (returnDoc.invoiceReturns || []).reduce((sum: number, block: any) => {
      return (
        sum +
        (block.items || []).reduce((blockSum: number, item: any) => {
          return (
            blockSum +
            Number(
              item.finalApprovedQty ||
                item.nsmQty ||
                item.rmQty ||
                item.amQty ||
                item.requestedQty ||
                0,
            ) *
              0
          );
        }, 0)
      );
    }, 0),
  );

  let approvedAmount = 0;
  for (const block of returnDoc.invoiceReturns || []) {
    const invoice = await getInvoiceById(String(block.invoiceId), session);
    for (const item of block.items || []) {
      const invoiceItem = (invoice.items || []).find(
        (invItem: any) => String(invItem.productId) === String(item.productId),
      );
      const qty =
        role === "A.M"
          ? Number(item.amQty || item.requestedQty || 0)
          : role === "R.M"
            ? Number(item.rmQty || item.amQty || item.requestedQty || 0)
            : Number(
                item.finalApprovedQty ||
                  item.nsmQty ||
                  item.rmQty ||
                  item.amQty ||
                  item.requestedQty ||
                  0,
              );

      approvedAmount += getLineReturnAmount(invoiceItem, qty);
    }
  }

  returnDoc.totalApprovedAmount = round2(approvedAmount);

  if (role === "N.S.M") {
    returnDoc.status = "READY_FOR_PRINT";
    returnDoc.qrCode = buildReturnQrPayload(returnDoc);
  } else if (role === "A.M") {
    returnDoc.status = "PENDING_RM";
  } else if (role === "R.M") {
    returnDoc.status = "PENDING_NSM";
  }

  returnDoc.approvalLogs.push({
    role,
    userId: new Types.ObjectId(userId),
    status: "APPROVED",
    remarks: payload?.remarks,
    actionDate: new Date(),
  });
}

async function finalizeCompletion(
  returnDoc: any,
  session: any,
  userId: string,
  remarks?: string,
) {
  let totalReceivedAmount = 0;

  for (const block of returnDoc.invoiceReturns || []) {
    let invoiceReceivedAmount = 0;

    const invoice = await getInvoiceById(String(block.invoiceId), session);
    const usage = await getReturnUsageSnapshot(
      [String(block.invoiceId)],
      String(returnDoc._id),
      session,
    );
    const otherAmountUsed = Number(
      usage.amountByInvoice.get(String(block.invoiceId)) || 0,
    );

    for (const item of block.items || []) {
      const invoiceItem = (invoice.items || []).find(
        (invItem: any) => String(invItem.productId) === String(item.productId),
      );

      const soldPieces = getSoldPieces(invoiceItem);
      const receivedQty = Number(
        item.warehouseReceivedQty ||
          item.finalApprovedQty ||
          item.nsmQty ||
          item.rmQty ||
          item.amQty ||
          item.requestedQty ||
          0,
      );

      if (receivedQty <= 0) {
        throw new Error(
          `Received qty must be greater than zero for product ${String(item.productId)}`,
        );
      }

      if (receivedQty > soldPieces) {
        throw new Error(
          `Received qty for product ${String(item.productId)} exceeds sold qty`,
        );
      }

      item.warehouseReceivedQty = receivedQty;
      item.finalReturnAmount = getLineReturnAmount(invoiceItem, receivedQty);
      item.status = "COMPLETED";

      totalReceivedAmount += item.finalReturnAmount;
      invoiceReceivedAmount += item.finalReturnAmount;
    }

    const invoiceBalanceSnapshot = Number(
      block.balanceAmountSnapshot || invoice.balanceAmount || 0,
    );
    const remainingRefundable = round2(
      invoiceBalanceSnapshot - otherAmountUsed,
    );

    // if (totalReceivedAmount > remainingRefundable) {
    //   throw new Error(
    //     `Final return amount exceeds refundable balance for invoice ${invoice.invoiceNo}`,
    //   );
    // }

    if (invoiceReceivedAmount > remainingRefundable) {
      throw new Error(
        `Final return amount exceeds refundable balance for invoice ${invoice.invoiceNo}`,
      );
    }
  }

  for (const block of returnDoc.invoiceReturns || []) {
    for (const item of block.items || []) {
      const receivedQty = Number(item.warehouseReceivedQty || 0);
      const invoice = await getInvoiceById(String(block.invoiceId), session);
      const invoiceItem = (invoice.items || []).find(
        (invItem: any) => String(invItem.productId) === String(item.productId),
      );

      const stock = await ProductStock.findOne({
        productId: item.productId,
        warehouseId: block.warehouseId,
      }).session(session);

      if (!stock) {
        throw new Error(
          `Stock not found for product ${String(item.productId)} in warehouse`,
        );
      }

      stock.quantity = (stock.quantity || 0) + receivedQty;
      stock.lastUpdated = new Date();
      await stock.save({ session });
    }
  }

  const Dealer = SalesReturn.db.model("Dealer");
  const dealer = await Dealer.findById(returnDoc.customerId).session(session);
  if (dealer) {
    dealer.currentDue = Math.max(
      0,
      (dealer.currentDue || 0) - totalReceivedAmount,
    );
    await dealer.save({ session });
  }

  returnDoc.totalReceivedAmount = round2(totalReceivedAmount);
  returnDoc.dealerDueReductionAmount = round2(totalReceivedAmount);
  returnDoc.warehouseReceived = true;
  returnDoc.warehouseReceivedAt = new Date();
  returnDoc.completedAt = new Date();
  returnDoc.status = "COMPLETED";

  returnDoc.approvalLogs.push({
    role: "WAREHOUSE",
    userId: new Types.ObjectId(userId),
    status: "APPROVED",
    remarks,
    actionDate: new Date(),
  });

  returnDoc.updatedBy = new Types.ObjectId(userId);
  await returnDoc.save({ session });
}

export const salesReturnService = {
  ...base,

  async getPrintableReturnData(returnId: string) {
    const returnDoc: any = await SalesReturn.findById(returnId).populate(
      defaultPopulate as any,
    );

    if (!returnDoc) throw new Error("Sales return not found");

    if (!returnDoc.qrCode) {
      returnDoc.qrCode = buildReturnQrPayload(returnDoc);
    }

    const qrCodeImage = await generateReturnQrImage(returnDoc);

    return {
      returnDoc,
      qrCodeImage,
      qrCodeData: returnDoc.qrCode,
      printPayload: {
        returnNo: returnDoc.returnNo,
        customerId: returnDoc.customerId,
        invoiceReturns: returnDoc.invoiceReturns,
        totalRequestedAmount: returnDoc.totalRequestedAmount,
        totalApprovedAmount: returnDoc.totalApprovedAmount,
        totalReceivedAmount: returnDoc.totalReceivedAmount,
      },
    };
  },

  async create(payload: any) {
    return base.withTransaction(async (session) => {
      if (!payload.customerId) throw new Error("customerId is required");
      if (
        !Array.isArray(payload.invoiceReturns) ||
        payload.invoiceReturns.length === 0
      ) {
        throw new Error("invoiceReturns are required");
      }
      if (!payload.createdBy) throw new Error("createdBy is required");

      const dealer = await getDealerById(payload.customerId, session);

      const invoiceIds = payload.invoiceReturns.map((b: any) =>
        String(b.invoiceId),
      );
      const uniqueInvoiceIds = [...new Set(invoiceIds)];

      const returnNo = await generateReturnNo(payload, session);

      const normalizedBlocks: any[] = [];

      for (const blockPayload of payload.invoiceReturns) {
        if (!blockPayload.invoiceId)
          throw new Error("invoiceId is required in invoiceReturns");
        if (
          !Array.isArray(blockPayload.items) ||
          blockPayload.items.length === 0
        ) {
          throw new Error("Each invoice return must have at least one product");
        }

        const invoice = await getInvoiceById(
          String(blockPayload.invoiceId),
          session,
        );

        if (String(invoice.customerId) !== String(dealer._id)) {
          throw new Error(
            `Invoice ${invoice.invoiceNo} does not belong to the selected dealer`,
          );
        }

        if (invoice.status !== "ACTIVE") {
          throw new Error(`Invoice ${invoice.invoiceNo} is not active`);
        }

        if (
          invoice.paymentStatus === "PAID" ||
          Number(invoice.balanceAmount || 0) <= 0
        ) {
          throw new Error(
            `Fully paid invoice ${invoice.invoiceNo} cannot be returned`,
          );
        }

        const block: any = {
          invoiceId: invoice._id,
          orderId: invoice.orderId,
          warehouseId: invoice.warehouseId,
          invoiceNoSnapshot: invoice.invoiceNo,
          paymentStatusSnapshot: invoice.paymentStatus,
          paidAmountSnapshot: Number(invoice.paidAmount || 0),
          balanceAmountSnapshot: Number(invoice.balanceAmount || 0),
          grandTotalSnapshot: Number(invoice.grandTotal || 0),
          items: [],
        };

        for (const itemPayload of blockPayload.items) {
          if (!itemPayload.productId)
            throw new Error("productId is required for return item");
          const qty = Number(itemPayload.qty || 0);
          if (qty <= 0) throw new Error("Return qty must be greater than zero");

          const invoiceItem = (invoice.items || []).find(
            (invItem: any) =>
              String(invItem.productId) === String(itemPayload.productId),
          );

          if (!invoiceItem) {
            throw new Error(
              `Product ${String(itemPayload.productId)} was not sold in invoice ${invoice.invoiceNo}`,
            );
          }

          const soldPieces = getSoldPieces(invoiceItem);
          const usage = await getReturnUsageSnapshot(
            [String(invoice._id)],
            undefined,
            session,
          );
          const key = mkKey(invoice._id, itemPayload.productId);
          const usedQty = Number(usage.qtyByInvoiceProduct.get(key) || 0);

          if (qty > soldPieces - usedQty) {
            throw new Error(
              `Return qty for product ${String(itemPayload.productId)} exceeds available qty in invoice ${invoice.invoiceNo}`,
            );
          }

          const returnAmountEstimate = getLineReturnAmount(invoiceItem, qty);

          block.items.push({
            productId: invoiceItem.productId,
            soldQty: Number(invoiceItem.qty || 0),
            soldBonusQty: Number(invoiceItem.bonusQty || 0),
            soldUnitPrice: Number(invoiceItem.unitPrice || 0),
            soldLineSubtotal: Number(invoiceItem.lineSubtotal || 0),
            soldLineTotal: Number(invoiceItem.lineTotal || 0),
            requestedQty: qty,
            amQty: 0,
            rmQty: 0,
            nsmQty: 0,
            finalApprovedQty: 0,
            warehouseReceivedQty: 0,
            returnAmountEstimate,
            finalReturnAmount: 0,
            reason: itemPayload.reason,
            notes: itemPayload.notes,
            status: "PENDING",
            qtyAuditLogs: [
              {
                stage: "M.O",
                qty,
                remarks: itemPayload.notes || itemPayload.reason,
                actionDate: new Date(),
                userId: new Types.ObjectId(payload.createdBy),
              },
            ],
          });
        }

        normalizedBlocks.push(block);
      }

      const doc = new SalesReturn({
        returnNo,
        customerId: dealer._id,
        invoiceReturns: normalizedBlocks,
        status: "PENDING_AM",
        approvalLogs: [
          {
            role: "M.O",
            userId: new Types.ObjectId(payload.createdBy),
            status: "APPROVED",
            remarks: payload.notes || "Sales return created",
            actionDate: new Date(),
          },
        ],
        printCount: 0,
        totalRequestedAmount: 0,
        totalApprovedAmount: 0,
        totalReceivedAmount: 0,
        dealerDueReductionAmount: 0,
        warehouseReceived: false,
        notes: payload.notes,
        isActive: true,
        createdBy: new Types.ObjectId(payload.createdBy),
        updatedBy: payload.updatedBy
          ? new Types.ObjectId(payload.updatedBy)
          : undefined,
      });

      recalcSummary(doc);
      await validateCapacityAgainstInvoices(doc, session, undefined, "CREATE");

      await doc.save({ session });

      return doc.toObject();
    });
  },

  async approve(
    returnId: string,
    role: "A.M" | "R.M" | "N.S.M",
    userId: string,
    payload: any = {},
  ) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      const expectedStatus = getExpectedStatusForApprove(role);

      if (returnDoc.status !== expectedStatus) {
        throw new Error(`Sales return is not in ${expectedStatus} status`);
      }

      if (["REJECTED", "CANCELLED", "COMPLETED"].includes(returnDoc.status)) {
        throw new Error("This sales return can no longer be approved");
      }

      const payloadBlocks = Array.isArray(payload.invoiceReturns)
        ? payload.invoiceReturns
        : [];
      const payloadBlockMap = new Map<string, any>();
      for (const b of payloadBlocks) {
        payloadBlockMap.set(String(b.invoiceId), b);
      }

      for (const block of returnDoc.invoiceReturns || []) {
        const payloadBlock = payloadBlockMap.get(String(block.invoiceId)) || {};
        const payloadItemMap = new Map<string, any>();
        for (const i of payloadBlock.items || []) {
          payloadItemMap.set(String(i.productId), i);
        }

        const invoice = await getInvoiceById(String(block.invoiceId), session);
        const usage = await getReturnUsageSnapshot(
          [String(block.invoiceId)],
          String(returnDoc._id),
          session,
        );

        let blockAmount = 0;

        for (const item of block.items || []) {
          const invoiceItem = (invoice.items || []).find(
            (invItem: any) =>
              String(invItem.productId) === String(item.productId),
          );

          if (!invoiceItem) {
            throw new Error(
              `Product ${String(item.productId)} was not sold in invoice ${invoice.invoiceNo}`,
            );
          }

          const payloadItem = payloadItemMap.get(String(item.productId));
          const qty = getCurrentStageQtyForRole(
            item,
            role,
            payloadItem?.qty !== undefined
              ? Number(payloadItem.qty)
              : undefined,
          );

          const soldPieces = getSoldPieces(invoiceItem);
          const key = mkKey(block.invoiceId, item.productId);
          const usedQty = Number(usage.qtyByInvoiceProduct.get(key) || 0);
          const remainingQty = soldPieces - usedQty;

          if (qty <= 0) {
            throw new Error(
              `Qty must be greater than zero for product ${String(item.productId)}`,
            );
          }

          if (qty > remainingQty) {
            throw new Error(
              `Qty for product ${String(item.productId)} exceeds available quantity in invoice ${invoice.invoiceNo}`,
            );
          }

          const stageField = getStageField(role);
          item[stageField] = qty;
          item.status = "APPROVED";
          item.returnAmountEstimate = getLineReturnAmount(invoiceItem, qty);
          item.qtyAuditLogs = item.qtyAuditLogs || [];
          item.qtyAuditLogs.push({
            stage: role,
            qty,
            remarks:
              payloadItem?.remarks || payloadItem?.notes || payload.remarks,
            userId: new Types.ObjectId(userId),
            actionDate: new Date(),
          });

          if (role === "N.S.M") {
            item.finalApprovedQty = qty;
            item.finalReturnAmount = item.returnAmountEstimate;
          }

          blockAmount += item.returnAmountEstimate;
        }

        const invoiceBalanceSnapshot = Number(
          block.balanceAmountSnapshot || invoice.balanceAmount || 0,
        );
        const otherUsage = Number(
          usage.amountByInvoice.get(String(block.invoiceId)) || 0,
        );
        const remainingAmount = round2(invoiceBalanceSnapshot - otherUsage);

        if (blockAmount > remainingAmount) {
          throw new Error(
            `Return amount for invoice ${invoice.invoiceNo} exceeds remaining refundable amount`,
          );
        }
      }

      returnDoc.totalApprovedAmount = round2(
        (returnDoc.invoiceReturns || []).reduce((sum: number, block: any) => {
          return (
            sum +
            (block.items || []).reduce((bSum: number, item: any) => {
              return bSum + Number(item.returnAmountEstimate || 0);
            }, 0)
          );
        }, 0),
      );

      returnDoc.status = getStatusAfterApprove(role);

      if (role === "N.S.M") {
        returnDoc.qrCode = buildReturnQrPayload(returnDoc);
      }

      returnDoc.approvalLogs.push({
        role,
        userId: new Types.ObjectId(userId),
        status: "APPROVED",
        remarks: payload.remarks,
        actionDate: new Date(),
      });

      returnDoc.updatedBy = new Types.ObjectId(userId);
      await validateCapacityAgainstInvoices(
        returnDoc,
        session,
        String(returnDoc._id),
        role,
      );
      await returnDoc.save({ session });

      return returnDoc.toObject();
    });
  },

  async reject(
    returnId: string,
    role: ReturnRole,
    userId: string,
    remarks?: string,
  ) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (["REJECTED", "CANCELLED", "COMPLETED"].includes(returnDoc.status)) {
        throw new Error("Sales return can no longer be rejected");
      }

      returnDoc.status = "REJECTED";
      returnDoc.approvalLogs.push({
        role,
        userId: new Types.ObjectId(userId),
        status: "REJECTED",
        remarks,
        actionDate: new Date(),
      });

      returnDoc.updatedBy = new Types.ObjectId(userId);
      await returnDoc.save({ session });
      return returnDoc.toObject();
    });
  },

  async hold(
    returnId: string,
    userId: string,
    remarks?: string,
    holdReason?: string,
  ) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (["COMPLETED", "CANCELLED", "REJECTED"].includes(returnDoc.status)) {
        throw new Error("Sales return can no longer be put on hold");
      }

      returnDoc.status = "HOLD";
      returnDoc.holdReason = holdReason || remarks || "Manual hold";
      returnDoc.holdRemarks = remarks;
      returnDoc.approvalLogs.push({
        role: "WAREHOUSE",
        userId: new Types.ObjectId(userId),
        status: "PENDING",
        remarks: remarks || holdReason,
        actionDate: new Date(),
      });

      returnDoc.updatedBy = new Types.ObjectId(userId);
      await returnDoc.save({ session });
      return returnDoc.toObject();
    });
  },

  async resolveHold(returnId: string, userId: string, payload: any = {}) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (returnDoc.status !== "HOLD") {
        throw new Error("Sales return is not on hold");
      }

      const payloadBlocks = Array.isArray(payload.invoiceReturns)
        ? payload.invoiceReturns
        : [];
      const payloadBlockMap = new Map<string, any>();
      for (const b of payloadBlocks) {
        payloadBlockMap.set(String(b.invoiceId), b);
      }

      for (const block of returnDoc.invoiceReturns || []) {
        const payloadBlock = payloadBlockMap.get(String(block.invoiceId)) || {};
        const payloadItemMap = new Map<string, any>();
        for (const i of payloadBlock.items || []) {
          payloadItemMap.set(String(i.productId), i);
        }

        const invoice = await getInvoiceById(String(block.invoiceId), session);

        for (const item of block.items || []) {
          const payloadItem = payloadItemMap.get(String(item.productId));
          const receivedQty =
            payloadItem?.receivedQty !== undefined
              ? Number(payloadItem.receivedQty)
              : Number(
                  item.warehouseReceivedQty ||
                    item.finalApprovedQty ||
                    item.nsmQty ||
                    item.rmQty ||
                    item.amQty ||
                    item.requestedQty ||
                    0,
                );

          if (receivedQty <= 0) {
            throw new Error(
              `Received qty must be greater than zero for product ${String(item.productId)}`,
            );
          }

          const invoiceItem = (invoice.items || []).find(
            (invItem: any) =>
              String(invItem.productId) === String(item.productId),
          );

          if (!invoiceItem) {
            throw new Error(
              `Product ${String(item.productId)} was not sold in invoice ${invoice.invoiceNo}`,
            );
          }

          if (receivedQty > getSoldPieces(invoiceItem)) {
            throw new Error(
              `Received qty for product ${String(item.productId)} exceeds sold qty`,
            );
          }

          item.warehouseReceivedQty = receivedQty;
          item.finalReturnAmount = getLineReturnAmount(
            invoiceItem,
            receivedQty,
          );
          item.status = "APPROVED";
        }
      }

      returnDoc.status = "RESOLVED";
      returnDoc.resolvedAt = new Date();
      returnDoc.holdReason = undefined;
      returnDoc.holdRemarks = payload.remarks || returnDoc.holdRemarks;
      returnDoc.updatedBy = new Types.ObjectId(userId);

      returnDoc.approvalLogs.push({
        role: "WAREHOUSE",
        userId: new Types.ObjectId(userId),
        status: "APPROVED",
        remarks: payload.remarks || "Hold resolved",
        actionDate: new Date(),
      });

      await returnDoc.save({ session });
      return returnDoc.toObject();
    });
  },

  async markPrinted(returnId: string, userId: string) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (!["READY_FOR_PRINT", "PRINTED"].includes(returnDoc.status)) {
        throw new Error("Sales return is not ready to print");
      }

      returnDoc.printCount = Number(returnDoc.printCount || 0) + 1;
      returnDoc.lastPrintedAt = new Date();
      returnDoc.status = "PRINTED";
      returnDoc.updatedBy = new Types.ObjectId(userId);

      returnDoc.approvalLogs.push({
        role: "M.O",
        userId: new Types.ObjectId(userId),
        status: "APPROVED",
        remarks: "Printed",
        actionDate: new Date(),
      });

      await returnDoc.save({ session });
      return returnDoc.toObject();
    });
  },

  async sendToWarehouse(returnId: string, userId: string, remarks?: string) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (returnDoc.status !== "PRINTED") {
        throw new Error(
          "Sales return must be printed before sending to warehouse",
        );
      }

      returnDoc.status = "SENT_TO_WAREHOUSE";
      returnDoc.submittedAt = new Date();
      returnDoc.updatedBy = new Types.ObjectId(userId);

      returnDoc.approvalLogs.push({
        role: "M.O",
        userId: new Types.ObjectId(userId),
        status: "APPROVED",
        remarks: remarks || "Sent to warehouse",
        actionDate: new Date(),
      });

      await returnDoc.save({ session });
      return returnDoc.toObject();
    });
  },

  async warehouseReceive(returnId: string, userId: string, payload: any = {}) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (returnDoc.status !== "SENT_TO_WAREHOUSE") {
        throw new Error("Sales return is not in warehouse receiving stage");
      }

      const payloadBlocks = Array.isArray(payload.invoiceReturns)
        ? payload.invoiceReturns
        : [];
      const payloadBlockMap = new Map<string, any>();
      for (const b of payloadBlocks) {
        payloadBlockMap.set(String(b.invoiceId), b);
      }

      let exactMatch = true;

      for (const block of returnDoc.invoiceReturns || []) {
        const payloadBlock = payloadBlockMap.get(String(block.invoiceId)) || {};
        const payloadItemMap = new Map<string, any>();
        for (const i of payloadBlock.items || []) {
          payloadItemMap.set(String(i.productId), i);
        }

        const invoice = await getInvoiceById(String(block.invoiceId), session);

        for (const item of block.items || []) {
          const payloadItem = payloadItemMap.get(String(item.productId));
          const receivedQty =
            payloadItem?.receivedQty !== undefined
              ? Number(payloadItem.receivedQty)
              : Number(
                  item.finalApprovedQty ||
                    item.nsmQty ||
                    item.rmQty ||
                    item.amQty ||
                    item.requestedQty ||
                    0,
                );

          const invoiceItem = (invoice.items || []).find(
            (invItem: any) =>
              String(invItem.productId) === String(item.productId),
          );

          if (!invoiceItem) {
            throw new Error(
              `Product ${String(item.productId)} was not sold in invoice ${invoice.invoiceNo}`,
            );
          }

          const approvedQty = Number(
            item.finalApprovedQty ||
              item.nsmQty ||
              item.rmQty ||
              item.amQty ||
              item.requestedQty ||
              0,
          );

          item.warehouseReceivedQty = receivedQty;
          item.finalReturnAmount = getLineReturnAmount(
            invoiceItem,
            receivedQty,
          );

          if (receivedQty !== approvedQty) {
            exactMatch = false;
            item.status = "HOLD";
          } else {
            item.status = "APPROVED";
          }
        }
      }

      if (!exactMatch) {
        returnDoc.status = "HOLD";
        returnDoc.holdReason =
          payload.holdReason ||
          "Warehouse received qty does not match printed qty";
        returnDoc.holdRemarks = payload.remarks;
        returnDoc.updatedBy = new Types.ObjectId(userId);

        returnDoc.approvalLogs.push({
          role: "WAREHOUSE",
          userId: new Types.ObjectId(userId),
          status: "PENDING",
          remarks: payload.remarks || returnDoc.holdReason,
          actionDate: new Date(),
        });

        await returnDoc.save({ session });
        return returnDoc.toObject();
      }

      returnDoc.status = "WAREHOUSE_RECEIVED";
      returnDoc.warehouseReceivedAt = new Date();
      returnDoc.updatedBy = new Types.ObjectId(userId);

      returnDoc.approvalLogs.push({
        role: "WAREHOUSE",
        userId: new Types.ObjectId(userId),
        status: "APPROVED",
        remarks: payload.remarks || "Warehouse received",
        actionDate: new Date(),
      });

      await returnDoc.save({ session });

      await finalizeCompletion(
        returnDoc,
        session,
        userId,
        payload.remarks || "Warehouse received",
      );
      return returnDoc.toObject();
    });
  },

  async complete(returnId: string, userId: string, remarks?: string) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (!["WAREHOUSE_RECEIVED", "RESOLVED"].includes(returnDoc.status)) {
        throw new Error("Sales return is not ready to complete");
      }

      await finalizeCompletion(
        returnDoc,
        session,
        userId,
        remarks || "Completed",
      );
      return returnDoc.toObject();
    });
  },

  async cancel(returnId: string, userId?: string, remarks?: string) {
    return base.withTransaction(async (session) => {
      const returnDoc: any =
        await SalesReturn.findById(returnId).session(session);
      if (!returnDoc) throw new Error("Sales return not found");

      if (returnDoc.status === "COMPLETED") {
        throw new Error("Completed return cannot be cancelled");
      }

      returnDoc.status = "CANCELLED";
      returnDoc.updatedBy = userId
        ? new Types.ObjectId(userId)
        : returnDoc.updatedBy;

      if (userId) {
        returnDoc.approvalLogs.push({
          role: "M.O",
          userId: new Types.ObjectId(userId),
          status: "REJECTED",
          remarks,
          actionDate: new Date(),
        });
      }

      await returnDoc.save({ session });
      return returnDoc.toObject();
    });
  },

  findOne: base.findOne,
  model: base.model,
};
