import { createCrudService } from "./crud.service";
import SalesInvoice from "../models/sales-invoice.model";
import { Types } from "mongoose";

const base = createCrudService(SalesInvoice, {
  searchFields: ["invoiceNo"],
  allowedFilterFields: ["customerId", "paymentStatus", "status"],
  defaultPopulate: [
    { path: "customerId", select: "name phoneNumber currentDue" },
    { path: "orderId", select: "orderNo" },
    { path: "items.productId", select: "name price" },
  ],
});

export const salesInvoiceService = {
  ...base,

  /* =========================
     LIST (MULTI STATUS FILTER)
  ========================== */
  async list(params: any) {
    if (params.filter?.paymentStatus?.includes(",")) {
      params.filter.paymentStatus = {
        $in: params.filter.paymentStatus
          .split(",")
          .map((v: string) => v.trim()),
      };
    }

    return base.list(params);
  },

  /* =========================
     GET BY ORDER ID
  ========================== */
  async getByOrderId(orderId: string) {
    const invoice = await SalesInvoice.findOne({ orderId }).populate(
      base.defaultPopulate as any,
    );

    if (!invoice) throw new Error("Invoice not found for this order");

    return invoice;
  },

  /* =========================
     ADD PAYMENT (IMPORTANT)
  ========================== */
  async addPayment(invoiceId: string, payment: any) {
    return base.withTransaction(async (session) => {
      const invoice: any =
        await SalesInvoice.findById(invoiceId).session(session);
      if (!invoice) throw new Error("Invoice not found");

      if (invoice.status === "CANCELLED") {
        throw new Error("Cannot add payment to cancelled invoice");
      }

      if (!payment?.amount || payment.amount <= 0) {
        throw new Error("Invalid payment amount");
      }

      const newPaidAmount = invoice.paidAmount + payment.amount;

      if (newPaidAmount > invoice.grandTotal) {
        throw new Error("Payment exceeds invoice total");
      }

      // Update invoice
      invoice.payments.push(payment);
      invoice.paidAmount = newPaidAmount;
      invoice.balanceAmount = invoice.grandTotal - invoice.paidAmount;

      if (invoice.balanceAmount === 0) {
        invoice.paymentStatus = "PAID";
      } else {
        invoice.paymentStatus = "PARTIAL";
      }

      await invoice.save({ session });

      /* =========================
         UPDATE DEALER DUE (CRITICAL)
      ========================== */
      const Dealer = SalesInvoice.db.model("Dealer");

      const dealer: any = await Dealer.findById(invoice.customerId).session(
        session,
      );

      if (dealer) {
        dealer.currentDue = Math.max(
          0,
          (dealer.currentDue || 0) - payment.amount,
        );

        await dealer.save({ session });
      }

      return invoice;
    });
  },

  /* =========================
     CANCEL INVOICE
  ========================== */
  async cancel(invoiceId: string) {
    const invoice = await SalesInvoice.findById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    if (invoice.paymentStatus === "PAID") {
      throw new Error("Cannot cancel a fully paid invoice");
    }

    return base.update(invoiceId, { status: "CANCELLED" });
  },
};
