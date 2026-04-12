import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import express from "express";
import logger from "./utils/logger";
import compression from "compression";
import path from "path";

import rateLimit from "express-rate-limit";
import { errorHandler } from "./middlewares/error.middleware";

import { requireAuth } from "./middlewares/auth.middleware";

/* ===== AUTH / CORE ===== */
import authRoutes from "./routes/auth.routes";
import roleRoutes from "./routes/roles.routes";
import permissionRoutes from "./routes/permissions.routes";
import userRoutes from "./routes/user.routes";

/* ===== LOCATION ===== */
import zonesRoutes from "./routes/zones.routes";
import regionsRoutes from "./routes/regions.routes";
import areasRoutes from "./routes/areas.routes";
import territoriesRoutes from "./routes/territories.routes";

/* ===== BUSINESS ===== */
import dealersRoutes from "./routes/dealers.routes";
import supplierRoutes from "./routes/supplier.routes";
import warehouseOrFactoryRoutes from "./routes/warehouseOrFactory.routes";

/* ===== SPECIAL OFFERS ===== */
import specialOfferRoutes from "./routes/special-offer.routes";

/* ===== INVENTORY ===== */
import rawMaterialRoutes from "./routes/rawMaterial.routes";
import rawMaterialStockRoutes from "./routes/rawMaterialStock.routes";
import packagingItemRoutes from "./routes/packaging.routes";
import packagingStockRoutes from "./routes/packagingStock.routes";
import warehouseTransferRoutes from "./routes/warehouse-transfer.routes";
import productsRoutes from "./routes/product.routes";
import productStockRoutes from "./routes/productStock.routes";
import otherProductsRoutes from "./routes/otherProduct.routes";
import otherProductStockRoutes from "./routes/otherProductStock.routes";
import promotionRoutes from "./routes/product-promotion.routes"; // << add this

/* ===== PRODUCTION ===== */
import bomRoutes from "./routes/bom.routes";
import productionRoutes from "./routes/production.routes";
import materialWipRoutes from "./routes/materialWip.routes";

/* ===== SALES ===== */
import salesOrderRoutes from "./routes/sales-order.routes";
import salesInvoiceRoutes from "./routes/sales-invoice.routes";
import salesReturnRoutes from "./routes/sales-return.routes";

/* ===== OPERATIONS ===== */
import workordersRoutes from "./routes/workorder.routes";
import goodReceiptRoutes from "./routes/good-receipt.routes";

/* ===== ACCESS / MEDIA ===== */
import userLocationAccessRoutes from "./routes/userLocationAccess.routes";
import mediaRoutes from "./routes/media.routes";
import classroomRoutes from "./routes/classroom.routes";

/* ===== ACCOUNTS ===== */
import accountRoutes from "./routes/account.routes";
import voucherRoutes from "./routes/voucher.routes";

/* ===== ACCOUNTING MASTERS ===== */
import voucherPartyRoutes from "./routes/voucher-party.routes";
import paymentModeRoutes from "./routes/payment-mode.routes";
import voucherAccountRoutes from "./routes/voucher-account.routes";
import journalVoucherTypeRoutes from "./routes/journal-voucher-type.routes";

/* ===== REPORTS / FINANCIALS ===== */
// Add these as you have implemented them
import statementOfProfitLossRoutes from "./routes/statement-of-profit-loss.routes";
import statementOfFinancialPositionRoutes from "./routes/statement-of-financial-position.routes";
import financialNotesRoutes from "./routes/financial-note.routes";
import statementOfChangesInEquityRoutes from "./routes/statement-of-changes-in-equity.routes";
import trialBalanceRoutes from "./routes/trial-balance.routes";
import ledgerRoutes from "./routes/ledger.routes";

const app = express();

/* ===== STATIC ===== */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ===== MIDDLEWARE ===== */
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  morgan("combined", { stream: { write: (s) => logger.info(s.trim()) } }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
});
app.use(limiter);

/* ===== MEDIA ===== */
app.use("/api/media", mediaRoutes);

/* ===== AUTH ===== */
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/users", userRoutes);

/* ===== LOCATION ===== */
app.use("/api/zones", zonesRoutes);
app.use("/api/regions", regionsRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/territories", territoriesRoutes);

/* ===== BUSINESS ===== */
app.use("/api/dealers", dealersRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/warehouses", warehouseOrFactoryRoutes);
app.use("/api/warehouses-or-factories", warehouseOrFactoryRoutes);

/* ===== SPECIAL OFFERS ===== */
app.use("/api/special-offers", requireAuth, specialOfferRoutes);

/* ===== INVENTORY ===== */
app.use("/api/raw-materials", rawMaterialRoutes);
app.use("/api/raw-material-stocks", rawMaterialStockRoutes);

app.use("/api/packaging-items", packagingItemRoutes);
app.use("/api/packaging-stocks", packagingStockRoutes);
app.use("/api/transfers", requireAuth, warehouseTransferRoutes);

app.use("/api/products", productsRoutes);
app.use("/api/product-stocks", productStockRoutes);

app.use("/api/other-products", otherProductsRoutes);
app.use("/api/other-product-stocks", otherProductStockRoutes);

app.use("/api/promotions", promotionRoutes); // << add this

/* ===== PRODUCTION ===== */
app.use("/api/bom", bomRoutes);
app.use("/api/productions", requireAuth, productionRoutes);
app.use("/api/material-wip", requireAuth, materialWipRoutes);

/* ===== SALES ===== */
app.use("/api/sales-orders", requireAuth, salesOrderRoutes);
app.use("/api/sales-invoices", salesInvoiceRoutes);
app.use("/api/sales-returns", salesReturnRoutes);

/* ===== OPERATIONS ===== */
app.use("/api/workorders", requireAuth, workordersRoutes);
app.use("/api/grs", requireAuth, goodReceiptRoutes);

/* ===== ACCOUNTS ===== */
app.use("/api/accounts", accountRoutes);
app.use("/api/vouchers", requireAuth, voucherRoutes);

/* ===== ACCOUNTING MASTERS ===== */
app.use("/api/voucher-parties", voucherPartyRoutes);
app.use("/api/payment-modes", paymentModeRoutes);
app.use("/api/voucher-accounts", voucherAccountRoutes);
app.use("/api/journal-voucher-types", journalVoucherTypeRoutes);

/* ===== REPORTS / FINANCIALS ===== */
app.use("/api/reports/profit-loss", statementOfProfitLossRoutes);
app.use(
  "/api/reports/statement-of-financial-position",
  statementOfFinancialPositionRoutes,
);
app.use("/api/reports/financial-notes", financialNotesRoutes);
app.use("/api/reports/changes-in-equity", statementOfChangesInEquityRoutes);
app.use("/api/reports/trial-balance", trialBalanceRoutes);

/* ===== LEDGER ===== */
app.use("/api/ledger", ledgerRoutes);

/* ===== ACCESS / OTHERS ===== */
app.use("/api/user-location-access", userLocationAccessRoutes);
app.use("/api/classrooms", classroomRoutes);

/* ===== HEALTH ===== */
app.get("/", (req, res) => res.json({ status: "ok", version: "1.0.0" }));

/* ===== ERROR ===== */
app.use(errorHandler);

export default app;
