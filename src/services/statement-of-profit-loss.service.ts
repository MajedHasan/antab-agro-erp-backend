import { Account } from "../models/account.model";
import { Voucher } from "../models/voucher.model";
import { VoucherLine } from "../models//voucher-line.model";
import { resolvePeriod } from "../utils/resolvePeriod";
import { buildPL } from "../utils/buildPL";

export const statementOfProfitLossService = {
  async generate({
    periodType,
    period,
    comparePeriod,
  }: {
    periodType: "monthly" | "yearly";
    period: string;
    comparePeriod?: string;
  }) {
    const current = await buildPL(periodType, period);

    const compare = comparePeriod
      ? await buildPL(periodType, comparePeriod)
      : null;

    return { current, compare };
  },
};
