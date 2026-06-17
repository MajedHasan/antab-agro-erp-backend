import { Types } from "mongoose";
import salesOrderModel from "../../models/sales-order.model";
import CollectionModel from "../collection/collection.model"; // <-- add import

const formatCompactNumber = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) return "0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const num = abs / 1_000_000;
    return `${sign}${num.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    const num = abs / 1_000;
    return `${sign}${num.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${value}`;
};

export const moDashboardReportService = {
  async getMoDashboardReport(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1) Sales aggregation (unchanged)
    const [salesResult] = await salesOrderModel.aggregate([
      { $match: { createdBy: userObjectId, isActive: true } },
      {
        $facet: {
          todaysSales: [
            { $match: { createdAt: { $gte: startOfToday, $lt: endOfToday } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ],
          thisMonthSales: [
            { $match: { createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$grandTotal" } } },
          ],
        },
      },
    ]);

    // 2) Collection aggregation – based on workflowLogs.by (the submitter)
    const [collectionResult] = await CollectionModel.aggregate([
      {
        $match: {
          "workflowLogs.action": "SUBMITTED",
          "workflowLogs.by": userObjectId,
        },
      },
      {
        $facet: {
          todaysCollections: [
            {
              $match: {
                "workflowLogs.at": { $gte: startOfToday, $lt: endOfToday },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$summary.totalMRAmount" },
              },
            },
          ],
          thisMonthCollections: [
            {
              $match: {
                "workflowLogs.at": { $gte: startOfMonth },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$summary.totalMRAmount" },
              },
            },
          ],
        },
      },
    ]);

    const todaysSales = salesResult?.todaysSales?.[0]?.total ?? 0;
    const thisMonthSales = salesResult?.thisMonthSales?.[0]?.total ?? 0;
    const todaysCollections =
      collectionResult?.todaysCollections?.[0]?.total ?? 0;
    const thisMonthCollections =
      collectionResult?.thisMonthCollections?.[0]?.total ?? 0;

    return {
      todaysSales: formatCompactNumber(todaysSales),
      thisMonthSales: formatCompactNumber(thisMonthSales),
      todaysCollections: formatCompactNumber(todaysCollections),
      thisMonthCollections: formatCompactNumber(thisMonthCollections),
    };
  },
};
