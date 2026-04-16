import { Request, Response, NextFunction } from "express";
import { salesInvoiceService } from "../services/sales-invoice.service";
import { createCrudController } from "./crud.controller";

function getUserId(req: Request): string | null {
  const user = (req as any).user;
  return user?.userId ? String(user.userId) : null;
}

export const salesInvoiceController = {
  ...createCrudController(salesInvoiceService),

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
