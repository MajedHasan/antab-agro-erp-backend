// src/services/solution.service.ts

import Solution from "./solution.model";
import PestSolution from "../pestSolution/pestSolution.model";
import PestType from "../pestType/pestType.model";
import SolutionDose from "../solutionDose/solutionDose.model";
import { createCrudService } from "../../../services/crud.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudService(Solution, {
  softDeleteField: "deletedAt",

  defaultSort: "name",

  searchFields: ["name"],

  allowedFilterFields: ["name", "status"],
});

/* =========================================================
   EXTENDED SOLUTION SERVICE
========================================================= */

export const solutionService = {
  ...base,

  /* =====================================================
     GET PEST TYPES USING THIS SOLUTION
  ====================================================== */

  async getPestTypes(solutionId: string) {
    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    const relations = await PestSolution.find({
      solutionId,
    })
      .populate({
        path: "pestTypeId",
        match: {
          status: "active",
          deletedAt: { $exists: false },
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    return relations
      .map((item: any) => item.pestTypeId)
      .filter(Boolean);
  },

  /* =====================================================
     GET ACTIVE DOSES
  ====================================================== */

  async getDoses(solutionId: string) {
    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    return SolutionDose.find({
      solutionId,
      status: "active",
      deletedAt: { $exists: false },
    })
      .sort({
        amount: 1,
        unit: 1,
      })
      .lean();
  },

  /* =====================================================
     GET ALL DOSES
  ====================================================== */

  async getAllDoses(solutionId: string) {
    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    return SolutionDose.find({
      solutionId,
    })
      .sort({
        amount: 1,
        unit: 1,
      })
      .lean();
  },

  /* =====================================================
     CREATE DOSE
  ====================================================== */

  async createDose(
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

    return SolutionDose.create({
      solutionId,
      amount: payload.amount,
      unit: payload.unit,
      frequency: payload.frequency?.trim(),
      duration: payload.duration?.trim(),
      ...(payload.createdBy
        ? { createdBy: payload.createdBy }
        : {}),
    });
  },

  /* =====================================================
     UPDATE DOSE
  ====================================================== */

  async updateDose(
    doseId: string,
    payload: {
      amount?: number;
      unit?: "ml/L" | "g/L";
      frequency?: string;
      duration?: string;
      status?: "active" | "inactive";
    }
  ) {
    if (!doseId) {
      throw new Error("Dose ID is required");
    }

    return SolutionDose.findByIdAndUpdate(
      doseId,
      {
        $set: payload,
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();
  },

  /* =====================================================
     DELETE / DEACTIVATE DOSE
  ====================================================== */

  async removeDose(
    doseId: string,
    { hard = false } = {}
  ) {
    if (!doseId) {
      throw new Error("Dose ID is required");
    }

    if (!hard) {
      return SolutionDose.findByIdAndUpdate(
        doseId,
        {
          $set: {
            status: "inactive",
          },
        },
        {
          new: true,
        }
      ).lean();
    }

    return SolutionDose.findByIdAndDelete(doseId).lean();
  },

  /* =====================================================
     ASSIGN PEST TYPE
  ====================================================== */

  async assignPestType(
    solutionId: string,
    pestTypeId: string,
    createdBy?: string
  ) {
    if (!solutionId || !pestTypeId) {
      throw new Error(
        "Solution ID and Pest Type ID are required"
      );
    }

    return PestSolution.findOneAndUpdate(
      {
        solutionId,
        pestTypeId,
      },
      {
        $setOnInsert: {
          solutionId,
          pestTypeId,
          ...(createdBy ? { createdBy } : {}),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();
  },

  /* =====================================================
     REMOVE PEST TYPE
  ====================================================== */

  async removePestType(
    solutionId: string,
    pestTypeId: string
  ) {
    if (!solutionId || !pestTypeId) {
      throw new Error(
        "Solution ID and Pest Type ID are required"
      );
    }

    return PestSolution.findOneAndDelete({
      solutionId,
      pestTypeId,
    }).lean();
  },

  /* =====================================================
     GET COMPLETE SOLUTION DETAILS
  ====================================================== */

  async getDetails(solutionId: string) {
    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    const solution = await Solution.findOne({
      _id: solutionId,
      deletedAt: { $exists: false },
    }).lean();

    if (!solution) {
      throw new Error("Solution not found");
    }

    const [pestTypes, doses] = await Promise.all([
      this.getPestTypes(solutionId),
      this.getDoses(solutionId),
    ]);

    return {
      solution,
      pestTypes,
      doses,
    };
  },
};