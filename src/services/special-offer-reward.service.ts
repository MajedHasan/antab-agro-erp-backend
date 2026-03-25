// src/services/special-offer-reward.service.ts
import { ClientSession, Types } from "mongoose";
import SpecialOffer, { ISpecialOffer } from "../models/special-offer.model";
import SpecialOfferProgress from "../models/special-offer-progress.model";
import { createCrudService } from "./crud.service";

/* ==========================================================
   CRUD base
========================================================== */
const base = createCrudService(SpecialOfferProgress, {
  searchFields: [],
  allowedFilterFields: ["offerId", "dealerId", "rewardIssued", "rewardType"],
  defaultPopulate: ["offerId", "dealerId"],
});

/* ==========================================================
   Extended Service: Reward Management
========================================================== */
export const specialOfferRewardService = {
  ...base,

  /**
   * Issue a reward for a dealer for a specific offer
   */
  async issueReward(
    offerId: string,
    dealerId: string,
    rewardDetails?: any,
    session?: ClientSession,
  ) {
    const offer = await SpecialOffer.findById(offerId).lean<ISpecialOffer>();
    if (!offer) throw new Error("Special offer not found");

    // Now TS knows offer.rewardType and offer.rewardQuantity exist
    return SpecialOfferProgress.findOneAndUpdate(
      { offerId, dealerId },
      {
        fulfilledRules: true,
        rewardIssued: true,
        rewardType: offer.rewardType,
        rewardQuantity: offer.rewardQuantity,
        rewardDetails,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
      { upsert: true, new: true, session },
    );
  },

  /**
   * Check if a reward has been issued for a dealer
   */
  async hasRewardBeenIssued(offerId: string, dealerId: string) {
    const progress = await SpecialOfferProgress.findOne({
      offerId,
      dealerId,
      rewardIssued: true,
    }).lean();

    return !!progress;
  },

  /**
   * List all rewards issued for a specific offer
   */
  async listRewardsForOffer(offerId: string) {
    return base.list({ filter: { offerId, rewardIssued: true } });
  },

  /**
   * List all rewards issued for a specific dealer
   */
  async listRewardsForDealer(dealerId: string) {
    return base.list({ filter: { dealerId, rewardIssued: true } });
  },

  model: base.model,
};
