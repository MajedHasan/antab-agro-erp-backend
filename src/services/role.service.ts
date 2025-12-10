// services/role.service.ts
import RoleModel from "../models/role.model";
import { createCrudService } from "./crud.service";

export const roleService = createCrudService(RoleModel, {
  defaultPopulate: "permissions",
});
