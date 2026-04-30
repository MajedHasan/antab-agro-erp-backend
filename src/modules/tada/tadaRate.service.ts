import mongoose from "mongoose";
import { createCrudService } from "../../services/crud.service";
import TadaRate from "./TadaRate.model";

const base = createCrudService(TadaRate, {
  softDeleteField: "deletedAt",
  defaultSort: "-effectiveFrom",
  allowedFilterFields: [
    "rateType",
    "isActive",
    "applicableTo",
    "effectiveFrom",
    "effectiveTo",
  ],
});

function toDate(value: any): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return date;
}

export const tadaRateService = {
  ...base,

  async getActiveGlobalRate(): Promise<number> {
    const rate = await TadaRate.findOne({
      rateType: "global",
      isActive: true,
      effectiveTo: null,
    })
      .sort({ effectiveFrom: -1 })
      .lean();

    return rate?.takaPerKm ?? 3.6;
  },

  async createRate(rateData: any, createdBy: string): Promise<any> {
    return base.withTransaction(async (session: mongoose.ClientSession) => {
      const payload = {
        ...rateData,
        createdBy,
      };

      // If the new rate is a global active rate, close all previous active global rates.
      if (payload.rateType === "global" && payload.isActive !== false) {
        await TadaRate.updateMany(
          { rateType: "global", isActive: true, effectiveTo: null },
          {
            $set: {
              isActive: false,
              effectiveTo: toDate(new Date()),
            },
          },
          { session },
        );
      }

      const created = await base.create(payload, { session });
      return created;
    });
  },
};

export type TadaRateService = typeof tadaRateService;
