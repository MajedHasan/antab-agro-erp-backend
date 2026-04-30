import TadaRate from "./TadaRate.model";

// -----------------------------
// 1. NUMBER TO WORDS (BD STYLE)
// -----------------------------
export function numberToWords(amount: number): string {
  if (amount === 0) return "Zero Taka Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];

  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convert(num: number): string {
    if (num < 20) return ones[num];
    if (num < 100)
      return `${tens[Math.floor(num / 10)]} ${ones[num % 10]}`.trim();
    if (num < 1000)
      return `${ones[Math.floor(num / 100)]} Hundred ${convert(num % 100)}`.trim();
    if (num < 100000)
      return `${convert(Math.floor(num / 1000))} Thousand ${convert(num % 1000)}`.trim();
    if (num < 10000000)
      return `${convert(Math.floor(num / 100000))} Lakh ${convert(num % 100000)}`.trim();

    return `${convert(Math.floor(num / 10000000))} Crore ${convert(num % 10000000)}`.trim();
  }

  return `${convert(amount)} Taka Only`;
}

// -----------------------------
// 2. CALCULATE TOTALS
// -----------------------------
export function calculateEntryTotals(data: {
  meterReadingStart: number;
  meterReadingEnd: number;
  takaPerKm: number;
  maintenance?: number;
  conveyance?: number;
  da?: number;
  nh?: number;
}) {
  const {
    meterReadingStart,
    meterReadingEnd,
    takaPerKm,
    maintenance = 0,
    conveyance = 0,
    da = 0,
    nh = 0,
  } = data;

  const totalTravelKm = meterReadingEnd - meterReadingStart;
  const totalFuelCost = totalTravelKm * takaPerKm;
  const totalDailyExpense = totalFuelCost + maintenance + conveyance + da + nh;

  return {
    totalTravelKm,
    totalFuelCost,
    totalDailyExpense,
  };
}

// -----------------------------
// 3. DATE VALIDATION
// -----------------------------
export function validateEntryDate(date: Date): void {
  const today = new Date();
  const entryDate = new Date(date);

  // Normalize to midnight for accurate day diff
  today.setHours(0, 0, 0, 0);
  entryDate.setHours(0, 0, 0, 0);

  if (entryDate > today) {
    throw new Error("Entry date cannot be in the future");
  }

  const diffDays =
    (today.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > 3) {
    throw new Error("You can only submit entries up to 3 days backdated");
  }
}

// -----------------------------
// 4. RATE RESOLUTION
// -----------------------------
export async function getRateForEntry(params: {
  employeeId: string;
  territory?: string;
  designation?: string;
  date: Date;
}): Promise<number> {
  const { employeeId, territory, designation, date } = params;

  const queryBase = {
    isActive: true,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
  };

  // 1. Employee-specific
  let rate = await TadaRate.findOne({
    ...queryBase,
    rateType: "employee",
    applicableTo: employeeId,
  }).sort({ effectiveFrom: -1 });

  if (rate) return rate.takaPerKm;

  // 2. Territory-specific
  if (territory) {
    rate = await TadaRate.findOne({
      ...queryBase,
      rateType: "territory",
      applicableTo: territory,
    }).sort({ effectiveFrom: -1 });

    if (rate) return rate.takaPerKm;
  }

  // 3. Designation-specific
  if (designation) {
    rate = await TadaRate.findOne({
      ...queryBase,
      rateType: "designation",
      applicableTo: designation,
    }).sort({ effectiveFrom: -1 });

    if (rate) return rate.takaPerKm;
  }

  // 4. Global fallback
  rate = await TadaRate.findOne({
    rateType: "global",
    isActive: true,
    effectiveTo: null,
  }).sort({ effectiveFrom: -1 });

  return rate?.takaPerKm ?? 3.6;
}
