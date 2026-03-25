import { createCrudService } from "./crud.service";
import SalesReturn from "../models/sales-return.model";
import { Types } from "mongoose";

const base = createCrudService(SalesReturn, {
  searchFields: ["returnNo"],
  allowedFilterFields: ["status", "customerId"],
  defaultPopulate: [
    { path: "orderId", select: "orderNo" },
    { path: "customerId", select: "name phone" },
  ],
});

export const salesReturnService = {
  ...base,

  async approve(returnId: string, role: string, userId: string) {
    const statusMap: any = {
      "A.M": "A.M_CONFIRMED",
      "R.M": "R.M_CONFIRMED",
      "N.S.M": "N.S.M_CONFIRMED",
    };

    if (!statusMap[role]) {
      throw new Error("Invalid approval role");
    }

    return SalesReturn.findByIdAndUpdate(
      returnId,
      {
        status: statusMap[role],
        $push: {
          approvalLogs: {
            role,
            userId: new Types.ObjectId(userId),
            status: "APPROVED",
            actionDate: new Date(),
          },
        },
      },
      { new: true },
    );
  },

  async complete(returnId: string) {
    return base.update(returnId, {
      status: "COMPLETED",
      warehouseReceived: true,
    });
  },
};
