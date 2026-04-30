import mongoose from "mongoose";
import { createCrudService } from "../../services/crud.service";
import TadaEntry from "./TadaEntry.model";
import TadaMonthlySheet from "./TadaMonthlySheet.model";
import TadaAuditLog from "./TadaAuditLog.model";
import {
  validateEntryDate,
  getRateForEntry,
  calculateEntryTotals,
} from "./tada.helper";
import { tadaMonthlySheetService } from "./tadaMonthlySheet.service";

const base = createCrudService(TadaEntry, {
  softDeleteField: "deletedAt",
  defaultSort: "-entryDate",
  searchFields: ["visitedPlaces", "remarks"],
  allowedFilterFields: [
    "employeeId",
    "tadaMonthlySheetId",
    "entryDate",
    "month",
    "year",
  ],
  defaultPopulate: [
    { path: "employeeId", select: "name email designation mobileNo" },
  ],
});

function normalizeNumber(value: any, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDate(value: any): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid entry date");
  }
  return date;
}

export const tadaEntryService = {
  ...base,

  async submitDailyEntry(employeeId: string, entryData: any): Promise<any> {
    let createdEntry: any = null;
    let sheetId: string | null = null;

    await base.withTransaction(async (session: mongoose.ClientSession) => {
      const entryDate = toDate(entryData.entryDate);

      // 1) Block future dates and submissions older than 3 calendar days.
      validateEntryDate(entryDate);

      // 2) Prevent duplicate entry for the same employee/date.
      const existing = await TadaEntry.findOne({
        employeeId,
        entryDate,
        deletedAt: null,
      }).session(session);

      if (existing) {
        throw new Error("Already submitted for this date");
      }

      const month = entryDate.getMonth() + 1;
      const year = entryDate.getFullYear();

      // 3) Snapshot rate now so the entry stays historical even if rates change later.
      const takaPerKm = await getRateForEntry({
        employeeId,
        territory: entryData.territory,
        designation: entryData.designation,
        date: entryDate,
      });

      // 4) Find or auto-create the monthly sheet.
      let sheet = await TadaMonthlySheet.findOne({
        employeeId,
        month,
        year,
        deletedAt: null,
      }).session(session);

      if (!sheet) {
        const [createdSheet] = await TadaMonthlySheet.create(
          [
            {
              employeeId,
              employeeName: entryData.employeeName || "",
              designation: entryData.designation || "",
              mobileNo: entryData.mobileNo || "",
              territory: entryData.territory || "",
              area: entryData.area || "",
              month,
              year,
              status: "open",
            },
          ],
          { session },
        );

        sheet = createdSheet;
      }

      const maintenance = normalizeNumber(entryData.maintenance);
      const conveyance = normalizeNumber(entryData.conveyance);
      const da = normalizeNumber(entryData.da);
      const nh = normalizeNumber(entryData.nh);

      const totals = calculateEntryTotals({
        meterReadingStart: normalizeNumber(entryData.meterReadingStart),
        meterReadingEnd: normalizeNumber(entryData.meterReadingEnd),
        takaPerKm,
        maintenance,
        conveyance,
        da,
        nh,
      });

      const payload = {
        employeeId,
        tadaMonthlySheetId: sheet._id,
        entryDate,
        month,
        year,
        visitedPlaces: Array.isArray(entryData.visitedPlaces)
          ? entryData.visitedPlaces
          : [],
        meterReadingStart: normalizeNumber(entryData.meterReadingStart),
        meterReadingEnd: normalizeNumber(entryData.meterReadingEnd),
        takaPerKm,
        totalTravelKm: totals.totalTravelKm,
        totalFuelCost: totals.totalFuelCost,
        maintenance,
        conveyance,
        da,
        nh,
        totalDailyExpense: totals.totalDailyExpense,
        remarks: entryData.remarks || "",
        submittedAt: new Date(),
      };

      const [created] = await TadaEntry.create([payload], { session });
      createdEntry = created;
      sheetId = String(sheet._id);

      await TadaAuditLog.create(
        [
          {
            tadaMonthlySheetId: sheet._id,
            tadaEntryId: created._id,
            actionType: "entry_create",
            performedBy: employeeId,
            changesAfter: created.toObject ? created.toObject() : created,
            comment: "Daily entry submitted",
          },
        ],
        { session },
      );
    });

    // Recalculate only after the transaction is committed,
    // so the monthly service can actually see the new sheet/entry.
    if (sheetId) {
      await tadaMonthlySheetService.recalculateMonthlyTotals(sheetId);
    }

    return createdEntry;
  },

  async getEntriesByMonth(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<any[]> {
    const result = await base.list({
      filter: {
        employeeId,
        month,
        year,
        deletedAt: null,
      },
      sort: "entryDate",
      limit: 1000,
    });

    return result?.data ?? [];
  },
};

export type TadaEntryService = typeof tadaEntryService;
