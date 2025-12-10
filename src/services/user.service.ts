import UserModel from "../models/user.model";
import { createCrudService } from "./crud.service";
import bcrypt from "bcrypt";

const base = createCrudService(UserModel, {
  defaultPopulate: "role",
  searchFields: ["name", "email"],
  softDeleteField: "deletedAt",
  allowedFilterFields: ["name", "email", "department", "isActive", "role"],
  defaultLimit: 15,
  lean: true,
  beforeCreate: async (payload) => {
    // example: lower-case email
    if (payload.password) {
      const hashed = await bcrypt.hash(payload.password, 10);
      payload.password = hashed;
    }
    if (payload.email) {
      payload.email = payload.email.toLowerCase();

      const userExist = await UserModel.findOne({ email: payload.email });

      if (userExist) {
        const error: any = new Error("Email already exists");
        error.statusCode = 409;
        throw error;
      }
    }
    return payload;
  },
  async beforeDelete(id, session) {
    // await PostModel.deleteMany({ userId: id }, { session });
    // await TaskModel.deleteMany({ assignedTo: id }, { session });
    // await FileModel.deleteMany({ owner: id }, { session });
  },
});

export const userService = {
  ...base,
  async findAdmins() {
    return base.model.find({ "role.name": "admin" });
  },
  async deactivateUser(id: string) {
    return base.update(id, { isActive: false });
  },
};
