// src/services/gr.service.ts
import { createCrudService } from "./crud.service";
import GRModel from "../models/good-receipt.model";
import { Account } from "../models/account.model";
import { mediaService } from "./media.service";

const base = createCrudService(GRModel, {
  softDeleteField: "deletedAt",
  defaultPopulate: ["workOrderId", "createdBy", "approvedBy", "attachments"],
  searchFields: ["grNo", "status"],
  allowedFilterFields: ["workOrderId", "status", "supplier", "issueDate"],
});

export const grService = {
  ...base,

  /* =====================================================
     CREATE GR
     - Prevent creating GR if receivedQty >= work order qty
  ====================================================== */
  async create(payload: any, opts: { session?: any } = {}) {
    const session = opts.session;

    const WorkOrderModel = (await import("../models/workorder.model")).default;
    const workOrder = await WorkOrderModel.findById(payload.workOrderId)
      .populate("items.itemId")
      .lean();
    if (!workOrder) throw new Error("Work Order not found");

    // Prepare a map of payload items by workOrderItemId
    const payloadMap = new Map<string, number>();
    for (const item of payload.items) {
      if (!item.workOrderItemId)
        throw new Error(`Item ${item.itemId} missing workOrderItemId`);
      payloadMap.set(
        String(item.workOrderItemId),
        Number(item.receivedQty || 0),
      );
    }

    // MongoDB aggregation: sum already received quantities per workOrderItemId
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
      receivedMap.set(String(r._id), r.totalReceived);
    }

    // Validate each payload item
    for (const woItem of workOrder.items) {
      const receivedAlready = receivedMap.get(String(woItem._id)) || 0;
      const toReceive = payloadMap.get(String(woItem._id)) || 0;
      const totalAfterThisGR = receivedAlready + toReceive;

      if (totalAfterThisGR > Number(woItem.quantity || 0)) {
        // Use name or itemCode if available, fallback to ID
        const displayName =
          woItem.itemId?.name ||
          woItem.itemName ||
          woItem.itemCode ||
          woItem._id;

        throw new Error(
          `Cannot receive ${toReceive} for item ${displayName}. Already received: ${receivedAlready}, Work Order quantity: ${woItem.quantity}`,
        );
      }
    }

    // ✅ Everything ok, create GR
    return base.create(payload, { session });
  },

  /* =====================================================
     APPROVE GR
     - Increase stock
     - Update Work Order receivedQuantity
     - Create accounting vouchers:
        • Inventory (Journal) — debits inventory, credits supplier (unit price only)
        • Transport (CashPayment) — if transportCost entered and marked Factory,
          debits Freight Inward (per product) and credits Cash In Factory
  ====================================================== */
  async approve(grId: string, userId: string) {
    return base.withTransaction(async (session) => {
      /* =====================================================
       1️⃣ LOCK & FETCH GR
    ====================================================== */
      const gr = await base.model
        .findOne({ _id: grId, status: "Pending" })
        .session(session)
        .populate("supplier workOrderId")
        .lean(false); // need document for saving

      if (!gr) throw new Error("GR not found or already processed");
      if (!gr.items || gr.items.length === 0)
        throw new Error("GR contains no items");

      /* =====================================================
       2️⃣ POPULATE ITEM REFERENCES
    ====================================================== */
      await gr.populate("items.itemId");

      /* =====================================================
       3️⃣ ACCOUNTING SERVICES
    ====================================================== */
      const { accountService } = await import("./account.service");
      const { voucherService } = await import("./voucher.service");

      /* =====================================================
       4️⃣ ENSURE SUPPLIER ACCOUNT
    ====================================================== */
      const supplierRef: any = gr.supplier;
      const supplierAccount = await accountService.createAutoAccountForEntity({
        entityType: "Supplier",
        entityId: supplierRef.toString(),
        name:
          (supplierRef as any)?.supplierName ||
          (supplierRef as any)?.name ||
          "Supplier",
      });

      /* =====================================================
       5️⃣ BUILD INVENTORY VOUCHER LINES
    ====================================================== */
      const invLines: any[] = [];
      let inventoryTotal = 0;

      for (const item of gr.items) {
        const itemDoc: any = item.itemId;
        const itemName = itemDoc?.name || "Item";
        const productCategory =
          item.itemType === "RawMaterial"
            ? "Raw"
            : item.itemType === "PackagingItem"
              ? "Packaging"
              : item.itemType === "FinishedProduct"
                ? "Finished"
                : "Other";

        // Use new helper: Assets -> Inventory -> category -> product
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
            itemName,
          ],
          "Asset",
          { session },
        );

        const lineAmount =
          Number(item.receivedQty || 0) * Number(item.unitPrice || 0);
        inventoryTotal += lineAmount;

        invLines.push({
          accountId: itemAccount._id,
          debit: lineAmount,
          credit: 0,
          narration: `Inventory from GR ${gr.grNo}`,
        });
      }

      // Credit supplier
      invLines.push({
        accountId: supplierAccount._id,
        debit: 0,
        credit: inventoryTotal,
        narration: `Payable for GR ${gr.grNo}`,
      });

      /* =====================================================
       6️⃣ CREATE & APPROVE INVENTORY VOUCHER
    ====================================================== */
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

      /* =====================================================
       7️⃣ TRANSPORT COST (Factory-paid)
       Uses getAccountByPath to simplify hierarchy
    ====================================================== */
      const transportLines: any[] = [];
      const transportItemsIndex: number[] = [];

      const freightParentAcc = await accountService.getAccountByPath(
        ["Expense", "Cost Of Goods Sold", "Freight Inward"],
        "Expense",
        { session },
      );

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
        const tsource = item.transportPaymentSource || "Pending";

        if (tcost > 0 && tsource === "Factory") {
          const itemName =
            (item.itemId as any)?.name || `Item-${String(item.itemId)}`;

          // Create/find freight product account under Freight Inward
          const freightProdAcc = await accountService.getAccountByPath(
            ["Expense", "Cost Of Goods Sold", "Freight Inward", itemName],
            "Expense",
            { session },
          );

          transportLines.push({
            accountId: freightProdAcc._id,
            debit: tcost,
            credit: 0,
            narration: `Freight for ${itemName} - GR ${gr.grNo}`,
          });

          transportItemsIndex.push(idx);
        }
      }

      // If any factory-paid lines, create CashPayment voucher
      if (transportLines.length > 0) {
        const transportTotal = transportLines.reduce(
          (s, l) => s + Number(l.debit || 0),
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

      /* =====================================================
       8️⃣ UPDATE STOCK (unchanged)
    ====================================================== */
      // const factoryId =
      //   gr.warehouseOrFactory || gr.workOrderId?.warehouseOrFactory;
      // const { RawMaterialStock } = await import("../models/rawMaterials.model");
      // const { PackagingStock } = await import("../models/packagingItems.model");
      // const ProductStock = await import("../models/productStock.model");

      // for (const item of gr.items) {
      //   const StockModel =
      //     item.itemType === "RawMaterial"
      //       ? RawMaterialStock
      //       : item.itemType === "PackingItem"
      //         ? PackagingStock
      //         : item.itemType === "FinishedItem"
      //           ? ProductStock
      //           : ProductStock;
      //   const idField =
      //     item.itemType === "RawMaterial" ? "rawMaterialId" : "packagingItemId";

      //   await StockModel.findOneAndUpdate(
      //     { [idField]: item.itemId, factoryId },
      //     {
      //       $inc: { quantity: item.receivedQty },
      //       $setOnInsert: { unit: item.unit },
      //     },
      //     { upsert: true, session },
      //   );
      // }

      /* =====================================================
   8️⃣ UPDATE STOCK (FINAL FIXED VERSION)
  ===================================================== */

      const factoryId =
        gr.warehouseOrFactory || gr.workOrderId?.warehouseOrFactory;

      if (!factoryId) {
        throw new Error("Factory/Warehouse not found for GR");
      }

      // ✅ Import models correctly
      const { RawMaterialStock } = await import("../models/rawMaterials.model");
      const { PackagingStock } = await import("../models/packagingItems.model");
      const { OtherProductStock } =
        await import("../models/otherProducts.model");
      const ProductStock = (await import("../models/productStock.model"))
        .default;

      // ✅ Resolver (STRICT & SAFE)
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
            return {
              model: ProductStock,
              idField: "productId",
              locationField: "warehouseId",
            };

          case "OtherProduct":
            return {
              model: OtherProductStock,
              idField: "otherProductId", // ⚠️ keep as is (your schema)
              locationField: "factoryId",
            };

          default:
            throw new Error(`Unsupported item type: ${type}`);
        }
      };

      // ✅ Update stock
      for (const item of gr.items) {
        if (!item.itemId) {
          throw new Error("GR item missing itemId");
        }

        const {
          model: StockModel,
          idField,
          locationField,
        } = resolveStockConfig(item.itemType);

        const query: any = {
          [idField]: item.itemId,
          [locationField]: factoryId,
        };

        const update: any = {
          $inc: {
            quantity: Number(item.receivedQty || 0),
          },
          $set: {
            lastUpdated: new Date(),
          },
          $setOnInsert: {
            unit: item.unit,
            [idField]: item.itemId,
            [locationField]: factoryId,
          },
        };

        await StockModel.findOneAndUpdate(query, update, {
          upsert: true,
          new: true,
          session,
        });
      }

      /* =====================================================
       9️⃣ UPDATE WORK ORDER PROGRESS (unchanged)
    ====================================================== */
      if (gr.workOrderId) {
        const WorkOrderModel = (await import("../models/workorder.model"))
          .default;
        const workOrder = await WorkOrderModel.findById(
          gr.workOrderId._id,
        ).session(session);
        if (!workOrder) throw new Error("Work Order not found");

        const allGRs = await base.model
          .find({ workOrderId: workOrder._id, status: { $ne: "Rejected" } })
          .session(session)
          .lean();
        const combinedGRs = [...allGRs];
        if (!combinedGRs.find((g) => String(g._id) === String(gr._id))) {
          combinedGRs.push({ ...gr.toObject(), status: "Approved" });
        }

        const receivedMap: Record<string, number> = {};
        for (const g of combinedGRs) {
          for (const it of g.items) {
            const key = String(it.itemId);
            receivedMap[key] =
              (receivedMap[key] || 0) + Number(it.receivedQty || 0);
          }
        }

        let totalOrdered = 0,
          totalReceived = 0;
        for (const woItem of workOrder.items) {
          const ordered = Number(woItem.quantity || 0);
          const received = receivedMap[String(woItem.itemId)] || 0;
          woItem.receivedQty = received;
          woItem.progress = ordered > 0 ? (received / ordered) * 100 : 0;
          totalOrdered += ordered;
          totalReceived += received;
        }

        workOrder.receivedQuantity = totalReceived;
        workOrder.progress =
          totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;

        workOrder.status =
          totalReceived >= totalOrdered && totalOrdered > 0
            ? "Completed"
            : totalReceived > 0
              ? "Approved"
              : workOrder.status;

        await workOrder.save({ session });
      }

      /* =====================================================
       🔟 FINALIZE GR
    ====================================================== */
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
