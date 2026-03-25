import { Account } from "../models/account.model";
import { Voucher } from "../models/voucher.model";
import { Types } from "mongoose";
import { resolvePeriod } from "../utils/resolvePeriod";

export type AccountType =
  | "Asset"
  | "Liability"
  | "Equity"
  | "Revenue"
  | "Expense";

export interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  opening: number; // signed: DR positive, CR negative
  debit: number; // period debit (>=0)
  credit: number; // period credit (>=0)
}

export const trialBalanceService = {
  async generate({
    periodType,
    period,
  }: {
    periodType: "monthly" | "yearly";
    period: string;
  }): Promise<TrialBalanceRow[]> {
    const { from, to } = resolvePeriod(periodType, period);

    // Fetch all active accounts
    const accounts = await Account.find({ deletedAt: { $exists: false } });

    // Prepare a map for quick lookup
    const accMap = new Map<string, TrialBalanceRow>();
    accounts.forEach((acc) => {
      accMap.set(String(acc._id), {
        id: String(acc._id),
        code: acc.code,
        name: acc.name,
        type: acc.type as AccountType,
        opening: acc.balance || 0,
        debit: 0,
        credit: 0,
      });
    });

    // Fetch all posted vouchers in period
    const vouchers = await Voucher.find({
      posted: true,
      date: { $gte: from, $lte: to },
    });

    for (const v of vouchers) {
      for (const line of v.lines) {
        const row = accMap.get(String(line.accountId));
        if (!row) continue;

        // Period debit and credit (always non-negative)
        row.debit += line.debit || 0;
        row.credit += line.credit || 0;
      }
    }

    // Adjust Equity/Revenue/Expense opening balances for sign convention
    // DR positive, CR negative
    const rows = Array.from(accMap.values()).map((row) => {
      let signedOpening = row.opening;

      if (
        row.type === "Liability" ||
        row.type === "Equity" ||
        row.type === "Revenue"
      ) {
        signedOpening = -row.opening; // CR balances are negative
      }

      return {
        ...row,
        opening: signedOpening,
      };
    });

    return rows;
  },
};
