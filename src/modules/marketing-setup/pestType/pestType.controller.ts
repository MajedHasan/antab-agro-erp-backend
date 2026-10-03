import {
  Request,
  Response,
  NextFunction,
} from "express";

import { createCrudController } from "../../../controllers/crud.controller";

import { pestTypeService } from "./pestType.service";

const base = createCrudController(
  pestTypeService
);

export const pestTypeController = {
  ...base,

  /* =====================================================
     GET CROPS
  ====================================================== */

  getCrops: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await pestTypeService.getCrops(
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
     GET SOLUTIONS
  ====================================================== */

  getSolutions: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await pestTypeService.getSolutions(
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
     GET ALL SOLUTIONS
  ====================================================== */

  getAllSolutions: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await pestTypeService.getAllSolutions(
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
     ASSIGN SOLUTION
  ====================================================== */

  assignSolution: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { solutionId } = req.body;

      const data =
        await pestTypeService.assignSolution(
          req.params.id,
          solutionId,
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
     REMOVE SOLUTION
  ====================================================== */

  removeSolution: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data =
        await pestTypeService.removeSolution(
          req.params.id,
          req.params.solutionId
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
     ASSIGN MULTIPLE SOLUTIONS
  ====================================================== */

  assignSolutions: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { solutionIds } = req.body;

      const data =
        await pestTypeService.assignSolutions(
          req.params.id,
          solutionIds,
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
};