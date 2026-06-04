import { createCrudService } from "./crud.service";
import WarehouseModel from "../models/warehouseOrFactory.model";
import { IWarehouseOrFactory } from "../models/warehouseOrFactory.model";

const base = createCrudService(WarehouseModel, {
  // ✅ deep populate instead of simple string fields
  defaultPopulate: [
    { path: "assignedUsers" },

    {
      path: "address.zone",
      model: "Zone",
    },
    {
      path: "address.region",
      model: "Region",
    },
    {
      path: "address.areas",
      model: "Area",
    },
    {
      path: "address.territories",
      model: "Territory",
    },
  ],

  // ❌ remove "address" (was string before)
  searchFields: ["name", "code", "status"],

  allowedFilterFields: [
    "assignedUsers",
    "status",
    "type",
    "address.zone",
    "address.region",
    "address.areas",
    "address.territories",
  ],
});

export const warehouseOrFactoryService = {
  ...base,

  // ✅ assign users
  async assignUsers(id: string, userIds: string[]) {
    return base.model
      .findByIdAndUpdate(
        id,
        { $addToSet: { assignedUsers: { $each: userIds } } },
        { new: true },
      )
      .populate([
        "assignedUsers",
        { path: "address.zone" },
        { path: "address.region" },
        { path: "address.areas" },
        { path: "address.territories" },
      ])
      .lean<IWarehouseOrFactory>();
  },

  // ✅ remove user
  async removeUser(id: string, userId: string) {
    return base.model
      .findByIdAndUpdate(
        id,
        { $pull: { assignedUsers: userId } },
        { new: true },
      )
      .populate([
        "assignedUsers",
        { path: "address.zone" },
        { path: "address.region" },
        { path: "address.areas" },
        { path: "address.territories" },
      ])
      .lean<IWarehouseOrFactory>();
  },

  // ✅ list users
  async listUsers(id: string) {
    const wh = await base.model
      .findById(id)
      .populate("assignedUsers")
      .lean<IWarehouseOrFactory | null>();

    return wh?.assignedUsers ?? [];
  },

  // ✅ OPTIONAL: helper to get full address populated
  async getWithAddress(id: string) {
    return base.model
      .findById(id)
      .populate([
        { path: "address.zone" },
        { path: "address.region" },
        { path: "address.areas" },
        { path: "address.territories" },
      ])
      .lean<IWarehouseOrFactory | null>();
  },
};
