import {
  Request,
  Response,
  NextFunction,
} from "express";

import { createCrudController } from "../../../controllers/crud.controller";

import {
  solutionDoseService,
} from "./solutionDose.service";

const base = createCrudController(
  solutionDoseService
);

export const solutionDoseController = {
  ...base,

  /* =====================================================
     GET DOSES FOR SOLUTION
  ====================================================== */

  getBySolution: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const activeOnly =
        req.query.activeOnly !== "false";

      const data =
        await solutionDoseService.getBySolution(
          req.params.solutionId,
          {
            activeOnly,
          }
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
     CREATE DOSE FOR SOLUTION
  ====================================================== */

  createForSolution: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await solutionDoseService.createForSolution(
          req.params.solutionId,
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
     SET STATUS
  ====================================================== */

  setStatus: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { status } = req.body;

      const data =
        await solutionDoseService.setStatus(
          req.params.id,
          status
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