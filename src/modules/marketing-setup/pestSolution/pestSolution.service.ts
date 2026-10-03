// src/services/pest-solution.service.ts

import PestSolution from "./pestSolution.model";
import { createCrudService } from "../../../services/crud.service";

const base = createCrudService(PestSolution, {
  defaultSort: "-createdAt",

  defaultPopulate: [
    {
      path: "pestTypeId",
      select: "name status",
    },
    {
      path: "solutionId",
      select: "name status",
    },
  ],

  allowedFilterFields: [
    "pestTypeId",
    "solutionId",
  ],
});

export const pestSolutionService = {
  ...base,

  /* =====================================================
     CHECK RELATIONSHIP
  ====================================================== */

  async exists(
    pestTypeId: string,
    solutionId: string
  ) {
    if (!pestTypeId || !solutionId) {
      return false;
    }

    const relation = await PestSolution.exists({
      pestTypeId,
      solutionId,
    });

    return Boolean(relation);
  },

  /* =====================================================
     GET RELATION
  ====================================================== */

  async getRelation(
    pestTypeId: string,
    solutionId: string
  ) {
    return PestSolution.findOne({
      pestTypeId,
      solutionId,
    })
      .populate("pestTypeId")
      .populate("solutionId")
      .lean();
  },

  /* =====================================================
     SYNC SOLUTIONS FOR PEST TYPE
  ====================================================== */

  async syncForPestType(
    pestTypeId: string,
    solutionIds: string[],
    createdBy?: string
  ) {
    const uniqueIds = [
      ...new Set(solutionIds || []),
    ];

    await PestSolution.deleteMany({
      pestTypeId,
      solutionId: {
        $nin: uniqueIds,
      },
    });

    if (uniqueIds.length) {
      await PestSolution.bulkWrite(
        uniqueIds.map((solutionId) => ({
          updateOne: {
            filter: {
              pestTypeId,
              solutionId,
            },
            update: {
              $setOnInsert: {
                pestTypeId,
                solutionId,
                ...(createdBy
                  ? { createdBy }
                  : {}),
              },
            },
            upsert: true,
          },
        }))
      );
    }

    return PestSolution.find({
      pestTypeId,
    })
      .populate("solutionId")
      .lean();
  },
};