// src/services/special-offer-progress.service.ts
import { ClientSession, Types } from "mongoose";
import SpecialOffer, { ISpecialOffer } from "../models/special-offer.model";
import SpecialOfferProgress from "../models/special-offer-progress.model";
import { createCrudService } from "./crud.service";

/* ==========================================================
   CRUD base
========================================================== */
const base = createCrudService(SpecialOfferProgress, {
  searchFields: [],
  allowedFilterFields: [
    "offerId",
    "dealerId",
    "fulfilledRules",
    "rewardIssued",
  ],
  defaultPopulate: ["offerId", "dealerId"],
});

/* ==========================================================
   Extended Service
========================================================== */
export const specialOfferProgressService = {
  ...base,

  /**
   * Mark dealer as fulfilling rules
   */
  async markRulesFulfilled(
    offerId: string,
    dealerId: string,
    session?: ClientSession,
  ) {
    return SpecialOfferProgress.findOneAndUpdate(
      { offerId, dealerId },
      { fulfilledRules: true, updatedAt: new Date() },
      { upsert: true, new: true, session },
    );
  },

  /**
   * Issue reward to dealer
   */
  async issueReward(
    offer: ISpecialOffer,
    dealerId: string,
    rewardDetails?: any,
    session?: ClientSession,
  ) {
    if (!offer) throw new Error("Offer not found");

    return SpecialOfferProgress.findOneAndUpdate(
      { offerId: offer._id, dealerId },
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
   * Check if dealer already claimed reward
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
   * List dealer progress for an offer
   */
  async listProgressForOffer(offerId: string) {
    return base.list({ filter: { offerId } });
  },

  /**
   * List offers for a dealer
   */
  async listProgressForDealer(dealerId: string) {
    return base.list({ filter: { dealerId } });
  },

  model: base.model,
};
