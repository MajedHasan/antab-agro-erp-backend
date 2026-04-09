import { createCrudService } from "./crud.service";
import GRModel from "../models/good-receipt.model";

const base = createCrudService(GRModel, {
  softDeleteField: "deletedAt",
  defaultPopulate: ["workOrderId", "createdBy", "approvedBy", "attachments"],
  searchFields: ["grNo", "status"],
  allowedFilterFields: ["workOrderId", "status", "supplier", "issueDate"],
});

export const grService = {
  ...base,

  /* =====================================================
     CREATE GR WITH UNIT CONVERSION
  ====================================================== */
  /* =====================================================
   CREATE GR WITH UNIT CONVERSION + 10% TOLERANCE
===================================================== */
  async create(payload: any, opts: { session?: any } = {}) {
    const session = opts.session;
    const WorkOrderModel = (await import("../models/workorder.model")).default;

    if (!payload?.workOrderId) {
      throw new Error("workOrderId is required");
    }

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new Error("At least one GR item is required");
    }

    const workOrder = await WorkOrderModel.findById(payload.workOrderId)
      .populate("items.itemId")
      .lean();

    if (!workOrder) throw new Error("Work Order not found");

    const payloadMap = new Map<string, any>();
    for (const item of payload.items) {
      if (!item.workOrderItemId) {
        throw new Error(`Item ${item.itemId || ""} missing workOrderItemId`);
      }
      payloadMap.set(String(item.workOrderItemId), item);
    }

    const receivedAggregates = await base.model.aggregate([
      { $match: { workOrderId: workOrder._id, status: { $ne: "Rejected" } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.workOrderItemId",
          totalReceived: { $sum: "$items.receivedQty" },
        },
      },
    ]);

    const receivedMap = new Map<string, number>();
    for (const r of receivedAggregates) {
      receivedMap.set(String(r._id), Number(r.totalReceived) || 0);
    }

    for (const woItem of workOrder.items || []) {
      const payloadItem = payloadMap.get(String(woItem._id));
      if (!payloadItem) continue;

      const itemDoc: any = woItem.itemId;
      const itemName =
        itemDoc?.name || woItem.itemName || woItem.name || "Item";

      const woQty = Number(woItem.quantity || 0);
      const receivedAlready = receivedMap.get(String(woItem._id)) || 0;
      const receivedNow = Number(payloadItem.receivedQty || 0);

      // ✅ SKIP items with 0 qty
      if (receivedNow <= 0) {
        payloadItem.inventoryQty = 0;
        payloadItem.convertedQty = 0;
        continue;
      }

      // ✅ CHECK: at least one item must have quantity > 0
      const hasAtLeastOneQty = payload.items.some(
        (it: any) => Number(it.receivedQty || 0) > 0,
      );

      if (!hasAtLeastOneQty) {
        throw new Error(
          "At least one item must have received quantity greater than 0",
        );
      }

      const maxAllowed = woQty * 1.1;
      const totalAfter = receivedAlready + receivedNow;

      console.log("Total After: ", totalAfter, "maxAllowed: ", maxAllowed);

      if (totalAfter > maxAllowed) {
        throw new Error(
          `Cannot receive ${receivedNow} for ${itemName}. Allowed with 10% tolerance: ${maxAllowed}. Already received: ${receivedAlready}. Work Order quantity: ${woQty}`,
        );
      }

      const woUnit = String(
        payloadItem.workOrderUnit || woItem.unit || "",
      ).trim();
      const invUnit = String(
        payloadItem.inventoryUnit || itemDoc?.unit || payloadItem.unit || "",
      ).trim();

      let conversionFactor = Number(payloadItem.conversionFactor || 1);

      if (woUnit && invUnit && woUnit.toUpperCase() !== invUnit.toUpperCase()) {
        if (!conversionFactor || conversionFactor <= 0) {
          throw new Error(
            `Conversion factor required for ${itemName} (${woUnit} → ${invUnit})`,
          );
        }
      } else {
        conversionFactor = 1;
      }

      const inventoryQty =
        payloadItem.inventoryQty !== undefined &&
        Number(payloadItem.inventoryQty) > 0
          ? Number(payloadItem.inventoryQty)
          : receivedNow * conversionFactor;

      const unitPrice = Number(
        payloadItem.unitPrice > 0
          ? payloadItem.unitPrice
          : woItem.unitPrice || itemDoc?.unitPrice || 0,
      );

      payloadItem.receivedQty = receivedNow;
      payloadItem.inventoryQty = inventoryQty;
      payloadItem.convertedQty = inventoryQty; // backward compatibility
      payloadItem.conversionFactor = conversionFactor;
      payloadItem.workOrderUnit = woUnit;
      payloadItem.inventoryUnit = invUnit;
      payloadItem.unit = invUnit || woUnit;
      payloadItem.unitPrice = unitPrice;

      if (Number(payloadItem.transportCost || 0) > 0) {
        payloadItem.transportPaymentSource =
          payloadItem.transportPaymentSource || "Factory";
      } else {
        payloadItem.transportPaymentSource = "Pending";
      }
    }

    return base.create(payload, { session });
  },

  /* =====================================================
     APPROVE GR WITH STOCK & VOUCHER UPDATES
  ====================================================== */
  /* =====================================================
   APPROVE GR WITH STOCK & VOUCHER UPDATES
  ====================================================== */
  async approve(grId: string, userId: string) {
    return base.withTransaction(async (session) => {
      const gr = await base.model
        .findOne({ _id: grId, status: "Pending" })
        .session(session)
        .populate("supplier workOrderId")
        .lean(false);

      if (!gr) throw new Error("GR not found or already processed");
      if (!gr.items || gr.items.length === 0) {
        throw new Error("GR contains no items");
      }

      await gr.populate("items.itemId");

      const { accountService } = await import("./account.service");
      const { voucherService } = await import("./voucher.service");

      const getWoQty = (item: any) => Number(item.receivedQty || 0);

      const getInventoryQty = (item: any) => {
        const invQty = Number(item.inventoryQty || 0);
        if (invQty > 0) return invQty;

        const convQty = Number(item.convertedQty || 0);
        if (convQty > 0) return convQty;

        return (
          Number(item.receivedQty || 0) * Number(item.conversionFactor || 1)
        );
      };

      const supplierId = String((gr.supplier as any)?._id || gr.supplier);
      const supplierName =
        (gr.supplier as any)?.supplierName ||
        (gr.supplier as any)?.name ||
        "Supplier";

      const supplierAccount = await accountService.createAutoAccountForEntity({
        entityType: "Supplier",
        entityId: supplierId,
        name: supplierName,
      });

      const invLines: any[] = [];
      let inventoryTotal = 0;

      for (const item of gr.items) {
        const itemDoc: any = item.itemId;

        const productCategory =
          item.itemType === "RawMaterial"
            ? "Raw"
            : item.itemType === "PackagingItem"
              ? "Packaging"
              : item.itemType === "FinishedProduct" ||
                  item.itemType === "Product"
                ? "Finished"
                : "Other";

        const itemAccount = await accountService.getAccountByPath(
          [
            "Assets",
            "Current Assets",
            "Inventory",
            productCategory === "Raw"
              ? "Raw Materials"
              : productCategory === "Packaging"
                ? "Packaging Materials"
                : productCategory === "Finished"
                  ? "Finished Product"
                  : "Other Product",
            itemDoc?.name || "Item",
          ],
          "Asset",
          { session },
        );

        const woQty = getWoQty(item);
        const lineAmount = woQty * Number(item.unitPrice || 0);
        inventoryTotal += lineAmount;

        invLines.push({
          accountId: itemAccount._id,
          debit: lineAmount,
          credit: 0,
          narration: `Inventory from GR ${gr.grNo}`,
        });
      }

      invLines.push({
        accountId: supplierAccount._id,
        debit: 0,
        credit: inventoryTotal,
        narration: `Payable for GR ${gr.grNo}`,
      });

      const invVoucher = await voucherService.create({
        voucherNo: `GR-${gr.grNo}-${Date.now()}`,
        date: gr.issueDate || new Date(),
        type: "Journal",
        reference: gr.grNo,
        narration: `GR Approval - ${gr.grNo} (Inventory)`,
        source: gr._id,
        sourceModel: "GoodsReceipt",
        lines: invLines,
        createdBy: userId,
      });

      await voucherService.approve(invVoucher._id.toString(), userId);

      const transportLines: any[] = [];
      const transportItemsIndex: number[] = [];

      const cashInFactoryAcc = await accountService.getAccountByPath(
        [
          "Assets",
          "Current Assets",
          "Cash & Cash Equivalents",
          "Cash In Hand",
          "Cash In Factory",
        ],
        "Asset",
        { session },
      );

      for (let idx = 0; idx < gr.items.length; idx++) {
        const item = gr.items[idx];
        const tcost = Number(item.transportCost || 0);

        if (tcost > 0 && item.transportPaymentSource === "Factory") {
          const freightAcc = await accountService.getAccountByPath(
            [
              "Expense",
              "Cost Of Goods Sold",
              "Freight Inward",
              (item.itemId as any)?.name || "Item",
            ],
            "Expense",
            { session },
          );

          transportLines.push({
            accountId: freightAcc._id,
            debit: tcost,
            credit: 0,
            narration: `Freight for ${item.itemId} - GR ${gr.grNo}`,
          });

          transportItemsIndex.push(idx);
        }
      }

      if (transportLines.length > 0) {
        const transportTotal = transportLines.reduce(
          (sum, line) => sum + Number(line.debit || 0),
          0,
        );

        transportLines.push({
          accountId: cashInFactoryAcc._id,
          debit: 0,
          credit: transportTotal,
          narration: `Freight payment (Factory) - GR ${gr.grNo}`,
        });

        const transportVoucher = await voucherService.create({
          voucherNo: `GR-TR-${gr.grNo}-${Date.now()}`,
          date: gr.issueDate || new Date(),
          type: "CashPayment",
          reference: gr.grNo,
          narration: `Freight Payment - ${gr.grNo}`,
          source: gr._id,
          sourceModel: "GoodsReceipt",
          lines: transportLines,
          createdBy: userId,
        });

        await voucherService.approve(transportVoucher._id.toString(), userId);

        for (const idx of transportItemsIndex) {
          gr.items[idx].transportVoucherId = transportVoucher._id;
          gr.items[idx].transportPaymentSource = "Factory";
        }
      }

      const locationId = gr.warehouseOrFactory?._id || gr.warehouseOrFactory;
      if (!locationId) throw new Error("GR warehouse/factory is required");

      const { RawMaterialStock } = await import("../models/rawMaterials.model");
      const { PackagingStock } = await import("../models/packagingItems.model");
      const { OtherProductStock } =
        await import("../models/otherProducts.model");
      const ProductStock = (await import("../models/productStock.model"))
        .default;

      const resolveStockConfig = (type: string) => {
        switch (type) {
          case "RawMaterial":
            return {
              model: RawMaterialStock,
              idField: "rawMaterialId",
              locationField: "factoryId",
            };
          case "PackagingItem":
            return {
              model: PackagingStock,
              idField: "packagingItemId",
              locationField: "factoryId",
            };
          case "FinishedProduct":
          case "Product":
            return {
              model: ProductStock,
              idField: "productId",
              locationField: "warehouseId",
            };
          case "OtherProduct":
          case "OtherProducts":
            return {
              model: OtherProductStock,
              idField: "otherProductId",
              locationField: "factoryId",
            };
          default:
            throw new Error(`Unsupported item type: ${type}`);
        }
      };

      for (const item of gr.items) {
        if (!item.itemId) throw new Error("GR item missing itemId");

        const {
          model: StockModel,
          idField,
          locationField,
        } = resolveStockConfig(item.itemType);

        const qty = getInventoryQty(item);
        if (qty <= 0) continue;

        await StockModel.findOneAndUpdate(
          { [idField]: item.itemId, [locationField]: locationId },
          {
            $inc: { quantity: qty },
            $set: { lastUpdated: new Date() },
            $setOnInsert: {
              unit: item.inventoryUnit || item.unit || item.workOrderUnit || "",
              [idField]: item.itemId,
              [locationField]: locationId,
            },
          },
          { upsert: true, new: true, session },
        );
      }

      if (gr.workOrderId) {
        const WorkOrderModel = (await import("../models/workorder.model"))
          .default;
        const workOrderId = gr.workOrderId?._id || gr.workOrderId;

        const workOrder =
          await WorkOrderModel.findById(workOrderId).session(session);

        if (!workOrder) throw new Error("Work Order not found");

        const allGRs = await base.model
          .find({ workOrderId, status: { $ne: "Rejected" } })
          .session(session)
          .lean();

        const combinedGRs = [...allGRs];
        if (!combinedGRs.find((g) => String(g._id) === String(gr._id))) {
          combinedGRs.push({ ...gr.toObject(), status: "Approved" });
        }

        const receivedMap: Record<string, number> = {};
        for (const g of combinedGRs) {
          for (const it of g.items || []) {
            const key = String(it.workOrderItemId || it.itemId);
            receivedMap[key] =
              (receivedMap[key] || 0) + Number(it.receivedQty || 0);
          }
        }

        let totalOrdered = 0;
        let totalReceived = 0;

        for (const woItem of workOrder.items || []) {
          const ordered = Number(woItem.quantity || 0);
          const received = receivedMap[String(woItem._id)] || 0;

          woItem.receivedQty = received;
          woItem.progress = ordered > 0 ? (received / ordered) * 100 : 0;

          totalOrdered += ordered;
          totalReceived += received;
        }

        workOrder.receivedQuantity = totalReceived;
        workOrder.progress =
          totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;

        workOrder.status =
          totalOrdered > 0 && totalReceived >= totalOrdered
            ? "Completed"
            : totalReceived > 0
              ? "Approved"
              : workOrder.status;

        await workOrder.save({ session });
      }

      gr.status = "Approved";
      gr.approvedBy = userId;
      gr.approvedAt = new Date();
      gr.voucherId = invVoucher._id;

      await gr.save({ session });
      return gr;
    });
  },

  /* =====================================================
     REJECT GR
     - Requires reason
  ====================================================== */
  async reject(grId: string, userId: string, reason: string) {
    const gr = await base.model.findById(grId);
    if (!gr) throw new Error("GR not found");

    if (gr.status === "Approved")
      throw new Error("Cannot reject an approved GR");

    gr.status = "Rejected";
    gr.rejectedBy = userId;
    gr.rejectedAt = new Date();
    gr.rejectionReason = reason;
    await gr.save();

    return gr;
  },

  /* =====================================================
     PAY GR
     - Multiple partial or full payments allowed
  ====================================================== */
  async pay(grId: string, amount: number, paidBy: string, paymentDate?: Date) {
    const gr = await base.model.findById(grId);
    if (!gr) throw new Error("GR not found");
    if (gr.status !== "Approved")
      throw new Error("Only approved GRs can be paid");

    if (!gr.payments) gr.payments = [];

    gr.payments.push({
      amount,
      paidBy,
      paymentDate: paymentDate || new Date(),
    });

    // Update paidAmount
    gr.paidAmount = (gr.paidAmount || 0) + amount;

    // Update status
    if (gr.paidAmount >= gr.grandTotal) {
      gr.paymentStatus = "Paid";
    } else if (gr.paidAmount > 0) {
      gr.paymentStatus = "Partial";
    } else {
      gr.paymentStatus = "Unpaid";
    }

    await gr.save();

    return gr;
  },

  /* =====================================================
     ATTACH FILE TO GR
  ====================================================== */
  async attachFile(grId: string, fileId: string) {
    const gr = await base.model.findById(grId);
    if (!gr) throw new Error("GR not found");

    if (!gr.attachments) gr.attachments = [];
    gr.attachments.push(fileId);

    await gr.save();
    return gr;
  },
};
