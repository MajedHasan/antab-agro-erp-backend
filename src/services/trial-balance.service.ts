import { getBalancesForPeriod } from "./ledger.service";
import { Account } from "../models/account.model";

export interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  opening: number;          // signed (DR positive, CR negative)
  periodDebit: number;
  periodCredit: number;
  closing: number;          // signed closing balance
}

export const trialBalanceService = {
  async generate(from?: Date, to?: Date) {
    // 1) Get all active accounts
    const accounts = await Account.find({ deletedAt: { $exists: false } })
      .sort({ code: 1 })
      .lean();

    // 2) Fetch balances for the period (corrected ledger logic)
    const balanceMap = await getBalancesForPeriod(from, to);

    // 3) Build trial balance rows
    const rows: TrialBalanceRow[] = accounts.map((acc) => {
      const bal = balanceMap.get(String(acc._id)) || {
        opening: 0,
        periodDr: 0,
        periodCr: 0,
        closing: 0,
      };
      return {
        id: String(acc._id),
        code: acc.code,
        name: acc.name,
        type: acc.type,
        opening: bal.opening,
        periodDebit: bal.periodDr,
        periodCredit: bal.periodCr,
        closing: bal.closing,
      };
    });

    return rows;
  },
};