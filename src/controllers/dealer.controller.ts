// src/controllers/dealer.controller.ts
import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { dealerService } from "../services/dealer.service";

/* =========================================================
   BASE CRUD
========================================================= */

const base = createCrudController(dealerService);

/* =========================================================
   EXTENDED CONTROLLER
========================================================= */

export const dealerController = {
  ...base,

  /* =====================================================
     🔥 AUTO CREATE ACCOUNT FOR DEALER
     POST /api/dealers/:id/auto-account
  ====================================================== */
  async autoAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const dealerId = req.params.id;

      await dealerService.createAutoAccountForDealer(dealerId);

      res.json({
        success: true,
        message: "Auto account created/linked successfully",
      });
    } catch (err) {
      next(err);
    }
  },

  /* =====================================================
     🔥 SYNC DEALER NAME → ACCOUNT NAME
     POST /api/dealers/:id/sync-account-name
  ====================================================== */
  async syncAccountName(req: Request, res: Response, next: NextFunction) {
    try {
      const dealerId = req.params.id;

      await dealerService.syncAccountName(dealerId);

      res.json({
        success: true,
        message: "Account name synchronized successfully",
      });
    } catch (err) {
      next(err);
    }
  },
};
