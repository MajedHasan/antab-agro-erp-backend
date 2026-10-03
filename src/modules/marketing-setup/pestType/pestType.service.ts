// src/services/pest-type.service.ts

import PestType from "./pestType.model";
import CropPestType from "../cropPestType/cropPestType.model";
import PestSolution from "../pestSolution/pestSolution.model";
import Solution from "../solution/solution.model";
import { createCrudService } from "../../../services/crud.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudService(PestType, {
  softDeleteField: "deletedAt",

  defaultSort: "name",

  searchFields: ["name"],

  allowedFilterFields: ["name", "status"],
});

/* =========================================================
   EXTENDED PEST TYPE SERVICE
========================================================= */

export const pestTypeService = {
  ...base,

  /* =====================================================
     GET CROPS USING THIS PEST TYPE
  ====================================================== */

  async getCrops(pestTypeId: string) {
    if (!pestTypeId) {
      throw new Error("Pest Type ID is required");
    }

    const relations = await CropPestType.find({
      pestTypeId,
    })
      .populate({
        path: "cropId",
        match: {
          status: "active",
          deletedAt: { $exists: false },
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    return relations
      .map((item: any) => item.cropId)
      .filter(Boolean);
  },

  /* =====================================================
     GET ACTIVE SOLUTIONS FOR PEST TYPE
  ====================================================== */

  async getSolutions(pestTypeId: string) {
    if (!pestTypeId) {
      throw new Error("Pest Type ID is required");
    }

    const relations = await PestSolution.find({
      pestTypeId,
    })
      .populate({
        path: "solutionId",
        match: {
          status: "active",
          deletedAt: { $exists: false },
        },
      })
      .sort({ createdAt: 1 })
      .lean();

    return relations
      .map((item: any) => item.solutionId)
      .filter(Boolean);
  },

  /* =====================================================
     GET ALL SOLUTIONS
  ====================================================== */

  async getAllSolutions(pestTypeId: string) {
    if (!pestTypeId) {
      throw new Error("Pest Type ID is required");
    }

    const relations = await PestSolution.find({
      pestTypeId,
    })
      .populate("solutionId")
      .sort({ createdAt: 1 })
      .lean();

    return relations
      .map((item: any) => item.solutionId)
      .filter(Boolean);
  },

  /* =====================================================
     ASSIGN SOLUTION TO PEST TYPE
  ====================================================== */

  async assignSolution(
    pestTypeId: string,
    solutionId: string,
    createdBy?: string
  ) {
    if (!pestTypeId) {
      throw new Error("Pest Type ID is required");
    }

    if (!solutionId) {
      throw new Error("Solution ID is required");
    }

    return PestSolution.findOneAndUpdate(
      {
        pestTypeId,
        solutionId,
      },
      {
        $setOnInsert: {
          pestTypeId,
          solutionId,
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
     REMOVE SOLUTION FROM PEST TYPE
  ====================================================== */

  async removeSolution(
    pestTypeId: string,
    solutionId: string
  ) {
    if (!pestTypeId || !solutionId) {
      throw new Error(
        "Pest Type ID and Solution ID are required"
      );
    }

    return PestSolution.findOneAndDelete({
      pestTypeId,
      solutionId,
    }).lean();
  },

  /* =====================================================
     ASSIGN MULTIPLE SOLUTIONS
  ====================================================== */

  async assignSolutions(
    pestTypeId: string,
    solutionIds: string[],
    createdBy?: string
  ) {
    if (!pestTypeId) {
      throw new Error("Pest Type ID is required");
    }

    if (!Array.isArray(solutionIds)) {
      throw new Error("Solution IDs must be an array");
    }

    const uniqueIds = [...new Set(solutionIds)];

    if (!uniqueIds.length) {
      return [];
    }

    const operations = uniqueIds.map((solutionId) => ({
      updateOne: {
        filter: {
          pestTypeId,
          solutionId,
        },
        update: {
          $setOnInsert: {
            pestTypeId,
            solutionId,
            ...(createdBy ? { createdBy } : {}),
          },
        },
        upsert: true,
      },
    }));

    await PestSolution.bulkWrite(operations);

    return this.getSolutions(pestTypeId);
  },
};