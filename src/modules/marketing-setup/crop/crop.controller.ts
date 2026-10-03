import {
  Request,
  Response,
  NextFunction,
} from "express";

import { createCrudController } from "../../../controllers/crud.controller";

import { cropService } from "./crop.service";

/* =========================================================
   BASE CRUD CONTROLLER
========================================================= */

const base = createCrudController(cropService);

/* =========================================================
   CROP CONTROLLER
========================================================= */

export const cropController = {
  ...base,

  /* =====================================================
     GET PEST TYPES FOR CROP
  ====================================================== */

  getPestTypes: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data = await cropService.getPestTypes(
        req.params.id
      );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     GET ALL PEST TYPES FOR CROP
  ====================================================== */

  getAllPestTypes: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await cropService.getAllPestTypes(
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     ASSIGN PEST TYPE
  ====================================================== */

  assignPestType: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { pestTypeId } = req.body;

      const data =
        await cropService.assignPestType(
          req.params.id,
          pestTypeId,
          (req as any).user?._id
        );

      res.status(201).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     REMOVE PEST TYPE
  ====================================================== */

  removePestType: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await cropService.removePestType(
          req.params.id,
          req.params.pestTypeId
        );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     ASSIGN MULTIPLE PEST TYPES
  ====================================================== */

  assignPestTypes: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { pestTypeIds } = req.body;

      const data =
        await cropService.assignPestTypes(
          req.params.id,
          pestTypeIds,
          (req as any).user?._id
        );

      res.status(201).json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     GET COMPLETE CROP HIERARCHY
  ====================================================== */

  getHierarchy: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await cropService.getHierarchy(
          req.params.id
        );

      res.json({
        success: true,
        data,
      });
    } catch (err) {
      next(err);
    }
  },
};