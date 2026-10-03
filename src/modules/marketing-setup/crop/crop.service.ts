// src/services/crop.service.ts

import Crop from "./crop.model";
import CropPestType from "../cropPestType/cropPestType.model";
import PestType from "../pestType/pestType.model";
import { createCrudService } from "../../../services/crud.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudService(Crop, {
  softDeleteField: "deletedAt",

  defaultSort: "name",

  searchFields: ["name"],

  allowedFilterFields: ["name", "status"],
});

/* =========================================================
   EXTENDED CROP SERVICE
========================================================= */

export const cropService = {
  ...base,

  /* =====================================================
     GET ACTIVE PEST TYPES FOR CROP
  ====================================================== */

  async getPestTypes(cropId: string) {
    if (!cropId) {
      throw new Error("Crop ID is required");
    }

    const relations = await CropPestType.find({
      cropId,
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
     GET ALL PEST TYPES FOR CROP
     Includes inactive if needed
  ====================================================== */

  async getAllPestTypes(cropId: string) {
    if (!cropId) {
      throw new Error("Crop ID is required");
    }

    const relations = await CropPestType.find({
      cropId,
    })
      .populate("pestTypeId")
      .sort({ createdAt: 1 })
      .lean();

    return relations
      .map((item: any) => item.pestTypeId)
      .filter(Boolean);
  },

  /* =====================================================
     ASSIGN PEST TYPE TO CROP
  ====================================================== */

  async assignPestType(
    cropId: string,
    pestTypeId: string,
    createdBy?: string
  ) {
    if (!cropId) {
      throw new Error("Crop ID is required");
    }

    if (!pestTypeId) {
      throw new Error("Pest Type ID is required");
    }

    return CropPestType.findOneAndUpdate(
      {
        cropId,
        pestTypeId,
      },
      {
        $setOnInsert: {
          cropId,
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
     REMOVE PEST TYPE FROM CROP
  ====================================================== */

  async removePestType(cropId: string, pestTypeId: string) {
    if (!cropId || !pestTypeId) {
      throw new Error("Crop ID and Pest Type ID are required");
    }

    return CropPestType.findOneAndDelete({
      cropId,
      pestTypeId,
    }).lean();
  },

  /* =====================================================
     ASSIGN MULTIPLE PEST TYPES
  ====================================================== */

  async assignPestTypes(
    cropId: string,
    pestTypeIds: string[],
    createdBy?: string
  ) {
    if (!cropId) {
      throw new Error("Crop ID is required");
    }

    if (!Array.isArray(pestTypeIds)) {
      throw new Error("Pest Type IDs must be an array");
    }

    const uniqueIds = [...new Set(pestTypeIds)];

    if (!uniqueIds.length) {
      return [];
    }

    const operations = uniqueIds.map((pestTypeId) => ({
      updateOne: {
        filter: {
          cropId,
          pestTypeId,
        },
        update: {
          $setOnInsert: {
            cropId,
            pestTypeId,
            ...(createdBy ? { createdBy } : {}),
          },
        },
        upsert: true,
      },
    }));

    await CropPestType.bulkWrite(operations);

    return this.getPestTypes(cropId);
  },

  /* =====================================================
     GET COMPLETE CROP HIERARCHY
  ====================================================== */

  async getHierarchy(cropId: string) {
    if (!cropId) {
      throw new Error("Crop ID is required");
    }

    const crop = await Crop.findOne({
      _id: cropId,
      deletedAt: { $exists: false },
    }).lean();

    if (!crop) {
      throw new Error("Crop not found");
    }

    const pestTypes = await this.getPestTypes(cropId);

    return {
      crop,
      pestTypes,
    };
  },
};