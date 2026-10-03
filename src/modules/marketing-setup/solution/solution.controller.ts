import {
  Request,
  Response,
  NextFunction,
} from "express";

import { createCrudController } from "../../../controllers/crud.controller";

import { solutionService } from "./solution.service";

const base = createCrudController(
  solutionService
);

export const solutionController = {
  ...base,

  /* =====================================================
     GET PEST TYPES
  ====================================================== */

  getPestTypes: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionService.getPestTypes(
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
     GET DOSES
  ====================================================== */

  getDoses: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionService.getDoses(
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
     GET ALL DOSES
  ====================================================== */

  getAllDoses: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionService.getAllDoses(
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
     CREATE DOSE
  ====================================================== */

  createDose: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionService.createDose(
          req.params.id,
          {
            ...req.body,
            createdBy: (req as any).user?._id,
          }
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
     UPDATE DOSE
  ====================================================== */

  updateDose: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionService.updateDose(
          req.params.doseId,
          req.body
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
     DELETE DOSE
  ====================================================== */

  removeDose: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const hard =
        req.query.hard === "true";

      const data =
        await solutionService.removeDose(
          req.params.doseId,
          { hard }
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
        await solutionService.assignPestType(
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
        await solutionService.removePestType(
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
     GET COMPLETE DETAILS
  ====================================================== */

  getDetails: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionService.getDetails(
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