import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { dealerService } from "../services/dealer.service";

const base = createCrudController(dealerService);

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export const dealerController = {
  ...base,

  /**
   * GET /dealers/generate-code?zone=&region=&area=&territory=
   */
  generateCode: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { zone, region, area, territory } = req.query;

      const code = await dealerService.generateCode({
        zone: typeof zone === "string" ? zone : undefined,
        region: typeof region === "string" ? region : undefined,
        area: typeof area === "string" ? area : undefined,
        territory: typeof territory === "string" ? territory : undefined,
      });

      res.json({
        success: true,
        data: code,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /dealers/:id/auto-account
   */
  autoAccount: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await dealerService.createAutoAccountForDealer(req.params.id);

      res.json({
        success: true,
        message: "Auto account created/linked successfully",
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /dealers/:id/sync-account-name
   */
  syncAccountName: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await dealerService.syncAccountName(req.params.id);

      res.json({
        success: true,
        message: "Account name synchronized successfully",
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /dealers/:id/credit-summary
   */
  getCreditSummary: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await dealerService.getCreditSummary(req.params.id);

      res.json({
        success: true,
        data,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /dealers/:id/credit-validate?amount=1000
   */
  validateCredit: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const amount = toNumber(req.query.amount);

      if (!Number.isFinite(amount) || amount <= 0) {
        res.status(400).json({
          success: false,
          message: "amount must be a positive number",
        });
        return;
      }

      const data = await dealerService.validateCredit(req.params.id, amount);

      res.json({
        success: true,
        data,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /dealers/:id/signature
   */
  getSignatureTemplate: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await dealerService.getSignatureTemplate(req.params.id);

      res.json({
        success: true,
        data,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /dealers/:id/signature
   * body: { mediaId }
   */
  updateSignatureTemplate: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mediaId } = req.body;

      if (!mediaId) {
        res.status(400).json({
          success: false,
          message: "mediaId is required",
        });
        return;
      }

      const data = await dealerService.updateSignatureTemplate(
        req.params.id,
        String(mediaId),
      );

      res.json({
        success: true,
        data,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /dealers/:id/status-check
   */
  checkStatus: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dealer = await dealerService.assertDealerActive(req.params.id);

      res.json({
        success: true,
        data: {
          id: dealer._id,
          status: dealer.status,
        },
      });
      return;
    } catch (err) {
      next(err);
    }
  },
};
