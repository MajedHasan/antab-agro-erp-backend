// src/services/special-offer.service.ts
import mongoose, { ClientSession, Types } from "mongoose";
import SpecialOffer, { ISpecialOffer } from "../models/special-offer.model";
import SpecialOfferRule, {
  ISpecialOfferRule,
  ISpecialOfferRuleNode,
} from "../models/special-offer-rule.model";
import { createCrudService } from "./crud.service";

const base = createCrudService(SpecialOffer, {
  searchFields: ["name", "description"],
  allowedFilterFields: ["isActive", "rewardType"],
  defaultPopulate: ["rules"],
});

export const specialOfferService = {
  ...base,

  /**
   * Create offer + rules in one transaction
   */
  async createWithRules(
    payload: Partial<ISpecialOffer>,
    rules: ISpecialOfferRuleNode[],
  ) {
    return base.withTransaction(async (session: ClientSession) => {
      // 1️⃣ create offer
      const offer = await base.create(payload, { session });

      // 2️⃣ create rules
      let ruleDoc: ISpecialOfferRule | null = null;
      if (rules && rules.length) {
        ruleDoc = new SpecialOfferRule({
          offerId: offer._id,
          rules,
        });
        await ruleDoc.save({ session });

        // 3️⃣ attach rules to offer
        offer.rules = [ruleDoc._id];
        await offer.save({ session });
      }

      return await SpecialOffer.findById(offer._id).populate("rules").lean();
    });
  },

  /**
   * Update offer + rules in one transaction
   */
  async updateWithRules(
    offerId: string,
    payload: Partial<ISpecialOffer>,
    rules?: ISpecialOfferRuleNode[],
  ) {
    return base.withTransaction(async (session: ClientSession) => {
      const offer = await SpecialOffer.findById(offerId).session(session);
      if (!offer) throw new Error("Offer not found");

      // 1️⃣ update offer fields
      Object.assign(offer, payload);
      await offer.save({ session });

      // 2️⃣ update rules
      if (rules) {
        // check if rule doc exists
        let ruleDoc = await SpecialOfferRule.findOne({ offerId }).session(
          session,
        );

        if (ruleDoc) {
          ruleDoc.rules = rules;
          await ruleDoc.save({ session });
        } else {
          ruleDoc = new SpecialOfferRule({ offerId, rules });
          await ruleDoc.save({ session });
          offer.rules = [ruleDoc._id];
          await offer.save({ session });
        }
      }

      return await SpecialOffer.findById(offer._id).populate("rules").lean();
    });
  },

  /**
   * Get offer with populated rules
   */
  async getWithRules(offerId: string) {
    return SpecialOffer.findById(offerId).populate("rules").lean();
  },

  /**
   * Delete offer + its rules
   */
  async removeWithRules(offerId: string) {
    return base.withTransaction(async (session: ClientSession) => {
      // delete rules
      await SpecialOfferRule.deleteMany({ offerId }).session(session);

      // delete offer
      return base.remove(offerId, { session, hard: true });
    });
  },

  model: base.model,
};
