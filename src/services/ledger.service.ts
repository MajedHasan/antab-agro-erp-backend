// src/services/ledger.service.ts
import { Account } from "../models/account.model";
import { Voucher } from "../models/voucher.model";
import { VoucherLine } from "../models/voucher-line.model";
import { Types } from "mongoose";

type TxFilter = {
  from?: Date;
  to?: Date;
  type?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  skip?: number;
};

/** Format a transaction for the ledger UI */
function formatTransaction(voucher: any, line: any) {
  return {
    id: `${String(voucher._id)}::${String(line._id)}`,
    entryId: voucher._id,
    accountId: String(line.accountId),
    accountCode: "", // optional
    accountName: "", // optional
    date: voucher.date,
    description: line.narration || "",
    reference: voucher.reference || voucher.voucherNo || "",
    debit: line.debit || 0,
    credit: line.credit || 0,
    balance: 0,
    journalEntry: {
      id: voucher._id,
      entryNumber: voucher.voucherNo || voucher._id,
      date: voucher.date,
      description: voucher.narration || "",
      reference: voucher.reference || "",
      status: voucher.status || "Draft",
      createdBy: voucher.createdBy || "System",
      createdAt: voucher.createdAt,
    },
    type: voucher.type || "Journal",
  };
}

/* ---------------------------------------------------------------------------
   Compute balances for all accounts for a given period.
   Returns Map<accountId, {opening, periodDr, periodCr, closing}>
   Uses only posted vouchers.
---------------------------------------------------------------------------- */
export async function getBalancesForPeriod(from?: Date, to?: Date) {
  const pipeline: any[] = [
    // Join voucher to get date and status
    {
      $lookup: {
        from: "vouchers",
        localField: "voucherId",
        foreignField: "_id",
        as: "voucher",
      },
    },
    { $unwind: "$voucher" },

    // Only posted vouchers
    { $match: { "voucher.status": "Approved" } },

    // Compute isOpening and isInPeriod flags
    {
      $addFields: {
        isOpening: {
          $cond: [{ $eq: ["$voucher.type", "Opening"] }, 1, 0],
        },
        isInPeriod: {
          $cond: [
            {
              $and: [
                { $ne: ["$voucher.type", "Opening"] },
                from && to
                  ? {
                      $and: [
                        { $gte: ["$voucher.date", from] },
                        { $lte: ["$voucher.date", to] },
                      ],
                    }
                  : from && !to
                    ? { $gte: ["$voucher.date", from] }
                    : !from && to
                      ? { $lte: ["$voucher.date", to] }
                      : true,
              ],
            },
            1,
            0,
          ],
        },
      },
    },

    // Group by accountId
    {
      $group: {
        _id: "$accountId",
        openingSum: {
          $sum: {
            $multiply: ["$isOpening", { $subtract: ["$debit", "$credit"] }],
          },
        },
        periodDr: { $sum: { $multiply: ["$isInPeriod", "$debit"] } },
        periodCr: { $sum: { $multiply: ["$isInPeriod", "$credit"] } },
      },
    },

    // Compute final balances
    {
      $project: {
        accountId: "$_id",
        opening: { $ifNull: ["$openingSum", 0] },
        periodDr: { $ifNull: ["$periodDr", 0] },
        periodCr: { $ifNull: ["$periodCr", 0] },
        closing: {
          $add: [
            { $ifNull: ["$openingSum", 0] },
            {
              $subtract: [
                { $ifNull: ["$periodDr", 0] },
                { $ifNull: ["$periodCr", 0] },
              ],
            },
          ],
        },
      },
    },
  ];

  const rows = await VoucherLine.aggregate(pipeline).allowDiskUse(true).exec();

  const map = new Map<
    string,
    { opening: number; periodDr: number; periodCr: number; closing: number }
  >();
  for (const r of rows) {
    map.set(String(r.accountId), {
      opening: r.opening,
      periodDr: r.periodDr,
      periodCr: r.periodCr,
      closing: r.closing,
    });
  }

  return map;
}

/** Convenience wrapper for a single account */
export async function getAccountBalance(
  accountId: string,
  from?: Date,
  to?: Date,
) {
  const map = await getBalancesForPeriod(from, to);
  return (
    map.get(accountId) ?? { opening: 0, periodDr: 0, periodCr: 0, closing: 0 }
  );
}

/* ---------------------------------------------------------------------------
   Ledger Service Object
---------------------------------------------------------------------------- */
export const ledgerService = {
  async listAccounts() {
    return Account.find({ deletedAt: { $exists: false } })
      .sort({ code: 1 })
      .lean();
  },

  async getTransactionsForAccount(accountId: string, filter: TxFilter = {}) {
    const accountObjectId = new Types.ObjectId(accountId);

    // 1️⃣ Compute opening balance
    let openingBalance = 0;
    if (filter.from) {
      const agg = await VoucherLine.aggregate([
        { $match: { accountId: accountObjectId } },
        {
          $lookup: {
            from: "vouchers",
            localField: "voucherId",
            foreignField: "_id",
            as: "voucher",
          },
        },
        { $unwind: "$voucher" },
        {
          $match: {
            "voucher.status": "Approved",
            "voucher.date": { $lt: filter.from },
          },
        },
        {
          $group: {
            _id: null,
            totalDebit: { $sum: "$debit" },
            totalCredit: { $sum: "$credit" },
          },
        },
      ]);
      if (agg.length > 0)
        openingBalance = (agg[0].totalDebit || 0) - (agg[0].totalCredit || 0);
    }

    // 2️⃣ Fetch lines for period
    const dateFilter: any = {};
    if (filter.from) dateFilter.$gte = filter.from;
    if (filter.to) dateFilter.$lte = filter.to;

    const pipeline: any[] = [
      { $match: { accountId: accountObjectId } },
      {
        $lookup: {
          from: "vouchers",
          localField: "voucherId",
          foreignField: "_id",
          as: "voucher",
        },
      },
      { $unwind: "$voucher" },
      { $match: { "voucher.status": "Approved" } },
    ];

    if (filter.from || filter.to)
      pipeline.push({ $match: { "voucher.date": dateFilter } });

    pipeline.push({
      $project: {
        _id: 1,
        voucherId: 1,
        accountId: 1,
        debit: 1,
        credit: 1,
        narration: 1,
        "voucher._id": 1,
        "voucher.voucherNo": 1,
        "voucher.date": 1,
        "voucher.type": 1,
        "voucher.status": 1,
        "voucher.reference": 1,
        "voucher.narration": 1,
        "voucher.createdBy": 1,
        "voucher.createdAt": 1,
      },
    });
    pipeline.push({ $sort: { "voucher.date": 1, _id: 1 } });

    const lines = await VoucherLine.aggregate(pipeline).exec();
    let txs = lines.map((l: any) => formatTransaction(l.voucher, l));

    // 3️⃣ Filter by type/search
    if (filter.type && filter.type !== "all")
      txs = txs.filter((t) => t.type === filter.type);
    if (filter.search) {
      const q = filter.search.toLowerCase();
      txs = txs.filter(
        (t) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.reference || "").toLowerCase().includes(q),
      );
    }

    // 4️⃣ Sorting
    const dir = filter.sortDir === "asc" ? 1 : -1;
    if (filter.sortBy) {
      txs.sort((a: any, b: any) => {
        const A = a[filter.sortBy as keyof typeof a];
        const B = b[filter.sortBy as keyof typeof b];
        if (filter.sortBy === "date")
          return dir * (new Date(A).getTime() - new Date(B).getTime());
        if (typeof A === "string" && typeof B === "string")
          return dir * A.localeCompare(B);
        if (typeof A === "number" && typeof B === "number")
          return dir * (A - B);
        return 0;
      });
    }

    // 5️⃣ Pagination
    const total = txs.length;
    const skip = filter.skip || 0;
    const limit = filter.limit || total;
    const pageSlice = txs.slice(skip, skip + limit);

    // 6️⃣ Compute running balance
    let running = openingBalance;
    const enriched = pageSlice.map((t) => {
      running += (t.debit || 0) - (t.credit || 0);
      return { ...t, balance: running };
    });

    const periodDebit = txs.reduce((s, x) => s + (x.debit || 0), 0);
    const periodCredit = txs.reduce((s, x) => s + (x.credit || 0), 0);

    return {
      transactions: enriched,
      meta: { total, returned: enriched.length, skip, limit },
      totals: {
        openingBalance,
        periodDebit,
        periodCredit,
        closingBalance: openingBalance + periodDebit - periodCredit,
      },
    };
  },

  async getLedgerSummary(accountId: string, from?: Date, to?: Date) {
    const accObj = await getAccountBalance(accountId, from, to);
    const account = await Account.findById(accountId).lean();

    // Transaction count & average
    const pipeline: any[] = [
      { $match: { accountId: new Types.ObjectId(accountId) } },
      {
        $lookup: {
          from: "vouchers",
          localField: "voucherId",
          foreignField: "_id",
          as: "voucher",
        },
      },
      { $unwind: "$voucher" },
      { $match: { "voucher.status": "Approved" } },
    ];

    const dateFilter: any = {};
    if (from) dateFilter.$gte = from;
    if (to) dateFilter.$lte = to;
    if (from || to) pipeline.push({ $match: { "voucher.date": dateFilter } });

    pipeline.push({
      $group: {
        _id: null,
        totalDebit: { $sum: "$debit" },
        totalCredit: { $sum: "$credit" },
        count: { $sum: 1 },
      },
    });

    const agg = await VoucherLine.aggregate(pipeline).exec();
    const totalDebit = agg.length ? agg[0].totalDebit : 0;
    const totalCredit = agg.length ? agg[0].totalCredit : 0;
    const txCount = agg.length ? agg[0].count : 0;
    const avgTransaction =
      txCount > 0 ? (totalDebit + totalCredit) / txCount : 0;

    return {
      account: account || null,
      openingBalance: accObj.opening,
      totalDebit,
      totalCredit,
      closingBalance: accObj.closing,
      transactionCount: txCount,
      avgTransaction,
    };
  },
};
