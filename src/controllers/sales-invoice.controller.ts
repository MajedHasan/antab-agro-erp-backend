import { Request, Response, NextFunction } from "express";
import { salesInvoiceService } from "../services/sales-invoice.service";
import { createCrudController } from "./crud.controller";

export const salesInvoiceController = {
  ...createCrudController(salesInvoiceService),

  /**
   * POST /sales-invoices/:id/pay
   * body: { method, amount, referenceNo }
   */
  addPayment: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, method } = req.body;

      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({
          success: false,
          message: "amount must be a positive number",
        });
      }

      if (!method) {
        return res.status(400).json({
          success: false,
          message: "payment method is required",
        });
      }

      const payment = {
        ...req.body,
        amount: Number(amount),
        paymentDate: new Date(),
        receivedBy: (req as any).user?.userId,
      };

      const invoice = await salesInvoiceService.addPayment(
        req.params.id,
        payment,
      );

      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /sales-invoices/:id/cancel
   */
  cancel: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoice = await salesInvoiceService.cancel(req.params.id);
      res.json({ success: true, data: invoice });
    } catch (err) {
      next(err);
    }
  },
};
