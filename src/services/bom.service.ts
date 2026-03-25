import { createCrudService } from "./crud.service";
import BOM from "../models/bom.model";

const base = createCrudService(BOM, {
  defaultPopulate: ["productId", "components.itemId"],
  beforeCreate: async (payload) => {
    await BOM.updateMany({ productId: payload.productId }, { isActive: false });
    return payload;
  },
});

export const bomService = {
  ...base,
};
