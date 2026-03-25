import { Account } from "../models/account.model";
import { Voucher } from "../models/voucher.model";
import { buildGroups } from "../utils/buildGroups";
import { calculateBalances } from "../utils/calculateBalances";
import { calculateTotals } from "../utils/calculateTotals";

export const statementOfFinancialPositionService = {
  async generate({
    asOfDate,
    year,
    comparative,
  }: {
    asOfDate: string;
    year: number;
    comparative: boolean;
  }) {
    const asOf = new Date(asOfDate);

    const currentBalances = await calculateBalances(asOf);
    const priorBalances = comparative
      ? await calculateBalances(new Date(`${year - 1}-12-31`))
      : null;

    const groups = buildGroups(currentBalances, priorBalances);

    const totals = calculateTotals(groups);

    return {
      asOfDate,
      year,
      comparative,
      groups,
      totals,
    };
  },
};
