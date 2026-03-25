import { createCrudService } from "./crud.service";
import Promotion, {
  IPromotion,
  IPromotionRule,
} from "../models/product-promotion.model";
import Product, { IProduct } from "../models/product.model";
import { ClientSession, Types } from "mongoose";

const base = createCrudService(Promotion, {
  searchFields: ["name", "description"],
  allowedFilterFields: [
    "status",
    "promotionType",
    "warehouseIds",
    "customerIds",
    "customerGroupIds",
  ],
});

function toObjectId(id?: string | Types.ObjectId) {
  if (!id) return undefined;
  return typeof id === "string" ? new Types.ObjectId(id) : id;
}

export const promotionService = {
  ...base,

  /**
   * Get all valid active promotions for a product
   */
  async getActivePromotions(
    productId: string | Types.ObjectId,
    customerId?: string | Types.ObjectId,
    warehouseId?: string | Types.ObjectId,
  ): Promise<IPromotion[]> {
    const now = new Date();

    const productObjectId = toObjectId(productId);
    const customerObjectId = toObjectId(customerId);
    const warehouseObjectId = toObjectId(warehouseId);

    const filter: any = {
      status: "Active",
      isActive: true,
      "rules.productId": productObjectId,
      $and: [
        // Start Date condition
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: null },
            { startDate: { $lte: now } },
          ],
        },
        // End Date condition
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: null },
            { endDate: { $gte: now } },
          ],
        },
        // Usage limit condition
        {
          $or: [
            { usageLimit: { $exists: false } },
            { usageLimit: null },
            { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
          ],
        },
      ],
    };

    // Customer filter
    if (customerObjectId) {
      filter.$and.push({
        $or: [
          { customerIds: { $exists: false } },
          { customerIds: { $size: 0 } },
          { customerIds: customerObjectId },
        ],
      });
    }

    // Warehouse filter
    if (warehouseObjectId) {
      filter.$and.push({
        $or: [
          { warehouseIds: { $exists: false } },
          { warehouseIds: { $size: 0 } },
          { warehouseIds: warehouseObjectId },
        ],
      });
    }

    const promotions = await Promotion.find(filter)
      .sort({ priority: -1, createdAt: -1 }) // higher priority first
      .lean<IPromotion[]>()
      .exec();

    return promotions;
  },

  /**
   * Calculate Buy X Get Y bonus
   */
  async calculateBonusQty(
    productId: string | Types.ObjectId,
    qty: number,
    customerId?: string | Types.ObjectId,
    warehouseId?: string | Types.ObjectId,
  ): Promise<{ bonusQty: number; appliedPromotionId?: string }> {
    if (!qty || qty <= 0) {
      return { bonusQty: 0 };
    }

    // ✅ productId is REQUIRED — force convert safely
    const productObjectId =
      typeof productId === "string" ? new Types.ObjectId(productId) : productId;

    let bestBonus = 0; // ✅ FIXED
    let appliedPromotionId: string | undefined; // ✅ FIXED

    const promotions = await this.getActivePromotions(
      productObjectId,
      customerId,
      warehouseId,
    );

    for (const promo of promotions) {
      if (promo.promotionType !== "BUY_X_GET_Y") continue;

      for (const rule of promo.rules) {
        // ✅ Make sure rule belongs to THIS product
        if (rule.productId.toString() !== productObjectId.toString()) {
          continue;
        }

        if (!rule.buyQty || !rule.getQty) continue;

        const times = Math.floor(qty / rule.buyQty);
        if (times <= 0) continue;

        let promoBonus = times * rule.getQty;

        if (rule.maxBonusQty !== undefined) {
          promoBonus = Math.min(promoBonus, rule.maxBonusQty);
        }

        if (promoBonus > bestBonus) {
          bestBonus = promoBonus;
          appliedPromotionId = promo._id.toString();
        }
      }
    }

    // ✅ If promotion found, return it
    if (bestBonus > 0) {
      return {
        bonusQty: bestBonus,
        appliedPromotionId,
      };
    }

    // ✅ Otherwise fallback to product default
    const product = await Product.findById(productObjectId).lean<IProduct>();

    if (
      product?.defaultBonusRule?.buyQty &&
      product?.defaultBonusRule?.getQty
    ) {
      const times = Math.floor(qty / product.defaultBonusRule.buyQty);
      return {
        bonusQty: times * product.defaultBonusRule.getQty,
      };
    }

    return { bonusQty: 0 };
  },

  /**
   * Increment usage count safely
   */
  async incrementUsage(
    promotionId: string | Types.ObjectId,
    session?: ClientSession,
  ) {
    const promotionObjectId = toObjectId(promotionId);

    return Promotion.findOneAndUpdate(
      {
        _id: promotionObjectId,
        $or: [
          { usageLimit: { $exists: false } },
          { usageLimit: null },
          { $expr: { $lt: ["$usageCount", "$usageLimit"] } },
        ],
      },
      { $inc: { usageCount: 1 } },
      { new: true, session },
    ).lean<IPromotion>();
  },
};
