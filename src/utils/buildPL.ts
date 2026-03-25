// src/utils/buildPL.ts
import { Types } from "mongoose";
import { Voucher } from "../models/voucher.model";
import { VoucherLine } from "../models/voucher-line.model";
import { Account } from "../models/account.model";
import { resolvePeriod } from "./resolvePeriod";

/**
 * Build Profit & Loss buckets for given period
 * returns object with arrays for each bucket (name & amount)
 */
export async function buildPL(
  periodType: "monthly" | "yearly",
  period: string,
) {
  const { from, to } = resolvePeriod(periodType, period);

  // Ensure we only include approved/posted vouchers (adjust if your workflow differs)
  const VALID_STATUSES = ["Approved", "Posted"];

  // Aggregate voucher lines joined with parent voucher and account
  const pipeline: any[] = [
    // join voucher
    {
      $lookup: {
        from: "vouchers",
        localField: "voucherId",
        foreignField: "_id",
        as: "voucher",
      },
    },
    { $unwind: "$voucher" },
    // filter by voucher status and date
    {
      $match: {
        "voucher.status": { $in: VALID_STATUSES },
        "voucher.date": { $gte: from, $lte: to },
      },
    },
    // join account for plGroup/type/name
    {
      $lookup: {
        from: "accounts",
        localField: "accountId",
        foreignField: "_id",
        as: "account",
      },
    },
    { $unwind: "$account" },
    // only keep accounts that have plGroup defined (those participate in P&L)
    {
      $match: {
        "account.plGroup": { $exists: true, $ne: null },
      },
    },
    // compute signed amount for P&L effect:
    // - For Revenue accounts, credits increase revenue (credit - debit)
    // - For Expense accounts, debits increase expense (debit - credit)
    // Account.type in your model is TitleCase ("Revenue","Expense"), but be safe with lowercase
    {
      $project: {
        accountId: 1,
        "account._id": 1,
        "account.name": 1,
        "account.plGroup": 1,
        "account.type": 1,
        debit: { $ifNull: ["$debit", 0] },
        credit: { $ifNull: ["$credit", 0] },
        amount: {
          $cond: [
            {
              $in: [
                { $toLower: "$account.type" },
                ["revenue", "income"], // include alternate names
              ],
            },
            // revenue-like: credit increases (credit - debit)
            {
              $subtract: [
                { $ifNull: ["$credit", 0] },
                { $ifNull: ["$debit", 0] },
              ],
            },
            // else: debit increases (debit - credit)
            {
              $subtract: [
                { $ifNull: ["$debit", 0] },
                { $ifNull: ["$credit", 0] },
              ],
            },
          ],
        },
      },
    },
    // group totals by account
    {
      $group: {
        _id: "$account._id",
        name: { $first: "$account.name" },
        plGroup: { $first: "$account.plGroup" },
        type: { $first: "$account.type" },
        total: { $sum: "$amount" },
      },
    },
  ];

  const rows = await VoucherLine.aggregate(pipeline).allowDiskUse(true).exec();

  // Prepare buckets
  const buckets: Record<
    string,
    { accountId: string; name: string; amount: number }[]
  > = {
    revenue: [],
    costOfSales: [],
    selling: [],
    admin: [],
    nonOperating: [],
    financeCost: [],
    tax: [],
  };

  for (const r of rows) {
    // We present amounts as positive numbers for display,
    // but keep sign where meaningful (revenue totals may be negative depending on debit/credit)
    const amt = Number(r.total || 0);
    if (!r.plGroup) continue;
    // Normalize group key (plGroup in DB expected to be one of the enum keys)
    const groupKey = String(r.plGroup);
    if (!(groupKey in buckets)) {
      // ignore unknown groups (or push to nonOperating)
      if (!buckets.nonOperating) buckets.nonOperating = [];
    }
    // We push an entry with absolute value (display) while keeping sign sensible
    // If you want to show negative amounts as negative, you can keep amt as-is.
    buckets[groupKey].push({
      accountId: String(r._id),
      name: r.name,
      amount: Math.abs(amt),
    });
  }

  // Ensure every bucket exists
  for (const k of [
    "revenue",
    "costOfSales",
    "selling",
    "admin",
    "nonOperating",
    "financeCost",
    "tax",
  ]) {
    if (!buckets[k]) buckets[k] = [];
  }

  return buckets;
}
