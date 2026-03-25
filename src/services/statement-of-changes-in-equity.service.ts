// src/services/statement-of-changes-in-equity.service.ts
import { Account } from "../models/account.model";
import { Voucher } from "../models/voucher.model";
import { resolvePeriod } from "../utils/resolvePeriod";

export const statementOfChangesInEquityService = {
  /**
   * Generate Statement of Changes in Equity
   */
  async generate(year: string) {
    const { from, to } = resolvePeriod("yearly", year);

    // Fetch equity accounts
    const equityAccounts = await Account.find({
      type: "Equity",
      status: "Active",
    });

    const accMap = new Map(equityAccounts.map((a) => [String(a._id), a]));

    // Fetch vouchers affecting equity (posted)
    const vouchers = await Voucher.find({
      posted: true,
      date: { $gte: from, $lte: to },
    });

    // Initialize rows
    const opening: Record<string, number> = {};
    const profitForPeriod: Record<string, number> = {};
    const oci: Record<string, number> = {};
    const ownerContribution: Record<string, number> = {};
    const dividends: Record<string, number> = {};
    const transfers: Record<string, number> = {};

    // Initialize equity columns
    const columns = [
      "shareCapital",
      "retainedEarnings",
      "revaluationReserve",
      "otherReserves",
    ];
    columns.forEach((col) => {
      opening[col] = 0;
      profitForPeriod[col] = 0;
      oci[col] = 0;
      ownerContribution[col] = 0;
      dividends[col] = 0;
      transfers[col] = 0;
    });

    // Compute opening balances (sum of all equity accounts at start of year)
    equityAccounts.forEach((a) => {
      if (a.category === "Share Capital") opening.shareCapital += a.balance;
      else if (a.category === "Retained Earnings")
        opening.retainedEarnings += a.balance;
      else if (a.category === "Revaluation Reserve")
        opening.revaluationReserve += a.balance;
      else opening.otherReserves += a.balance;
    });

    // Process vouchers within the year
    for (const v of vouchers) {
      for (const line of v.lines) {
        const acc = accMap.get(String(line.accountId));
        if (!acc) continue;

        const amount = (line.credit || 0) - (line.debit || 0);

        // Map to appropriate row based on type/category
        if (
          acc.category === "Retained Earnings" &&
          acc.plGroup === "profitForPeriod"
        ) {
          profitForPeriod.retainedEarnings += amount;
        } else if (acc.plGroup === "oci") {
          oci[mapCategory(acc.category)] += amount;
        } else if (acc.plGroup === "ownerContribution") {
          ownerContribution[mapCategory(acc.category)] += amount;
        } else if (acc.plGroup === "dividends") {
          dividends[mapCategory(acc.category)] += amount;
        } else if (acc.plGroup === "transfers") {
          transfers[mapCategory(acc.category)] += amount;
        }
      }
    }

    const statement = {
      opening: { label: "Opening Balance", ...opening },
      profitForPeriod: { label: "Profit for the period", ...profitForPeriod },
      oci: { label: "Other comprehensive income", ...oci },
      ownerContribution: { label: "Owner Contribution", ...ownerContribution },
      dividends: { label: "Dividends paid", ...dividends },
      transfers: { label: "Transfer to reserves", ...transfers },
    };

    return statement;
  },
};

/** Map account categories to equity columns */
function mapCategory(category: string): string {
  switch (category) {
    case "Share Capital":
      return "shareCapital";
    case "Retained Earnings":
      return "retainedEarnings";
    case "Revaluation Reserve":
      return "revaluationReserve";
    default:
      return "otherReserves";
  }
}
