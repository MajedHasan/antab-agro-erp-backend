import { createCrudService } from "./crud.service";
import WarehouseModel from "../models/warehouse.model";
import { IWarehouse } from "../models/warehouse.model";

const base = createCrudService(WarehouseModel, {
  defaultPopulate: ["assignedUsers"],
  searchFields: ["name", "code", "address", "status"],
  allowedFilterFields: ["assignedUsers", "status"],
});

export const warehouseService = {
  ...base,

  async assignUsers(id: string, userIds: string[]) {
    return base.model
      .findByIdAndUpdate(
        id,
        { $addToSet: { assignedUsers: { $each: userIds } } },
        { new: true }
      )
      .populate("assignedUsers")
      .lean<IWarehouse>(); // ← FIX
  },

  async removeUser(id: string, userId: string) {
    return base.model
      .findByIdAndUpdate(
        id,
        { $pull: { assignedUsers: userId } },
        { new: true }
      )
      .populate("assignedUsers")
      .lean<IWarehouse>(); // ← FIX
  },

  async listUsers(id: string) {
    const wh = await base.model
      .findById(id)
      .populate("assignedUsers")
      .lean<IWarehouse | null>(); // ← FIX

    return wh?.assignedUsers ?? [];
  },
};
