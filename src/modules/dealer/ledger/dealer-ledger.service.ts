// src/modules/dealer/ledger/dealer-ledger.service.ts
import Dealer from "../../../models/dealer.model";
import SalesOrder from "../../../models/sales-order.model";
import SalesReturn from "../../../models/sales-return.model";
import Collection from "../../collection/collection.model";

/* --------------------------- Types --------------------------- */
type EntryType = "SALE" | "PAYMENT" | "RETURN";
type CommissionCalcMode = "PERCENT" | "FLAT" | "NONE";
type CommissionDirection = "ADD" | "DEDUCT";

type LedgerEntry = {
  id: string;
  date: Date;
  type: EntryType;
  reference: string;
  details: Record<string, any>;
  debit: number;
  credit: number;
  grossCredit?: number;
  commission?: number;
  commissionCredited?: number;
  commissionDirection?: CommissionDirection;
  commissionCalcMode?: CommissionCalcMode;
  commissionRate?: number;
  commissionSource?: string;
  balance: number;
};

export type DealerLedgerResult = {
  dealer: {
    id: string;
    name: string;
    phone: string;
    creditLimit: number;
    currentDue: number;
    openingBalance: number;
  };
  entries: LedgerEntry[];
  summary: {
    openingBalance: number;
    totalSales: number;
    totalPayments: number;         // CASH only
    totalCommission: number;
    totalCommissionEffect: number; // signed
    totalCredited: number;         // payments + commission effect
    totalReturns: number;
    closingBalance: number;
    storedDue: number;
    dueMismatch: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
};

type LedgerOptions = {
  startDate?: string;
  endDate?: string;
  type?: EntryType | "ALL";
  page?: number;
  limit?: number;
};

/* --------------------------- Helpers --------------------------- */
const round2 = (n: number) => Math.round((n || 0) * 100) / 100;

const startOfDay = (d: string | Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: string | Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * Handles your real commission shape:
 *   commission: { mode: "PERCENT" | "FLAT", value: 10, amount: 3800 }
 *   deductCommission: false → ADD (reduces due more)
 *   deductCommission: true  → DEDUCT (subtracts from cash)
 */
function extractCommission(
  mr: any,
  taka: number,
  inv: any = {},
  col: any = {},
): {
  amount: number;
  direction: CommissionDirection;
  calcMode: CommissionCalcMode;
  rate: number;
  source: string;
} {
  let amount = 0;
  let calcMode: CommissionCalcMode = "NONE";
  let rate = 0;
  let source = "none";

  const candidates: Array<{ obj: any; label: string }> = [
    { obj: mr?.commission, label: "mr.commission" },
    { obj: mr?.comm, label: "mr.comm" },
    { obj: mr?.commissionAmount, label: "mr.commissionAmount" },
    { obj: mr?.commAmount, label: "mr.commAmount" },
    { obj: inv?.commission, label: "inv.commission" },
    { obj: col?.commission, label: "col.commission" },
  ];

  for (const { obj, label } of candidates) {
    if (obj == null) continue;

    if (typeof obj === "object") {
      const rawMode = String(obj.mode || "").toUpperCase();
      const val = Number(obj.value) || 0;
      const amt = Number(obj.amount) || 0;

      if ((rawMode === "PERCENT" || rawMode === "PERCENTAGE") && val > 0) {
        calcMode = "PERCENT";
        rate = val;
        amount = amt > 0 ? amt : Math.round(taka * val) / 100;
        source = `${label}.percent(${val}%)`;
        break;
      }
      if ((rawMode === "FLAT" || rawMode === "FIXED") && val > 0) {
        calcMode = "FLAT";
        amount = amt > 0 ? amt : val;
        source = `${label}.flat`;
        break;
      }
      if (amt > 0) {
        calcMode = "FLAT";
        amount = amt;
        source = `${label}.amount`;
        break;
      }
      const alt =
        Number(obj.commAmount) ||
        Number(obj.commissionAmount) ||
        Number(obj.amountValue) ||
        0;
      if (alt > 0) {
        calcMode = "FLAT";
        amount = alt;
        source = `${label}.alt`;
        break;
      }
    }

    if (typeof obj === "number" && Number.isFinite(obj) && obj > 0) {
      amount = obj;
      calcMode = "FLAT";
      source = `${label}(number)`;
      break;
    }
    if (typeof obj === "string") {
      const n = Number(obj);
      if (Number.isFinite(n) && n > 0) {
        amount = n;
        calcMode = "FLAT";
        source = `${label}(string)`;
        break;
      }
    }
  }

  const isDeduct = mr?.deductCommission === true;
  const direction: CommissionDirection = isDeduct ? "DEDUCT" : "ADD";

  return {
    amount: round2(amount),
    direction,
    calcMode,
    rate,
    source,
  };
}

async function getDealer(dealerId: string) {
  const dealer = await Dealer.findById(dealerId)
    .select("name phoneNumber creditLimit currentDue openingBalance")
    .lean();
  if (!dealer) throw new Error("Dealer not found");
  return dealer as any;
}

/* --------------------------- Fetchers --------------------------- */
async function fetchSalesEntries(
  dealerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<LedgerEntry[]> {
  const filter: any = { customerId: dealerId, status: "DELIVERED" };
  if (startDate || endDate) {
    filter.orderDate = {};
    if (startDate) filter.orderDate.$gte = startDate;
    if (endDate) filter.orderDate.$lte = endDate;
  }

  const orders = await SalesOrder.find(filter)
    .populate({ path: "items.productId", select: "name sku unit" })
    .populate("warehouseId", "name")
    .lean()
    .sort({ orderDate: 1 });

  return (orders as any[]).map((order) => ({
    id: String(order._id),
    date: order.orderDate || order.createdAt,
    type: "SALE" as const,
    reference: order.orderNo || "—",
    details: {
      orderNo: order.orderNo,
      orderDate: order.orderDate,
      deliveredAt: order.deliveredAt || order.deliveryDate,
      invoiceNo: order.invoiceNo,
      items: (order.items || []).map((item: any) => ({
        productName: item.productId?.name || "Product",
        sku: item.productId?.sku,
        unit: item.productId?.unit,
        qty: item.qty,
        bonusQty: item.bonusQty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subTotal: order.subTotal,
      discount: order.discount,
      tax: order.tax,
      grandTotal: order.grandTotal,
      warehouse: order.warehouseId?.name,
      remarks: order.remarks,
    },
    debit: round2(Number(order.grandTotal) || 0),
    credit: 0,
  }));
}

async function fetchPaymentEntries(
  dealerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<LedgerEntry[]> {
  const filter: any = { "dealers.dealerId": dealerId, status: "APPROVED" };
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }

  const collections = await Collection.find(filter)
    .populate("dealers.invoices.invoiceId", "invoiceNo")
    .lean()
    .sort({ date: 1 });

  const out: LedgerEntry[] = [];

  for (const col of collections as any[]) {
    const block = (col.dealers || []).find(
      (d: any) => String(d.dealerId) === String(dealerId),
    );
    if (!block) continue;

    for (const inv of block.invoices || []) {
      for (const mr of inv.moneyReceipts || []) {
        const taka = round2(Number(mr.taka) || 0);
        const comm = extractCommission(mr, taka, inv, col);

        const effect = comm.direction === "ADD" ? comm.amount : -comm.amount;
        const credit = round2(taka + effect);

        out.push({
          id: `${col._id}_${mr.mrNo || Math.random().toString(36).slice(2, 8)}`,
          date: mr.mrDate || col.date,
          type: "PAYMENT",
          reference: mr.mrNo || "MR",
          details: {
            mrNo: mr.mrNo,
            mrDate: mr.mrDate,
            collectionDate: col.date,
            collectionNo: col.collectionNo || col.voucherNo,
            invoiceNo: inv.invoiceNo || inv.invoiceId?.invoiceNo || "—",
            taka,
            commission: comm.amount,
            commissionDirection: comm.direction,
            commissionCalcMode: comm.calcMode,
            commissionRate: comm.rate,
            commissionSource: comm.source,
            commissionCredited: comm.direction === "ADD" ? comm.amount : 0,
            commissionEffect: effect,
            totalCredit: credit,
            deductCommissionFlag: mr?.deductCommission,
            commissionRaw: mr?.commission,
            paymentMode: mr.paymentMode?.name || mr.paymentMode,
            bank: mr.bank?.name || mr.bank,
            chequeNo: mr.chequeNo,
            onlineCopyNo: col.onlineCopy?.onlineCopyNo,
            mediaId: mr.mediaId,
            remarks: mr.remarks || col.remarks,
          },
          debit: 0,
          credit,
          grossCredit: taka,
          commission: comm.amount,
          commissionCredited: comm.direction === "ADD" ? comm.amount : 0,
          commissionDirection: comm.direction,
          commissionCalcMode: comm.calcMode,
          commissionRate: comm.rate,
          commissionSource: comm.source,
        });
      }
    }
  }
  return out;
}

async function fetchReturnEntries(
  dealerId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<LedgerEntry[]> {
  const filter: any = { customerId: dealerId, status: "COMPLETED" };
  if (startDate || endDate) {
    const dateCond: any = {};
    if (startDate) dateCond.$gte = startDate;
    if (endDate) dateCond.$lte = endDate;
    filter.$or = [
      { completedAt: dateCond },
      { completedAt: null, createdAt: dateCond },
    ];
  }

  const returns = await SalesReturn.find(filter)
    .populate("invoiceReturns.items.productId", "name sku unit")
    .populate("invoiceReturns.invoiceId", "invoiceNo")
    .lean()
    .sort({ createdAt: 1 });

  return (returns as any[]).map((ret) => ({
    id: String(ret._id),
    date: ret.completedAt || ret.createdAt,
    type: "RETURN" as const,
    reference: ret.returnNo || "—",
    details: {
      returnNo: ret.returnNo,
      createdAt: ret.createdAt,
      completedAt: ret.completedAt,
      reason: ret.reason,
      invoiceNos: (ret.invoiceReturns || [])
        .map((b: any) => b.invoiceNo || b.invoiceId?.invoiceNo)
        .filter(Boolean),
      items: (ret.invoiceReturns || []).flatMap((b: any) =>
        (b.items || []).map((item: any) => ({
          productName: item.productId?.name || "Product",
          sku: item.productId?.sku,
          unit: item.productId?.unit,
          qty:
            item.warehouseReceivedQty ||
            item.finalApprovedQty ||
            item.qty,
          unitPrice: item.soldUnitPrice,
          returnAmount: item.finalReturnAmount,
        })),
      ),
      totalReturnAmount: round2(Number(ret.totalReceivedAmount) || 0),
    },
    debit: 0,
    credit: round2(Number(ret.totalReceivedAmount) || 0),
  }));
}

/* --------------------------- Service --------------------------- */
export const dealerLedgerService = {
  async getLedger(
    dealerId: string,
    opts: LedgerOptions = {},
  ): Promise<DealerLedgerResult> {
    if (!dealerId) throw new Error("dealerId is required");

    const dealer = await getDealer(dealerId);
    const startDate = opts.startDate ? startOfDay(opts.startDate) : undefined;
    const endDate = opts.endDate ? endOfDay(opts.endDate) : undefined;

    const [sales, payments, returns] = await Promise.all([
      fetchSalesEntries(dealerId, startDate, endDate),
      fetchPaymentEntries(dealerId, startDate, endDate),
      fetchReturnEntries(dealerId, startDate, endDate),
    ]);

    const all: LedgerEntry[] = [...sales, ...payments, ...returns].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // Running balance over ALL entries (independent of type filter)
    const openingBalance = round2(Number(dealer.openingBalance) || 0);
    let running = openingBalance;
    for (const e of all) {
      running = round2(running + e.debit - e.credit);
      e.balance = running;
    }
    const closingBalance = running;

    // Summary
    const totalSales = round2(sales.reduce((s, e) => s + e.debit, 0));
    const totalReturns = round2(returns.reduce((s, e) => s + e.credit, 0));

    // ⭐ Cash only (no commission)
    const totalPayments = round2(
      payments.reduce((s, e) => s + (e.grossCredit || 0), 0),
    );

    // ⭐ Total commission (unsigned)
    const totalCommission = round2(
      payments.reduce((s, e) => s + (e.commission || 0), 0),
    );

    // ⭐ Signed effect on due
    const totalCommissionEffect = round2(
      payments.reduce((s, e) => {
        const dir = e.commissionDirection || "ADD";
        return s + (dir === "ADD" ? e.commission || 0 : -(e.commission || 0));
      }, 0),
    );

    // ⭐ Total credited = cash + commission effect (what actually reduces due)
    const totalCredited = round2(totalPayments + totalCommissionEffect);

    const storedDue = round2(Number(dealer.currentDue) || 0);

    // Display filter
    let display = all;
    if (opts.type && opts.type !== "ALL") {
      display = all.filter((e) => e.type === opts.type);
    }

    // Pagination
    const page = Math.max(1, Math.floor(Number(opts.page) || 1));
    const limit = Math.min(
      500,
      Math.max(1, Math.floor(Number(opts.limit) || 50)),
    );
    const total = display.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * limit;
    const entries = display.slice(startIdx, startIdx + limit);

    return {
      dealer: {
        id: String(dealer._id),
        name: dealer.name,
        phone: dealer.phoneNumber || "",
        creditLimit: Number(dealer.creditLimit) || 0,
        currentDue: storedDue,
        openingBalance,
      },
      entries,
      summary: {
        openingBalance,
        totalSales,
        totalPayments,
        totalCommission,
        totalCommissionEffect,
        totalCredited,
        totalReturns,
        closingBalance,
        storedDue,
        dueMismatch: round2(closingBalance - storedDue),
      },
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages,
      },
    };
  },

  async getLedgerSummary(dealerId: string) {
    const { summary } = await this.getLedger(dealerId, { limit: 1 });
    return summary;
  },
};