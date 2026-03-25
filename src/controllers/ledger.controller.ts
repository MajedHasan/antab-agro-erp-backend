import { Request, Response, NextFunction } from "express";
import { ledgerService } from "../services/ledger.service";
import { parseISO } from "date-fns";

export const ledgerController = {
  async listAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await ledgerService.listAccounts();
      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  },

  async transactions(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.accountId;
      const { from, to, type, status, search, sortBy, sortDir, limit, skip } =
        req.query;

      const filter: any = {};
      if (from) filter.from = parseISO(String(from));
      if (to) filter.to = parseISO(String(to));
      if (type) filter.type = String(type);
      if (status) filter.status = String(status);
      if (search) filter.search = String(search);
      if (sortBy) filter.sortBy = String(sortBy);
      if (sortDir) filter.sortDir = String(sortDir) === "asc" ? "asc" : "desc";
      if (limit) filter.limit = Number(limit);
      if (skip) filter.skip = Number(skip);

      const data = await ledgerService.getTransactionsForAccount(
        accountId,
        filter,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const accountId = req.params.accountId;
      const { from, to } = req.query;
      const f = from ? parseISO(String(from)) : undefined;
      const t = to ? parseISO(String(to)) : undefined;

      const data = await ledgerService.getLedgerSummary(accountId, f, t);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
