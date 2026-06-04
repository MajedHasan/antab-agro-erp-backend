// modules/prescription/prescription.controller.ts

import { Request, Response, NextFunction } from "express";
import { createCrudController } from "../../controllers/crud.controller";
import { prescriptionService } from "./prescription.service";

const base = createCrudController(prescriptionService, {
  defaultPopulate: [{ path: "createdBy", select: "name mobileNo role" }],
});

function getUser(req: Request): any {
  return (req as any)?.user || null;
}

export const prescriptionController = {
  ...base,

  /**
   * 🔹 Preview Message (NO DB SAVE)
   */
  async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const previewMessageBn = prescriptionService.buildPreviewMessage(
        req.body,
      );

      res.json({
        success: true,
        data: { previewMessageBn },
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * 🔹 Create Prescription + Send SMS
   * ⚠️ Override base.create (VERY IMPORTANT)
   */
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);

      if (!user?.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await prescriptionService.createPrescription(
        req.body,
        user.userId,
      );

      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * 🔹 Salesperson: Get My Prescriptions
   */
  async getMy(req: Request, res: Response, next: NextFunction) {
    try {
      const user = getUser(req);

      if (!user?.userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const data = await prescriptionService.getMyPrescriptions(
        user.userId,
        req.query,
      );

      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * 🔹 Admin: Get All Prescriptions
   * (Optional override if you want control over filters)
   */
  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await prescriptionService.getAllPrescriptions(req.query);

      res.json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  },
};

export type PrescriptionController = typeof prescriptionController;
