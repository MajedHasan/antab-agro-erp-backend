import { createCrudService } from "./crud.service";
import WarehouseModel from "../models/warehouseOrFactory.model";
import { IWarehouseOrFactory } from "../models/warehouseOrFactory.model";

const base = createCrudService(WarehouseModel, {
  defaultPopulate: ["assignedUsers"],
  searchFields: ["name", "code", "address", "status"],
  allowedFilterFields: ["assignedUsers", "status", "type"],
});

export const warehouseOrFactoryService = {
  ...base,

  async assignUsers(id: string, userIds: string[]) {
    return base.model
      .findByIdAndUpdate(
        id,
        { $addToSet: { assignedUsers: { $each: userIds } } },
        { new: true }
      )
      .populate("assignedUsers")
      .lean<IWarehouseOrFactory>(); // ← FIX
  },

  async removeUser(id: string, userId: string) {
    return base.model
      .findByIdAndUpdate(
        id,
        { $pull: { assignedUsers: userId } },
        { new: true }
      )
      .populate("assignedUsers")
      .lean<IWarehouseOrFactory>(); // ← FIX
  },

  async listUsers(id: string) {
    const wh = await base.model
      .findById(id)
      .populate("assignedUsers")
      .lean<IWarehouseOrFactory | null>(); // ← FIX

    return wh?.assignedUsers ?? [];
  },
};
