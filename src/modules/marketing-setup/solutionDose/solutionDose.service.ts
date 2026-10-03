// src/services/solution-dose.service.ts

import SolutionDose from "./solutionDose.model";
import { createCrudService } from "../../../services/crud.service";

const base = createCrudService(SolutionDose, {
  softDeleteField: "deletedAt",

  defaultSort: "amount",

  defaultPopulate: [
    {
      path: "solutionId",
      select: "name status",
    },
  ],

  allowedFilterFields: [
    "solutionId",
    "unit",
    "status",
  ],
});

export const solutionDoseService = {
  ...base,

  /* =====================================================
     GET DOSES FOR SOLUTION
  ====================================================== */

  async getBySolution(
    solutionId: string,
    {
      activeOnly = true,
    }: {
      activeOnly?: boolean;
    } = {}
  ) {
    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    const filter: any = {
      solutionId,
    };

    if (activeOnly) {
      filter.status = "active";
    }

    return SolutionDose.find(filter)
      .sort({
        amount: 1,
        unit: 1,
      })
      .lean();
  },

  /* =====================================================
     CREATE DOSE
  ====================================================== */

  async createForSolution(
    solutionId: string,
    payload: {
      amount: number;
      unit: "ml/L" | "g/L";
      frequency?: string;
      duration?: string;
      createdBy?: string;
    }
  ) {
    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    if (
      payload.amount === undefined ||
      payload.amount === null
    ) {
      throw new Error("Dose amount is required");
    }

    if (!payload.unit) {
      throw new Error("Dose unit is required");
    }

    return this.create({
      solutionId,
      amount: payload.amount,
      unit: payload.unit,
      frequency: payload.frequency?.trim(),
      duration: payload.duration?.trim(),
      ...(payload.createdBy
        ? {
            createdBy: payload.createdBy,
          }
        : {}),
    });
  },

  /* =====================================================
     DUPLICATE CHECK
  ====================================================== */

  async findExistingDose(
    solutionId: string,
    amount: number,
    unit: "ml/L" | "g/L"
  ) {
    return SolutionDose.findOne({
      solutionId,
      amount,
      unit,
      deletedAt: {
        $exists: false,
      },
    }).lean();
  },

  /* =====================================================
     ACTIVATE / DEACTIVATE
  ====================================================== */

  async setStatus(
    doseId: string,
    status: "active" | "inactive"
  ) {
    if (!doseId) {
      throw new Error("Dose ID is required");
    }

    return SolutionDose.findByIdAndUpdate(
      doseId,
      {
        $set: {
          status,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();
  },
};