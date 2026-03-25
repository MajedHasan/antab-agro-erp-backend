import { Account } from "../models/account.model";
import { VoucherLine } from "../models/voucher-line.model";
import { Voucher } from "../models/voucher.model";
import { Types } from "mongoose";

export async function calculateBalances(asOfDate: Date) {
  // Step 1: get posted vouchers up to date
  const vouchers = await Voucher.find({
    status: "Posted", // only posted vouchers
    date: { $lte: asOfDate },
  }).select("_id");

  const voucherIds = vouchers.map((v) => v._id);

  // Step 2: get all voucher lines for these vouchers
  const lines = await VoucherLine.find({
    voucherId: { $in: voucherIds },
  }).select("accountId debit credit");

  // Step 3: calculate balances
  const balanceMap = new Map<string, number>();
  for (const l of lines) {
    const prev = balanceMap.get(String(l.accountId)) || 0;
    balanceMap.set(
      String(l.accountId),
      prev + (l.debit || 0) - (l.credit || 0),
    );
  }

  // Step 4: fetch accounts for statement of financial position
  const accounts = await Account.find({
    type: { $in: ["Asset", "Liability", "Equity"] }, // match schema enum
  });

  // Step 5: map balances
  return accounts.map((a) => ({
    id: a._id,
    code: a.code,
    name: a.name,
    type: a.type,
    subType: a.subType || "current", // fallback
    noteRef: a.noteRef || null,
    balance: balanceMap.get(String(a._id)) || 0,
  }));
}
