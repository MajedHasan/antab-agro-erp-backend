// src/controllers/special-offer.controller.ts
import { Request, Response, NextFunction } from "express";
import { createCrudController } from "./crud.controller";
import { specialOfferService } from "../services/special-offer.service";
import { specialOfferProgressService } from "../services/special-offer-progress.service";
import { specialOfferRewardService } from "../services/special-offer-reward.service";

/* =========================================================
   BASE CRUD
========================================================= */
const base = createCrudController(specialOfferService);

/* =========================================================
   EXTENDED CONTROLLER
========================================================= */
export const specialOfferController = {
  ...base,

  /**
   * GET /special-offers/:id/details
   * - Get offer with rules and optionally progress
   */
  details: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offerId = req.params.id;
      const populateProgress = req.query.progress === "true";

      const offer = await specialOfferService.getById(offerId, {
        populate: ["rules"], // populate rules if exists
      });

      if (!offer) {
        return res
          .status(404)
          .json({ success: false, message: "Offer not found" });
      }

      let progress = null;
      if (populateProgress) {
        progress = await specialOfferProgressService.list({
          filter: { offerId },
        });
      }

      res.json({ success: true, data: { offer, progress } });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /special-offers/:id/progress
   * List dealer progress for an offer
   */
  getProgress: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offerId = req.params.id;

      const progress =
        await specialOfferProgressService.listProgressForOffer(offerId);

      res.json({ success: true, data: progress });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /special-offers/:id/issue-reward
   * body: { dealerId, rewardDetails? }
   */
  issueReward: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offerId = req.params.id;
      const { dealerId, rewardDetails } = req.body;

      if (!dealerId) {
        return res
          .status(400)
          .json({ success: false, message: "dealerId is required" });
      }

      const reward = await specialOfferRewardService.issueReward(
        offerId,
        dealerId,
        rewardDetails,
      );

      res.json({ success: true, data: reward });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /special-offers/:id/rewards
   * List all rewards issued for this offer
   */
  listRewards: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offerId = req.params.id;

      const rewards =
        await specialOfferRewardService.listRewardsForOffer(offerId);

      res.json({ success: true, data: rewards });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /dealers/:dealerId/special-offers/rewards
   * List all rewards received by a dealer
   */
  listDealerRewards: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const dealerId = req.params.dealerId;

      const rewards =
        await specialOfferRewardService.listRewardsForDealer(dealerId);

      res.json({ success: true, data: rewards });
    } catch (err) {
      next(err);
    }
  },
};
