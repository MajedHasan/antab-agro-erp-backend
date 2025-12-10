import WorkOrderModel from "../models/workorder.model";
import { createCrudService } from "./crud.service";

export const workOrderService = createCrudService(WorkOrderModel, {
  softDeleteField: "deletedAt",
  defaultPopulate: ["dealer", "warehouse", "createdBy", "approvedBy"],
  searchFields: ["workOrderNo", "status"],
  allowedFilterFields: ["dealer", "warehouse", "status", "issueDate"],

  beforeCreate: async (payload) => {
    // Example: auto-assign createdBy if needed
    return payload;
  },

  beforeUpdate: async (id, payload) => {
    return payload;
  },
});
