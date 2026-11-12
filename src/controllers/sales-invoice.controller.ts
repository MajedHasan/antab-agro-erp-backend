import { Request, Response, NextFunction } from "express";
import { salesInvoiceService } from "../services/sales-invoice.service";
import { createCrudController } from "./crud.controller";
import { parseListQuery } from "../utils/query";

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.userId ? String(user.userId) : null;
}

export const salesInvoiceController = {
  ...createCrudController(salesInvoiceService),

    /* ================================
     LIST (with date range support)
     GET /sales-invoices?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
  ================================= */
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pq = parseListQuery(req, { page: 1, limit: 15 });
      const filter: any = { ...pq.filter };

      const {
        status,
        paymentStatus,
        fromDate,
        toDate,
        q,
      } = req.query as Record<string, string | undefined>;

      // Explicitly re-apply dimension filters
      if (status && status !== "ALL") filter.status = status;
      if (paymentStatus && paymentStatus !== "ALL")
        filter.paymentStatus = paymentStatus;

      // 🆕 Translate fromDate/toDate → invoiceDate range (Asia/Dhaka)
      if (fromDate || toDate) {
        filter.invoiceDate = {};
        if (fromDate) {
          filter.invoiceDate.$gte = new Date(
            `${String(fromDate)}T00:00:00.000+06:00`,
          );
        }
        if (toDate) {
          filter.invoiceDate.$lte = new Date(
            `${String(toDate)}T23:59:59.999+06:00`,
          );
        }
      }

      const result = await salesInvoiceService.list({
        filter,
        page: pq.page,
        limit: pq.limit,
        sort: pq.sort || "-createdAt",
        select: pq.select,
        populate: pq.populate,
        q: pq.q ?? (typeof q === "string" ? q : undefined),
      });

      res.json({ success: true, ...result });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /sales-invoices/order/:orderId
   */
  getByOrderId: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const invoice = await salesInvoiceService.getByOrderId(
        req.params.orderId,
      );

      res.json({
        success: true,
        data: invoice,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /sales-invoices/:id/pay
   * body: { method, amount, referenceNo }
   */
  addPayment: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = getUserId(req);
      const { amount, method, referenceNo } = req.body;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        res.status(400).json({
          success: false,
          message: "amount must be a positive number",
        });
        return;
      }

      if (!method) {
        res.status(400).json({
          success: false,
          message: "payment method is required",
        });
        return;
      }

      const payment = {
        method,
        amount: Number(amount),
        referenceNo,
        paymentDate: new Date(),
        receivedBy: userId,
      };

      const invoice = await salesInvoiceService.addPayment(
        req.params.id,
        payment,
      );

      res.json({
        success: true,
        data: invoice,
      });
      return;
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /sales-invoices/:id/cancel
   */
  cancel: async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const invoice = await salesInvoiceService.cancel(req.params.id);

      res.json({
        success: true,
        data: invoice,
      });
      return;
    } catch (err) {
      next(err);
    }
  },
};
