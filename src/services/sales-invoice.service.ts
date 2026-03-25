import { createCrudService } from "./crud.service";
import SalesInvoice from "../models/sales-invoice.model";

const base = createCrudService(SalesInvoice, {
  searchFields: ["invoiceNo"],
  allowedFilterFields: ["customerId", "paymentStatus", "status"],
  defaultPopulate: [
    { path: "customerId", select: "name phone" },
    { path: "orderId", select: "orderNo" },
    { path: "items.productId", select: "name id" },
  ],
});

export const salesInvoiceService = {
  ...base,

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
     ADD PAYMENT
  ========================== */
  async addPayment(invoiceId: string, payment: any) {
    return base.withTransaction(async (session) => {
      const invoice = await SalesInvoice.findById(invoiceId).session(session);
      if (!invoice) throw new Error("Invoice not found");

      invoice.payments.push(payment);
      invoice.paidAmount += payment.amount;
      invoice.balanceAmount = invoice.grandTotal - invoice.paidAmount;

      if (invoice.balanceAmount <= 0) {
        invoice.paymentStatus = "PAID";
        invoice.balanceAmount = 0;
      } else {
        invoice.paymentStatus = "PARTIAL";
      }

      await invoice.save({ session });
      return invoice;
    });
  },

  async cancel(invoiceId: string) {
    return base.update(invoiceId, { status: "CANCELLED" });
  },
};
