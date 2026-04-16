import { createCrudService } from "./crud.service";
import SalesOrder from "../models/sales-order.model";
import SalesInvoice from "../models/sales-invoice.model";
import ProductStock from "../models/productStock.model";
import { Types } from "mongoose";
import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import fs from "fs/promises";

type ApprovalRole = "A.M" | "R.M" | "N.S.M" | "FULFILLMENT" | "DELIVERY";
type OrderStatus =
  | "PENDING_AM"
  | "PENDING_RM"
  | "PENDING_NSM"
  | "PENDING_FULFILLMENT"
  | "IN_SHIPPING"
  | "DELIVERED"
  | "REJECTED"
  | "CANCELLED";

const SIGNATURE_SIMILARITY_THRESHOLD = 0.5;

const defaultPopulate = [
  {
    path: "customerId",
    select: "name phoneNumber type creditLimit currentDue attachments",
  },
  { path: "warehouseId", select: "name" },
  { path: "invoiceId" },
  { path: "items.productId", select: "name price image" },
  { path: "items.promotionId" },
];

const base = createCrudService(SalesOrder, {
  searchFields: ["orderNo"],
  allowedFilterFields: ["customerId", "status", "warehouseId", "paymentMethod"],
  defaultPopulate,
});

function firstLetter(s?: string) {
  if (!s || typeof s !== "string") return "X";
  const t = s.trim();
  return t.length ? t[0].toUpperCase() : "X";
}

function itemTotalQty(item: any) {
  return (item.qty || 0) + (item.bonusQty || 0);
}

function computeAvailable(stock: any) {
  const q = stock.quantity || 0;
  const incoming = stock.incomingTransfer || 0;
  const reservedSales = stock.reservedForSales || 0;
  const reservedTransfer = stock.reservedForTransfer || 0;
  return q + incoming - reservedSales - reservedTransfer;
}

function mkKey(productId: any, warehouseId: any) {
  return `${productId.toString()}|${warehouseId.toString()}`;
}

function itemsToQtyMap(items: any[]) {
  const m = new Map<string, number>();
  for (const it of items || []) {
    const key = mkKey(it.productId, it.warehouseId);
    const qty = itemTotalQty(it);
    m.set(key, (m.get(key) || 0) + qty);
  }
  return m;
}

function normalizeDhakaDateStamp(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
  })
    .format(date)
    .replace(/-/g, "");
}

function isSameObjectId(a: any, b: any) {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

function stripProtectedFields(payload: any) {
  const p = { ...payload };
  delete p.orderNo;
  delete p.status;
  delete p.approvalLogs;
  delete p.invoiceId;
  delete p.isInvoiced;
  delete p.deliveryManId;
  delete p.deliveryDate;
  delete p.createdAt;
  delete p.updatedAt;
  delete p.__v;
  return p;
}

function validateOrderItemsMatchWarehouse(items: any[], warehouseId: any) {
  for (const item of items || []) {
    if (!item.warehouseId) {
      throw new Error("Each item must have warehouseId");
    }
    if (!isSameObjectId(item.warehouseId, warehouseId)) {
      throw new Error("All order items must belong to the selected warehouse");
    }
  }
}

function ensureEditableOrderStatus(status: OrderStatus) {
  if (["IN_SHIPPING", "DELIVERED", "CANCELLED"].includes(status)) {
    throw new Error("Order can no longer be edited");
  }
}

async function getDealerById(customerId: any, session?: any) {
  const Dealer = SalesOrder.db.model("Dealer");
  let query = Dealer.findById(customerId);
  if (session) query = query.session(session);
  const dealer = await query;
  if (!dealer) throw new Error("Dealer not found");
  return dealer;
}

async function getDealerCreditInfo(customerId: any, session?: any) {
  const dealer = await getDealerById(customerId, session);

  const creditLimit = dealer.creditLimit || 0;
  const used = dealer.currentDue || 0;
  const available = creditLimit - used;

  return {
    dealer,
    creditLimit,
    used,
    available,
  };
}

async function generateOrderNo(payload: any, session: any) {
  const Dealer = SalesOrder.db.model("Dealer");
  const Warehouse = SalesOrder.db.model("WarehouseOrFactory");
  const Territory = SalesOrder.db.model("Territory");
  const Area = SalesOrder.db.model("Area");
  const Region = SalesOrder.db.model("Region");
  const Zone = SalesOrder.db.model("Zone");

  const dealer = await Dealer.findById(payload.customerId)
    .select("territory area region zone")
    .session(session)
    .lean();

  if (!dealer) throw new Error("Dealer not found");

  const [territory, area, region, zone, warehouse] = await Promise.all([
    dealer.territory
      ? Territory.findById(dealer.territory)
          .select("name")
          .session(session)
          .lean()
      : null,
    dealer.area
      ? Area.findById(dealer.area).select("name").session(session).lean()
      : null,
    dealer.region
      ? Region.findById(dealer.region).select("name").session(session).lean()
      : null,
    dealer.zone
      ? Zone.findById(dealer.zone).select("name").session(session).lean()
      : null,
    payload.warehouseId
      ? Warehouse.findById(payload.warehouseId)
          .select("name")
          .session(session)
          .lean()
      : null,
  ]);

  const prefix =
    firstLetter(territory?.name) +
    firstLetter(area?.name) +
    firstLetter(region?.name) +
    firstLetter(zone?.name) +
    firstLetter(warehouse?.name);

  const dateStamp = normalizeDhakaDateStamp();
  const regex = new RegExp(`^SO-${prefix}-${dateStamp}-(\\d{5})$`);

  const last = await SalesOrder.find({ orderNo: regex })
    .sort({ orderNo: -1 })
    .limit(1)
    .select("orderNo")
    .session(session)
    .lean();

  let next = 1;
  if (last.length) {
    const m = last[0].orderNo.match(regex);
    if (m?.[1]) next = parseInt(m[1], 10) + 1;
  }

  return `SO-${prefix}-${dateStamp}-${String(next).padStart(5, "0")}`;
}

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

async function changeReservationByDelta(
  stockDoc: any,
  delta: number,
  session: any,
) {
  if (delta === 0) return;

  if (delta > 0) {
    const available = computeAvailable(stockDoc);
    if (available < delta) {
      throw new Error("Not enough stock available to increase reservation");
    }
  }

  stockDoc.reservedForSales = Math.max(
    0,
    (stockDoc.reservedForSales || 0) + delta,
  );
  stockDoc.lastUpdated = new Date();
  await stockDoc.save({ session });
}

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

async function releaseAllReservations(order: any, session: any) {
  for (const item of order.items || []) {
    const totalQty = itemTotalQty(item);

    const stock = await ProductStock.findOne({
      productId: item.productId,
      warehouseId: item.warehouseId,
    }).session(session);

    if (stock) {
      await releaseReservationOnStockInstance(stock, totalQty, session);
    }
  }
}

async function readMediaBuffer(
  mediaId: string,
  session?: any,
): Promise<Buffer> {
  const Media = SalesOrder.db.model("Media");
  let query = Media.findById(mediaId);
  if (session) query = query.session(session);

  const media = await query;
  if (!media) throw new Error("Media file not found");

  const filePath: string | undefined =
    media.filePath || media.path || media.localPath || media.storagePath;

  if (!filePath) {
    throw new Error("Media file path is missing");
  }

  return fs.readFile(filePath);
}

async function getMediaFilePath(
  mediaId: string,
  session?: any,
): Promise<string> {
  const Media = SalesOrder.db.model("Media");
  let query = Media.findById(mediaId);
  if (session) query = query.session(session);

  const media = await query;
  if (!media) throw new Error("Media file not found");

  const filePath: string | undefined =
    media.filePath || media.path || media.localPath || media.storagePath;

  if (!filePath) {
    throw new Error("Media file path is missing");
  }

  return filePath;
}

async function generateQrImage(qrPayload: string): Promise<string> {
  return QRCode.toDataURL(qrPayload, {
    type: "image/png",
    margin: 2,
    width: 260,
    errorCorrectionLevel: "M",
  });
}

async function buildQrPayload(invoice: any, order: any) {
  return JSON.stringify({
    invoiceId: String(invoice._id),
    orderId: String(order._id),
    invoiceNo: String(invoice.invoiceNo),
    grandTotal: Number(invoice.grandTotal || 0),
  });
}

async function buildPrintableInvoiceData(
  order: any,
  invoice: any,
  dealer: any,
) {
  const qrCodeData = invoice?.qrCode || "";
  const qrCodeImage = await generateQrImage(qrCodeData);

  return {
    order,
    invoice,
    dealer,
    qrCodeData,
    qrCodeImage,
    dealerSignatureField: {
      label: "Dealer Signature",
      required: true,
    },
    dealerSignatureTemplateId:
      dealer?.attachments?.required?.signature?.toString?.() || null,
  };
}

async function extractQrPayloadFromBuffer(fileBuffer: Buffer): Promise<string> {
  const image = sharp(fileBuffer).ensureAlpha().greyscale();
  const { data, info } = await image
    .raw()
    .toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  if (!result?.data) {
    throw new Error("QR code not found in uploaded document");
  }
  return result.data;
}

async function extractSignatureCropBuffer(fileBuffer: Buffer): Promise<Buffer> {
  const meta = await sharp(fileBuffer).metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;

  if (!width || !height) {
    throw new Error("Unable to read uploaded document dimensions");
  }

  const left = Math.max(0, Math.floor(width * 0.56));
  const top = Math.max(0, Math.floor(height * 0.7));
  const cropWidth = Math.max(1, Math.floor(width * 0.38));
  const cropHeight = Math.max(1, Math.floor(height * 0.22));

  return sharp(fileBuffer)
    .extract({
      left,
      top,
      width: Math.min(cropWidth, width - left),
      height: Math.min(cropHeight, height - top),
    })
    .resize(520, 220, { fit: "fill" })
    .greyscale()
    .png()
    .toBuffer();
}

async function compareImageSimilarity(
  bufferA: Buffer,
  bufferB: Buffer,
): Promise<number> {
  const width = 520;
  const height = 220;

  const a = await sharp(bufferA)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const b = await sharp(bufferB)
    .resize(width, height, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer();

  const len = Math.min(a.length, b.length);
  if (!len) return 0;

  let diff = 0;
  for (let i = 0; i < len; i++) {
    diff += Math.abs(a[i] - b[i]) / 255;
  }

  const avgDiff = diff / len;
  return Math.max(0, 1 - avgDiff);
}

function isInvoiceCompletedStatus(status: string) {
  return ["DELIVERED", "CANCELLED"].includes(status);
}

export const salesOrderService = {
  ...base,

  async getCreditInfo(customerId: string) {
    return base.withTransaction(async (session) => {
      const info = await getDealerCreditInfo(customerId, session);
      return {
        dealerId: info.dealer._id,
        creditLimit: info.creditLimit,
        used: info.used,
        due: info.used,
        available: info.available,
      };
    });
  },

  async getPrintableInvoiceData(orderId: string) {
    const order = await SalesOrder.findById(orderId).populate(
      defaultPopulate as any,
    );
    if (!order) throw new Error("Order not found");
    if (!order.invoiceId) throw new Error("Invoice not created yet");

    const Invoice = SalesOrder.db.model("SalesInvoice");
    const Dealer = SalesOrder.db.model("Dealer");

    const invoiceId = (order.invoiceId as any)?._id || order.invoiceId;
    const customerId = (order.customerId as any)?._id || order.customerId;

    const [invoice, dealer] = await Promise.all([
      Invoice.findById(invoiceId),
      Dealer.findById(customerId).select("name proprietor attachments"),
    ]);

    if (!invoice) throw new Error("Invoice not found");
    if (!dealer) throw new Error("Dealer not found");

    return buildPrintableInvoiceData(order, invoice, dealer);
  },

  async create(payload: any) {
    return base.withTransaction(async (session) => {
      if (!payload.customerId) throw new Error("customerId is required");
      if (!payload.warehouseId) throw new Error("warehouseId is required");
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error("Order items are required");
      }
      if (!payload.paymentMethod) throw new Error("paymentMethod is required");

      validateOrderItemsMatchWarehouse(payload.items, payload.warehouseId);

      const dealerInfo = await getDealerCreditInfo(payload.customerId, session);
      const dealer = dealerInfo.dealer;

      if (dealer.status === "Blocked") {
        throw new Error("Dealer is blocked");
      }

      payload.orderNo = await generateOrderNo(payload, session);
      payload.status = "PENDING_AM";
      payload.isInvoiced = false;
      payload.invoiceId = undefined;
      payload.deliveryManId = undefined;
      payload.deliveryDate = undefined;

      if (payload.paymentMethod === "CREDIT") {
        if (dealer.type !== "CREDIT") {
          throw new Error("This dealer is not allowed for credit orders");
        }

        if ((dealer.creditLimit || 0) <= 0) {
          throw new Error("Dealer credit limit is not configured");
        }

        const used = dealer.currentDue || 0;
        const available = (dealer.creditLimit || 0) - used;

        if (available < payload.grandTotal) {
          throw new Error("Credit limit exceeded");
        }

        console.log("Used: ", used, "Available: ", available);

        payload.creditSnapshot = {
          creditLimit: dealer.creditLimit || 0,
          used,
          available,
        };

        // ✅ MOVE THIS FROM SHIP → CREATE
        dealer.currentDue = used + payload.grandTotal;
        await dealer.save({ session });
      } else {
        payload.creditSnapshot = undefined;
      }

      const order = await base.create(payload, { session });

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

  async update(id: string, payload: any) {
    return base.withTransaction(async (session) => {
      const oldOrder = await SalesOrder.findById(id).session(session);
      if (!oldOrder) throw new Error("Order not found");

      ensureEditableOrderStatus(oldOrder.status as OrderStatus);

      const cleanPayload = stripProtectedFields(payload);

      if (
        cleanPayload.customerId &&
        !isSameObjectId(cleanPayload.customerId, oldOrder.customerId)
      ) {
        throw new Error("customerId cannot be changed after order creation");
      }

      if (
        cleanPayload.warehouseId &&
        !isSameObjectId(cleanPayload.warehouseId, oldOrder.warehouseId)
      ) {
        throw new Error("warehouseId cannot be changed after order creation");
      }

      if (
        cleanPayload.paymentMethod &&
        cleanPayload.paymentMethod !== oldOrder.paymentMethod
      ) {
        throw new Error("paymentMethod cannot be changed after order creation");
      }

      const nextCustomerId = cleanPayload.customerId || oldOrder.customerId;
      const nextWarehouseId = cleanPayload.warehouseId || oldOrder.warehouseId;

      if (cleanPayload.items) {
        if (
          !Array.isArray(cleanPayload.items) ||
          cleanPayload.items.length === 0
        ) {
          throw new Error("Order items cannot be empty");
        }
        validateOrderItemsMatchWarehouse(cleanPayload.items, nextWarehouseId);
      }

      const oldMap = itemsToQtyMap(oldOrder.items);
      const newItems = cleanPayload.items || oldOrder.items;
      const newMap = itemsToQtyMap(newItems);

      const allKeys = new Set<string>([...oldMap.keys(), ...newMap.keys()]);

      for (const key of allKeys) {
        const oldQty = oldMap.get(key) || 0;
        const newQty = newMap.get(key) || 0;
        const delta = newQty - oldQty;

        if (delta > 0) {
          const [prodId, whId] = key.split("|");
          const stock = await ProductStock.findOne({
            productId: new Types.ObjectId(prodId),
            warehouseId: new Types.ObjectId(whId),
          }).session(session);

          if (!stock) throw new Error("Stock not found while updating order");

          const available = computeAvailable(stock);
          if (available < delta) {
            throw new Error(
              "Not enough stock available to increase reservation",
            );
          }
        }
      }

      for (const key of allKeys) {
        const oldQty = oldMap.get(key) || 0;
        const newQty = newMap.get(key) || 0;
        const delta = newQty - oldQty;
        if (delta === 0) continue;

        const [prodId, whId] = key.split("|");
        const stock = await ProductStock.findOne({
          productId: new Types.ObjectId(prodId),
          warehouseId: new Types.ObjectId(whId),
        }).session(session);

        if (!stock) {
          throw new Error("Stock not found while applying reservation delta");
        }

        await changeReservationByDelta(stock, delta, session);
      }

      if ((oldOrder.paymentMethod as string) === "CREDIT") {
        const dealerInfo = await getDealerCreditInfo(nextCustomerId, session);

        if (
          dealerInfo.available <
          (cleanPayload.grandTotal ?? oldOrder.grandTotal)
        ) {
          throw new Error("Credit limit exceeded after update");
        }

        cleanPayload.creditSnapshot = {
          creditLimit: dealerInfo.creditLimit,
          used: dealerInfo.used,
          available: dealerInfo.available,
        };
      }

      cleanPayload.updatedBy = payload.updatedBy || oldOrder.updatedBy;

      const updatedOrder = await base.update(id, cleanPayload, { session });
      return updatedOrder;
    });
  },

  async approve(
    orderId: string,
    role: ApprovalRole,
    userId: string,
    remarks?: string,
  ) {
    const flow: Record<
      "A.M" | "R.M" | "N.S.M",
      { current: OrderStatus; next: OrderStatus }
    > = {
      "A.M": { current: "PENDING_AM", next: "PENDING_RM" },
      "R.M": { current: "PENDING_RM", next: "PENDING_NSM" },
      "N.S.M": { current: "PENDING_NSM", next: "PENDING_FULFILLMENT" },
    };

    if (role === "DELIVERY" || role === "FULFILLMENT") {
      throw new Error("Use ship() for fulfillment and deliver() for delivery");
    }

    const step = flow[role as "A.M" | "R.M" | "N.S.M"];
    if (!step) throw new Error("Invalid approval role");

    const order = await SalesOrder.findOneAndUpdate(
      {
        _id: orderId,
        status: step.current,
        isActive: true,
      },
      {
        status: step.next,
        $push: {
          approvalLogs: {
            role,
            userId: new Types.ObjectId(userId),
            status: "APPROVED",
            remarks,
            actionDate: new Date(),
          },
        },
      },
      { new: true },
    ).populate(defaultPopulate as any);

    if (!order) {
      throw new Error("Order not found or approval sequence invalid");
    }

    return order;
  },

  async reject(
    orderId: string,
    role: ApprovalRole,
    userId: string,
    remarks?: string,
  ) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      ensureEditableOrderStatus(order.status as OrderStatus);

      if (!["A.M", "R.M", "N.S.M", "FULFILLMENT"].includes(role)) {
        throw new Error("Invalid rejection role");
      }

      await releaseAllReservations(order, session);

      order.status = "REJECTED";

      // ✅ ADD THIS BLOCK
      if (
        order.paymentMethod === "CREDIT" &&
        order.status !== "REJECTED" // for reject
      ) {
        const dealer = await getDealerById(order.customerId, session);

        dealer.currentDue = Math.max(
          0,
          (dealer.currentDue || 0) - order.grandTotal,
        );

        await dealer.save({ session });
      }

      order.approvalLogs.push({
        role,
        userId: new Types.ObjectId(userId),
        status: "REJECTED",
        remarks,
        actionDate: new Date(),
      });

      await order.save({ session });
      return order;
    });
  },

  async ship(orderId: string, warehouseUserId: string) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      if (order.status !== "PENDING_FULFILLMENT") {
        throw new Error("Order is not ready for fulfillment");
      }

      if (order.isInvoiced || order.invoiceId) {
        throw new Error("Invoice already created for this order");
      }

      const invoiceNo = `INV-${normalizeDhakaDateStamp()}-${Date.now()}`;

      const [invoice] = await SalesInvoice.create(
        [
          {
            invoiceNo,
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
            isVerified: false,
            createdBy: warehouseUserId,
          },
        ],
        { session },
      );

      const qrPayload = await buildQrPayload(invoice, order);
      invoice.qrCode = qrPayload;
      await invoice.save({ session });

      const dealer = await getDealerById(order.customerId, session);

      // if ((order.paymentMethod as string) === "CREDIT") {
      //   dealer.currentDue = (dealer.currentDue || 0) + order.grandTotal;
      //   await dealer.save({ session });
      // }

      order.status = "IN_SHIPPING";
      order.invoiceId = invoice._id;
      order.isInvoiced = true;

      order.approvalLogs.push({
        role: "FULFILLMENT",
        userId: new Types.ObjectId(warehouseUserId),
        status: "APPROVED",
        actionDate: new Date(),
        remarks: "Invoice created and ready for print",
      });

      await order.save({ session });

      const printPayload = await buildPrintableInvoiceData(
        order,
        invoice,
        dealer,
      );

      return {
        order,
        invoice,
        printPayload,
      };
    });
  },

  async deliver(
    orderId: string,
    deliveryUserId: string,
    uploadedDocumentFileId: string,
  ) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      if (!order.invoiceId) {
        throw new Error("Invoice not created yet");
      }

      if (order.status !== "IN_SHIPPING") {
        throw new Error("Order is not in shipping state");
      }

      if (isInvoiceCompletedStatus(order.status)) {
        throw new Error("Order already completed");
      }

      const invoice: any = await SalesInvoice.findById(order.invoiceId).session(
        session,
      );
      if (!invoice) throw new Error("Invoice not found");

      if (invoice.status !== "ACTIVE") {
        throw new Error("Invoice is not active");
      }

      const Dealer = SalesOrder.db.model("Dealer");
      const dealer = await Dealer.findById(order.customerId).session(session);
      if (!dealer) throw new Error("Dealer not found");

      const dealerSignatureId = dealer.attachments?.required?.signature;
      if (!dealerSignatureId) {
        throw new Error("Dealer signature template is missing");
      }

      const uploadedBuffer = await readMediaBuffer(
        uploadedDocumentFileId,
        session,
      );
      const dealerSignaturePath = await getMediaFilePath(
        dealerSignatureId.toString(),
        session,
      );
      const dealerSignatureBuffer = await fs.readFile(dealerSignaturePath);

      const extractedQr = await extractQrPayloadFromBuffer(uploadedBuffer);
      let extractedQrJson: {
        invoiceId: string;
        orderId: string;
        invoiceNo?: string;
        grandTotal?: number;
      };
      try {
        extractedQrJson = JSON.parse(extractedQr);
      } catch {
        throw new Error("Invalid QR payload in uploaded document");
      }

      if (
        String(extractedQrJson.invoiceId) !== String(invoice._id) ||
        String(extractedQrJson.orderId) !== String(order._id)
      ) {
        throw new Error("QR mismatch: invoice/order does not match");
      }

      const signatureCropBuffer =
        await extractSignatureCropBuffer(uploadedBuffer);
      const similarity = await compareImageSimilarity(
        signatureCropBuffer,
        dealerSignatureBuffer,
      );

      if (similarity < SIGNATURE_SIMILARITY_THRESHOLD) {
        throw new Error("Dealer signature mismatch");
      }

      for (const item of order.items) {
        const totalQty = itemTotalQty(item);

        const stock = await ProductStock.findOne({
          productId: item.productId,
          warehouseId: item.warehouseId,
        }).session(session);

        if (!stock) throw new Error("Stock not found for delivery");

        if ((stock.reservedForSales || 0) < totalQty) {
          throw new Error("Reserved stock is less than order quantity");
        }

        if ((stock.quantity || 0) < totalQty) {
          throw new Error("Insufficient physical stock for delivery");
        }

        stock.quantity = (stock.quantity || 0) - totalQty;
        stock.reservedForSales = Math.max(
          0,
          (stock.reservedForSales || 0) - totalQty,
        );
        stock.lastUpdated = new Date();

        await stock.save({ session });
      }

      invoice.signedInvoice = new Types.ObjectId(uploadedDocumentFileId);
      invoice.isVerified = true;
      invoice.updatedBy = new Types.ObjectId(deliveryUserId);
      await invoice.save({ session });

      order.status = "DELIVERED";
      order.deliveryManId = new Types.ObjectId(deliveryUserId);
      order.deliveryDate = new Date();

      order.approvalLogs.push({
        role: "DELIVERY",
        userId: new Types.ObjectId(deliveryUserId),
        status: "APPROVED",
        actionDate: new Date(),
        remarks: `Delivered after QR verification and signature similarity ${(similarity * 100).toFixed(1)}%`,
      });

      await order.save({ session });

      return {
        order,
        invoice,
        verification: {
          qrMatched: true,
          signatureSimilarity,
          signatureThreshold: SIGNATURE_SIMILARITY_THRESHOLD,
          uploadedDocumentFileId,
        },
      };
    });
  },

  async cancel(orderId: string) {
    return base.withTransaction(async (session) => {
      const order = await SalesOrder.findById(orderId).session(session);
      if (!order) throw new Error("Order not found");

      if (order.status === "DELIVERED") {
        throw new Error("Cannot cancel delivered order");
      }

      if (
        order.status === "IN_SHIPPING" ||
        order.isInvoiced ||
        order.invoiceId
      ) {
        throw new Error("Cannot cancel an order after invoice creation");
      }

      await releaseAllReservations(order, session);

      // ✅ ADD THIS BLOCK
      if (
        order.paymentMethod === "CREDIT" &&
        order.status !== "CANCELLED" // for cancel
      ) {
        const dealer = await getDealerById(order.customerId, session);

        dealer.currentDue = Math.max(
          0,
          (dealer.currentDue || 0) - order.grandTotal,
        );

        await dealer.save({ session });
      }

      order.status = "CANCELLED";
      await order.save({ session });

      return order;
    });
  },

  findOne: base.findOne,
  model: base.model,
};
