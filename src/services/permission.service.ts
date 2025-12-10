import PermissionModel from "../models/permission.model";
import roleModel from "../models/role.model";
import { createCrudService } from "./crud.service";

const base = createCrudService(PermissionModel, {
  searchFields: ["name", "description"],
  softDeleteField: "deletedAt",
  allowedFilterFields: ["name", "description"],
  defaultLimit: 15,
  lean: true,
  beforeCreate: async (payload) => {
    // example: lower-case email
    if (payload.permission)
      payload.permission = payload.permission.toLowerCase();
    return payload;
  },
  async beforeDelete(id, session) {
    await roleModel.updateMany(
      { permissions: id },
      { $pull: { permissions: id } },
      { session }
    );
  },
});

export const permissionService = {
  ...base,
};
