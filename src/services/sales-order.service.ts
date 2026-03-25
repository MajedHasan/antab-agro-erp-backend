// src/services/sales-order.service.ts
import { createCrudService } from "./crud.service";
import SalesOrder from "../models/sales-order.model";
import SalesInvoice from "../models/sales-invoice.model";
import ProductStock from "../models/productStock.model";
import { Types } from "mongoose";

const base = createCrudService(SalesOrder, {
  searchFields: ["orderNo"],
  allowedFilterFields: ["customerId", "status", "warehouseId"],
  defaultPopulate: [
    { path: "customerId", select: "name phone" },
    { path: "warehouseId", select: "name" },
    { path: "invoiceId" },
    {
      path: "items.productId",
      select: "name price image",
    },
    {
      path: "items.promotionId",
    },
  ],
});

/**
 * Helper: compute the total qty for an order item (including bonus)
 */
function itemTotalQty(item: any) {
  return (item.qty || 0) + (item.bonusQty || 0);
}

/**
 * Helper: compute available stock as per our rules
 * available = quantity + incomingTransfer - reservedForSales - reservedForTransfer
 */
function computeAvailable(stock: any) {
  const q = stock.quantity || 0;
  const incoming = stock.incomingTransfer || 0;
  const reservedSales = stock.reservedForSales || 0;
  const reservedTransfer = stock.reservedForTransfer || 0;
  return q + incoming - reservedSales - reservedTransfer;
}

/**
 * Reserve qty for a particular stock document instance (in-session)
 */
async function reserveOnStockInstance(
  stockDoc: any,
  qtyToReserve: number,
  session: any,
) {
  if (qtyToReserve === 0) return;
  const available = computeAvailable(stockDoc);
  if (available < qtyToReserve) {
    throw new Error("Not enough available stock to reserve");
  }
  stockDoc.reservedForSales = (stockDoc.reservedForSales || 0) + qtyToReserve;
  stockDoc.lastUpdated = new Date();
  await stockDoc.save({ session });
}

/**
 * Change reservation by delta (can be negative)
 */
async function changeReservationByDelta(
  stockDoc: any,
  delta: number,
  session: any,
) {
  if (delta === 0) return;
  if (delta > 0) {
    const available = computeAvailable(stockDoc);
    if (available < delta)
      throw new Error("Not enough available stock to increase reservation");
  }
  // apply
  stockDoc.reservedForSales = Math.max(
    0,
    (stockDoc.reservedForSales || 0) + delta,
  );
  stockDoc.lastUpdated = new Date();
  await stockDoc.save({ session });
}

/**
 * Release reservation (positive amount)
 */
async function releaseReservationOnStockInstance(
  stockDoc: any,
  qtyToRelease: number,
  session: any,
) {
  if (qtyToRelease === 0) return;
  stockDoc.reservedForSales = Math.max(
    0,
    (stockDoc.reservedForSales || 0) - qtyToRelease,
  );
  stockDoc.lastUpdated = new Date();
  await stockDoc.save({ session });
}

/**
 * Build a map key for items: productId|warehouseId
 */
function mkKey(productId: any, warehouseId: any) {
  return `${productId.toString()}|${warehouseId.toString()}`;
}

/**
 * Convert items array into map: key -> totalQty
 */
function itemsToQtyMap(items: any[]) {
  const m = new Map<string, number>();
  for (const it of items || []) {
    const key = mkKey(it.productId, it.warehouseId);
    const qty = itemTotalQty(it);
    m.set(key, (m.get(key) || 0) + qty);
  }
  return m;
}

/**
 * Main service
 */
export const salesOrderService = {
  ...base,

  /**
   * Create sales order and reserve stock for each item.
   * Runs inside a transaction.
   */
  async create(payload: any) {
    return base.withTransaction(async (session) => {
      // Create order document (uses base.create which honors session)
      const order = await base.create(payload, { session });

      // Reserve stock for each item
      for (const item of order.items) {
        const totalQty = itemTotalQty(item);

        const stock = await ProductStock.findOne({
          productId: item.productId,
          warehouseId: item.warehouseId,
        }).session(session);

        if (!stock) {
          throw new Error("Stock not found for product/warehouse");
        }

        await reserveOnStockInstance(stock, totalQty, session);
      }

      return order;
    });
  },

  /**
   * Update sales order (items may change) — adjust reservations accordingly.
   * Strategy:
   *  - compute old map and new map (product+warehouse as key)
   *  - for each key compute delta = new - old
   *  - if delta > 0 => check available and increase reservation
   *  - if delta < 0 => decrease reservation
   */
  async update(id: string, payload: any) {
    return base.withTransaction(async (session) => {
      const oldOrder = await SalesOrder.findById(id).session(session);
      if (!oldOrder) throw new Error("Order not found");

      const oldMap = itemsToQtyMap(oldOrder.items);
      const newMap = itemsToQtyMap(payload.items || []);

      // gather all keys
      const allKeys = new Set<string>([...oldMap.keys(), ...newMap.keys()]);

      // pre-check: for every key where delta > 0, ensure stock has enough available
      for (const key of allKeys) {
        const oldQty = oldMap.get(key) || 0;
        const newQty = newMap.get(key) || 0;
        const delta = newQty - oldQty;
        if (delta > 0) {
          // parse key
          const [prodId, whId] = key.split("|");
          const stock = await ProductStock.findOne({
            productId: new Types.ObjectId(prodId),
            warehouseId: new Types.ObjectId(whId),
          }).session(session);

          if (!stock) throw new Error("Stock not found while updating order");
          const available = computeAvailable(stock) + 0; // current available
          if (available < delta) {
            throw new Error(
              "Not enough stock available to increase reservation",
            );
          }
        }
      }

      // Apply deltas (safe because pre-check done)
      for (const key of allKeys) {
        const oldQty = oldMap.get(key) || 0;
        const newQty = newMap.get(key) || 0;
        const delta = newQty - oldQty; // may be +/-
        if (delta === 0) continue;

        const [prodId, whId] = key.split("|");
        const stock = await ProductStock.findOne({
          productId: new Types.ObjectId(prodId),
          warehouseId: new Types.ObjectId(whId),
        }).session(session);

        if (!stock)
          throw new Error("Stock not found while applying reservation delta");

        await changeReservationByDelta(stock, delta, session);
      }

      // Finally update the order document
      const updatedOrder = await base.update(id, payload, { session });

      return updatedOrder;
    });
  },

  /**
   * Approvals by roles (existing logic preserved) — only status/log update.
   * These approvals do not affect stock reservations directly (except
   * warehouse/delivery actions below).
   */
  async approve(orderId: string, role: string, userId: string) {
    const statusMap: Record<string, string> = {
      "M.O": "M.O_CONFIRMED",
      "A.M": "A.M_CONFIRMED",
      "R.M": "R.M_CONFIRMED",
      "N.S.M": "N.S.M_CONFIRMED",
      "A.C": "A.C_CONFIRMED",
    };

    if (!statusMap[role]) {
      throw new Error("Invalid approval role");
    }

    return SalesOrder.findByIdAndUpdate(
      orderId,
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

  /**
   * Warehouse Ship (warehouse approves / marks as shipped)
   * IMPORTANT: per your new requirement, this should NOT reduce physical stock.
   * It will:
   *  - create invoice
   *  - update order status to IN_SHIPPING
   *  - push WAREHOUSE approval log
   *
   * Reservations remain until DELIVERY finalization.
   */
  async ship(orderId: string, warehouseUserId: string) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      if (order.status === "DELIVERED") {
        throw new Error("Order already delivered");
      }

      // Create Invoice (do NOT touch stock here)
      const invoice = await SalesInvoice.create(
        [
          {
            invoiceNo: `INV-${Date.now()}`,
            orderId: order._id,
            customerId: order.customerId,
            warehouseId: order.warehouseId,
            items: order.items,
            subTotal: order.subTotal,
            totalDiscount: order.totalDiscount,
            totalTax: order.totalTax,
            grandTotal: order.grandTotal,
            totalBonusQty: order.totalBonusQty,
            paidAmount: 0,
            balanceAmount: order.grandTotal,
            paymentStatus: "UNPAID",
            status: "ACTIVE",
            createdBy: warehouseUserId,
          },
        ],
        { session },
      );

      // Update order
      order.status = "IN_SHIPPING";
      order.invoiceId = invoice[0]._id;
      order.isInvoiced = true;

      order.approvalLogs.push({
        role: "WAREHOUSE",
        userId: new Types.ObjectId(warehouseUserId),
        status: "APPROVED",
        actionDate: new Date(),
      });

      await order.save({ session });

      return {
        order,
        invoice: invoice[0],
      };
    });
  },

  /**
   * Delivery (final step) — physically reduce stock and release reservation.
   * This will:
   *  - check reservations and physical qty
   *  - decrement productStock.quantity by qty
   *  - decrement reservedForSales by qty
   *  - update invoice status (already created at ship)
   *  - mark order DELIVERED and add delivery log
   */
  async deliver(orderId: string, deliveryUserId: string) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId)
        .populate("invoiceId")
        .session(session);

      if (!order) throw new Error("Order not found");

      if (!order.invoiceId) {
        throw new Error("Invoice not created yet");
      }

      if (order.status === "DELIVERED") {
        throw new Error("Order already delivered");
      }

      // For each item: release reservedForSales and decrement physical quantity
      for (const item of order.items) {
        const totalQty = itemTotalQty(item);

        const stock = await ProductStock.findOne({
          productId: item.productId,
          warehouseId: item.warehouseId,
        }).session(session);

        if (!stock) throw new Error("Stock not found for delivery");

        // Check reserved integrity
        if ((stock.reservedForSales || 0) < totalQty) {
          throw new Error(
            "Reserved stock is less than order quantity — cannot deliver",
          );
        }

        // Check physical quantity
        if ((stock.quantity || 0) < totalQty) {
          throw new Error("Insufficient physical stock for delivery");
        }

        // reduce physical & reserved
        stock.quantity = (stock.quantity || 0) - totalQty;
        stock.reservedForSales = Math.max(
          0,
          (stock.reservedForSales || 0) - totalQty,
        );
        stock.lastUpdated = new Date();

        await stock.save({ session });
      }

      // Update Invoice (keep it ACTIVE; update metadata)
      await SalesInvoice.findByIdAndUpdate(
        order.invoiceId._id,
        {
          status: "ACTIVE",
          updatedBy: deliveryUserId,
        },
        { session },
      );

      // Update order
      order.status = "DELIVERED";
      order.deliveryManId = new Types.ObjectId(deliveryUserId);
      order.deliveryDate = new Date();

      order.approvalLogs.push({
        role: "DELIVERY",
        userId: new Types.ObjectId(deliveryUserId),
        status: "APPROVED",
        actionDate: new Date(),
      });

      await order.save({ session });

      return order;
    });
  },

  /**
   * Cancel order (release reservations)
   */
  async cancel(orderId: string, userId?: string) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      if (order.status === "DELIVERED") {
        throw new Error("Cannot cancel delivered order");
      }

      // Release reservations for every item
      for (const item of order.items) {
        const totalQty = itemTotalQty(item);
        const stock = await ProductStock.findOne({
          productId: item.productId,
          warehouseId: item.warehouseId,
        }).session(session);

        if (stock) {
          stock.reservedForSales = Math.max(
            0,
            (stock.reservedForSales || 0) - totalQty,
          );
          stock.lastUpdated = new Date();
          await stock.save({ session });
        }
      }

      // Update order status + approval log
      order.status = "CANCELLED";
      order.approvalLogs.push({
        role: "SYSTEM",
        userId: userId ? new Types.ObjectId(userId) : new Types.ObjectId(),
        status: "REJECTED",
        actionDate: new Date(),
        remarks: "Order cancelled and reservations released",
      });

      await order.save({ session });

      return order;
    });
  },

  /**
   * Find one wrapper (expose base.findOne if needed)
   */
  findOne: base.findOne,

  model: base.model,
};
