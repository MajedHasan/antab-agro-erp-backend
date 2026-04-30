import mongoose from "mongoose";
import { createCrudService } from "../../services/crud.service";
import TadaMonthlySheet from "./TadaMonthlySheet.model";
import TadaEntry from "./TadaEntry.model";
import TadaAuditLog from "./TadaAuditLog.model";
import { numberToWords } from "./tada.helper";

const base = createCrudService(TadaMonthlySheet, {
  softDeleteField: "deletedAt",
  defaultSort: "-year -month",
  allowedFilterFields: [
    "employeeId",
    "status",
    "month",
    "year",
    "territory",
    "area",
  ],
  defaultPopulate: [
    { path: "employeeId", select: "name designation mobileNo" },
  ],
});

function normalizeNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toObjectId(id: string) {
  return new mongoose.Types.ObjectId(id);
}

export const tadaMonthlySheetService = {
  ...base,

  async getMonthlyOverview(employeeId: string, year?: number): Promise<any[]> {
    const targetYear = year || new Date().getFullYear();

    const sheets = await TadaMonthlySheet.find({
      employeeId,
      year: targetYear,
      deletedAt: null,
    }).lean();

    const map = new Map<number, any>();
    for (const sheet of sheets) {
      map.set(sheet.month, sheet);
    }

    const result: any[] = [];

    for (let month = 1; month <= 12; month += 1) {
      const sheet = map.get(month);

      if (sheet) {
        result.push(sheet);
      } else {
        result.push({
          month,
          year: targetYear,
          status: null,
          grandTotalExpense: 0,
          workingDaysCount: 0,
        });
      }
    }

    return result;
  },

  async getSheetWithEntries(
    sheetId: string,
  ): Promise<{ sheet: any; entries: any[] }> {
    const sheet = await base.getById(sheetId);

    if (!sheet) {
      throw new Error("Monthly sheet not found");
    }

    const entries = await TadaEntry.find({
      tadaMonthlySheetId: sheetId,
      deletedAt: null,
    }).sort({ entryDate: 1 });

    return { sheet, entries };
  },

  async recalculateMonthlyTotals(sheetId: string): Promise<any> {
    const sheet = await base.getById(sheetId);

    if (!sheet) {
      throw new Error("Monthly sheet not found");
    }

    const [agg] = await TadaEntry.aggregate([
      {
        $match: {
          tadaMonthlySheetId: toObjectId(sheetId),
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          totalTravelKmMonth: { $sum: "$totalTravelKm" },
          totalFuelCostMonth: { $sum: "$totalFuelCost" },
          totalMaintenanceMonth: { $sum: "$maintenance" },
          totalConveyanceMonth: { $sum: "$conveyance" },
          totalDAMonth: { $sum: "$da" },
          totalNHMonth: { $sum: "$nh" },
          totalDailyExpensesMonth: { $sum: "$totalDailyExpense" },
          workingDaysCount: { $sum: 1 },
        },
      },
    ]);

    const totalTravelKmMonth = normalizeNumber(agg?.totalTravelKmMonth);
    const totalFuelCostMonth = normalizeNumber(agg?.totalFuelCostMonth);
    const totalMaintenanceMonth = normalizeNumber(agg?.totalMaintenanceMonth);
    const totalConveyanceMonth = normalizeNumber(agg?.totalConveyanceMonth);
    const totalDAMonth = normalizeNumber(agg?.totalDAMonth);
    const totalNHMonth = normalizeNumber(agg?.totalNHMonth);
    const totalDailyExpensesMonth = normalizeNumber(
      agg?.totalDailyExpensesMonth,
    );
    const workingDaysCount = normalizeNumber(agg?.workingDaysCount);

    const grandTotalExpense =
      totalDailyExpensesMonth +
      normalizeNumber(sheet.entertainmentFood) +
      normalizeNumber(sheet.motorcycleRent) +
      normalizeNumber(sheet.photocopy) +
      normalizeNumber(sheet.stationary) +
      normalizeNumber(sheet.others);

    const updated = await base.update(sheetId, {
      totalTravelKmMonth,
      totalFuelCostMonth,
      totalMaintenanceMonth,
      totalConveyanceMonth,
      totalDAMonth,
      totalNHMonth,
      totalDailyExpensesMonth,
      workingDaysCount,
      grandTotalExpense,
      grandTotalInWords: numberToWords(grandTotalExpense),
    });

    return updated;
  },

  async submitMonthlySheet(
    sheetId: string,
    employeeId: string,
    additionalExpenses: any,
  ): Promise<any> {
    return base.withTransaction(async (session: mongoose.ClientSession) => {
      const sheet = await base.getById(sheetId);

      if (!sheet) {
        throw new Error("Monthly sheet not found");
      }

      if (String(sheet.employeeId) !== String(employeeId)) {
        throw new Error("You can only submit your own monthly sheet");
      }

      if (sheet.status !== "open") {
        throw new Error(
          `Only open sheets can be submitted. Current status: ${sheet.status}`,
        );
      }

      // Save expense fields first, then recalculate the monthly totals from all entries.
      await base.update(
        sheetId,
        {
          entertainmentFood: normalizeNumber(
            additionalExpenses?.entertainmentFood,
          ),
          motorcycleRent: normalizeNumber(additionalExpenses?.motorcycleRent),
          photocopy: normalizeNumber(additionalExpenses?.photocopy),
          stationary: normalizeNumber(additionalExpenses?.stationary),
          others: normalizeNumber(additionalExpenses?.others),
        },
        { session },
      );

      await tadaMonthlySheetService.recalculateMonthlyTotals(sheetId);

      const submitted = await base.update(
        sheetId,
        {
          status: "submitted",
          submittedAt: new Date(),
          submittedBy: employeeId,
        },
        { session },
      );

      await TadaAuditLog.create(
        [
          {
            tadaMonthlySheetId: sheetId,
            actionType: "status_change",
            performedBy: employeeId,
            fromStatus: "open",
            toStatus: "submitted",
            comment: "Monthly sheet submitted",
          },
        ],
        { session },
      );

      return submitted;
    });
  },

  async checkMonthlySheet(sheetId: string, managerId: string): Promise<any> {
    const sheet = await base.getById(sheetId);

    if (!sheet) {
      throw new Error("Monthly sheet not found");
    }

    if (sheet.status !== "submitted") {
      throw new Error("Only submitted sheets can be checked");
    }

    const updated = await base.update(sheetId, {
      status: "checked",
      checkedAt: new Date(),
      checkedBy: managerId,
    });

    await TadaAuditLog.create({
      tadaMonthlySheetId: sheetId,
      actionType: "status_change",
      performedBy: managerId,
      fromStatus: "submitted",
      toStatus: "checked",
      comment: "Monthly sheet checked",
    });

    return updated;
  },

  async approveMonthlySheet(sheetId: string, adminId: string): Promise<any> {
    const sheet = await base.getById(sheetId);

    if (!sheet) {
      throw new Error("Monthly sheet not found");
    }

    if (sheet.status !== "checked") {
      throw new Error("Only checked sheets can be approved");
    }

    const updated = await base.update(sheetId, {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: adminId,
    });

    await TadaAuditLog.create({
      tadaMonthlySheetId: sheetId,
      actionType: "status_change",
      performedBy: adminId,
      fromStatus: "checked",
      toStatus: "approved",
      comment: "Monthly sheet approved",
    });

    return updated;
  },

  async rejectMonthlySheet(
    sheetId: string,
    userId: string,
    reason: string,
  ): Promise<any> {
    if (!reason || !reason.trim()) {
      throw new Error("Rejection reason is required");
    }

    const sheet = await base.getById(sheetId);

    if (!sheet) {
      throw new Error("Monthly sheet not found");
    }

    if (sheet.status === "open" || sheet.status === "approved") {
      throw new Error(`Cannot reject a sheet in ${sheet.status} status`);
    }

    const updated = await base.update(sheetId, {
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: userId,
      rejectionReason: reason.trim(),
    });

    await TadaAuditLog.create({
      tadaMonthlySheetId: sheetId,
      actionType: "status_change",
      performedBy: userId,
      fromStatus: sheet.status,
      toStatus: "rejected",
      comment: reason.trim(),
    });

    return updated;
  },

  async editEntry(
    entryId: string,
    updateData: any,
    editorUser: { _id: string; role: string },
  ): Promise<any> {
    const entry = await TadaEntry.findById(entryId);
    if (!entry) {
      throw new Error("Entry not found");
    }

    const sheet = await base.getById(String(entry.tadaMonthlySheetId));
    if (!sheet) {
      throw new Error("Monthly sheet not found");
    }

    // Approved sheets are locked for everyone except super_admin.
    if (sheet.status === "approved" && editorUser.role !== "super_admin") {
      throw new Error(
        "Approved sheet is locked. Only super_admin can edit entries.",
      );
    }

    const allowedFields = [
      "visitedPlaces",
      "meterReadingStart",
      "meterReadingEnd",
      "maintenance",
      "conveyance",
      "da",
      "nh",
      "remarks",
    ];

    const changesBefore = entry.toObject ? entry.toObject() : { ...entry };

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        (entry as any)[field] = updateData[field];
      }
    }

    entry.isEdited = true;
    entry.editedBy = editorUser._id as any;
    entry.editedAt = new Date();

    await entry.save();

    await tadaMonthlySheetService.recalculateMonthlyTotals(String(sheet._id));

    await TadaAuditLog.create({
      tadaMonthlySheetId: sheet._id,
      tadaEntryId: entry._id,
      actionType: "entry_edit",
      performedBy: editorUser._id,
      changesBefore,
      changesAfter: entry.toObject ? entry.toObject() : entry,
      comment: "Daily entry updated",
    });

    return entry;
  },

  async getTeamSheets(filters: any = {}): Promise<any> {
    const filter: Record<string, any> = {
      deletedAt: null,
    };

    const allowedKeys = ["status", "month", "year", "territory", "area"];

    for (const key of allowedKeys) {
      if (
        filters[key] !== undefined &&
        filters[key] !== null &&
        filters[key] !== ""
      ) {
        filter[key] = filters[key];
      }
    }

    return base.list({
      filter,
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      sort: "-year -month",
      populate: [{ path: "employeeId", select: "name designation mobileNo" }],
    });
  },
};

export type TadaMonthlySheetService = typeof tadaMonthlySheetService;
