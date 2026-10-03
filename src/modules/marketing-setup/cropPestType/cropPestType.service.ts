// src/services/crop-pest-type.service.ts

import CropPestType from "./cropPestType.model";
import { createCrudService } from "../../../services/crud.service";

const base = createCrudService(CropPestType, {
  defaultSort: "-createdAt",

  defaultPopulate: [
    {
      path: "cropId",
      select: "name status",
    },
    {
      path: "pestTypeId",
      select: "name status",
    },
  ],

  allowedFilterFields: [
    "cropId",
    "pestTypeId",
  ],
});

export const cropPestTypeService = {
  ...base,

  /* =====================================================
     CHECK RELATIONSHIP
  ====================================================== */

  async exists(
    cropId: string,
    pestTypeId: string
  ) {
    if (!cropId || !pestTypeId) return false;

    const relation = await CropPestType.exists({
      cropId,
      pestTypeId,
    });

    return Boolean(relation);
  },

  /* =====================================================
     GET RELATION
  ====================================================== */

  async getRelation(
    cropId: string,
    pestTypeId: string
  ) {
    return CropPestType.findOne({
      cropId,
      pestTypeId,
    })
      .populate("cropId")
      .populate("pestTypeId")
      .lean();
  },

  /* =====================================================
     SYNC PEST TYPES FOR A CROP
  ====================================================== */

  async syncForCrop(
    cropId: string,
    pestTypeIds: string[],
    createdBy?: string
  ) {
    const uniqueIds = [
      ...new Set(pestTypeIds || []),
    ];

    await CropPestType.deleteMany({
      cropId,
      pestTypeId: {
        $nin: uniqueIds,
      },
    });

    if (uniqueIds.length) {
      await CropPestType.bulkWrite(
        uniqueIds.map((pestTypeId) => ({
          updateOne: {
            filter: {
              cropId,
              pestTypeId,
            },
            update: {
              $setOnInsert: {
                cropId,
                pestTypeId,
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

    return CropPestType.find({
      cropId,
    })
      .populate("pestTypeId")
      .lean();
  },
};