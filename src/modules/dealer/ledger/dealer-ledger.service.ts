// src/modules/dealer/ledger/dealer-ledger.service.ts
import Dealer from "../../../models/dealer.model";
import SalesOrder from "../../../models/sales-order.model";
import SalesInvoice from "../../../models/sales-invoice.model";
import SalesReturn from "../../../models/sales-return.model";
import Collection from "../../collection/collection.model";

// ---------- Types ----------
type LedgerEntry = {
  id: string;
  date: Date;
  type: "SALE" | "PAYMENT" | "RETURN";
  reference: string;          // orderNo / mrNo / returnNo
  details: any;               // full document or summary
  debit: number;              // increase in due (sale)
  credit: number;             // decrease in due (payment/return)
  balance: number;            // running dealer due
};

type DealerLedger = {
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
    totalPayments: number;
    totalReturns: number;
    closingBalance: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type LedgerOptions = {
  startDate?: string;
  endDate?: string;
  type?: "SALE" | "PAYMENT" | "RETURN" | "ALL";
  page?: number;
  limit?: number;
};

// ---------- Helpers ----------
function round2(n: number) {
  return Math.round((n || 0) * 100) / 100;
}

async function getDealer(dealerId: string) {
  const dealer = await Dealer.findById(dealerId)
    .select("name phoneNumber creditLimit currentDue openingBalance")
    .lean();
  if (!dealer) throw new Error("Dealer not found");
  return dealer;
}

// Fetch sales orders (only delivered)
async function fetchSalesEntries(dealerId: string, startDate?: Date, endDate?: Date) {
  const filter: any = {
    customerId: dealerId,
    status: "DELIVERED",
  };
  if (startDate || endDate) {
    filter.orderDate = {};
    if (startDate) filter.orderDate.$gte = startDate;
    if (endDate) filter.orderDate.$lte = endDate;
  }

  const orders = await SalesOrder.find(filter)
    .populate({
      path: "items.productId",
      select: "name sku unit",
    })
    .populate("warehouseId", "name")
    .lean()
    .sort({ orderDate: 1 });

  return orders.map((order: any) => ({
    id: order._id.toString(),
    date: order.orderDate || order.createdAt,
    type: "SALE" as const,
    reference: order.orderNo,
    details: {
      orderNo: order.orderNo,
      items: (order.items || []).map((item: any) => ({
        productId: item.productId?._id || item.productId,
        productName: item.productId?.name || "Product",
        qty: item.qty,
        bonusQty: item.bonusQty,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
      })),
      subTotal: order.subTotal,
      grandTotal: order.grandTotal,
      warehouse: order.warehouseId?.name,
    },
    debit: order.grandTotal,    // sale increases due
    credit: 0,
  }));
}

// Fetch collections (payment entries)
async function fetchPaymentEntries(dealerId: string, startDate?: Date, endDate?: Date) {
  const filter: any = {
    "dealers.dealerId": dealerId,
    status: "APPROVED",      // only approved collections
  };
  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }

  const collections = await Collection.find(filter)
    .populate("dealers.invoices.invoiceId", "invoiceNo")
    .lean()
    .sort({ date: 1 });

  const entries: any[] = [];
  for (const col of collections) {
    const dealerBlock = col.dealers.find(
      (d: any) => d.dealerId.toString() === dealerId
    );
    if (!dealerBlock) continue;

    for (const inv of dealerBlock.invoices) {
      for (const mr of inv.moneyReceipts) {
        // Each MR generates a ledger entry
        const mrAmount = mr.taka;
        const commission = mr.commission?.amount || 0;
        const deduction = mr.deductCommission ? commission : 0;
        const netPayment = mrAmount - deduction;   // this reduces due

        entries.push({
          id: `${col._id}_${mr.mrNo}`,
          date: mr.mrDate || col.date,
          type: "PAYMENT" as const,
          reference: mr.mrNo,
          details: {
            mrNo: mr.mrNo,
            invoiceNo: inv.invoiceNo || inv.invoiceId?.invoiceNo || "N/A",
            taka: mrAmount,
            commission,
            deduction,
            netPayment,
            onlineCopyNo: col.onlineCopy?.onlineCopyNo,
          },
          debit: 0,
          credit: netPayment,    // payment reduces due
        });
      }
    }
  }
  return entries;
}

// Fetch sales returns (completed)
async function fetchReturnEntries(dealerId: string, startDate?: Date, endDate?: Date) {
  const filter: any = {
    customerId: dealerId,
    status: "COMPLETED",
  };
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = startDate;
    if (endDate) filter.createdAt.$lte = endDate;
  }

  const returns = await SalesReturn.find(filter)
    .populate("invoiceReturns.items.productId", "name")
    .lean()
    .sort({ createdAt: 1 });

  return returns.map((ret: any) => ({
    id: ret._id.toString(),
    date: ret.completedAt || ret.createdAt,
    type: "RETURN" as const,
    reference: ret.returnNo,
    details: {
      returnNo: ret.returnNo,
      items: ret.invoiceReturns.flatMap((block: any) =>
        block.items.map((item: any) => ({
          productId: item.productId?._id || item.productId,
          productName: item.productId?.name || "Product",
          qty: item.warehouseReceivedQty || item.finalApprovedQty,
          unitPrice: item.soldUnitPrice,
          returnAmount: item.finalReturnAmount,
        }))
      ),
      totalReturnAmount: ret.totalReceivedAmount,
    },
    debit: 0,
    credit: ret.totalReceivedAmount,   // return reduces due
  }));
}

export const dealerLedgerService = {
  async getLedger(dealerId: string, opts: LedgerOptions = {}): Promise<DealerLedger> {
    const dealer = await getDealer(dealerId);
    const startDate = opts.startDate ? new Date(opts.startDate) : undefined;
    const endDate = opts.endDate ? new Date(opts.endDate) : undefined;

    // Fetch all entry types
    const [sales, payments, returns] = await Promise.all([
      fetchSalesEntries(dealerId, startDate, endDate),
      fetchPaymentEntries(dealerId, startDate, endDate),
      fetchReturnEntries(dealerId, startDate, endDate),
    ]);

    // Merge and sort by date (ascending)
    let allEntries = [...sales, ...payments, ...returns].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Filter by type if specified
    if (opts.type && opts.type !== "ALL") {
      allEntries = allEntries.filter(e => e.type === opts.type);
    }

    // Compute running balance of dealer due
    const openingBalance = Number(dealer.openingBalance) || 0;
    let runningBalance = openingBalance;
    allEntries.forEach(entry => {
      runningBalance = round2(runningBalance + entry.debit - entry.credit);
      entry.balance = runningBalance;
    });

    const totalSales = allEntries.filter(e => e.type === "SALE").reduce((s, e) => s + e.debit, 0);
    const totalPayments = allEntries.filter(e => e.type === "PAYMENT").reduce((s, e) => s + e.credit, 0);
    const totalReturns = allEntries.filter(e => e.type === "RETURN").reduce((s, e) => s + e.credit, 0);

    // Pagination
    const page = opts.page || 1;
    const limit = opts.limit || 50;
    const total = allEntries.length;
    const totalPages = Math.ceil(total / limit);
    const startIdx = (page - 1) * limit;
    const paginatedEntries = allEntries.slice(startIdx, startIdx + limit);

    return {
      dealer: {
        id: dealer._id.toString(),
        name: dealer.name,
        phone: dealer.phoneNumber || "",
        creditLimit: dealer.creditLimit || 0,
        currentDue: dealer.currentDue || 0,
        openingBalance,
      },
      entries: paginatedEntries,
      summary: {
        openingBalance,
        totalSales,
        totalPayments,
        totalReturns,
        closingBalance: runningBalance,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  },

  async getLedgerSummary(dealerId: string) {
    const { summary } = await this.getLedger(dealerId, { limit: 1 });
    return summary;
  }
};