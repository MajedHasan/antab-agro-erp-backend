// src/seeds/chart-of-accounts.seed.ts

import mongoose from "mongoose";
import { Account } from "../models/account.model";

type AccountType =
  | "Asset"
  | "Liability"
  | "Equity"
  | "Revenue"
  | "Expense";

type PLGroup =
  | "revenue"
  | "costOfSales"
  | "selling"
  | "admin"
  | "nonOperating"
  | "financeCost"
  | "tax";

type SeedAccount = {
  code: string;
  name: string;
  type: AccountType;
  category: string;
  parentCode?: string;
  systemKey: string;
  plGroup?: PLGroup;
  description?: string;
};

const accounts: SeedAccount[] = [
  // ============================================================
  // ASSETS
  // ============================================================

  {
    code: "1000",
    name: "Assets",
    type: "Asset",
    category: "Asset",
    systemKey: "coa_root_assets",
    description: "Root account for all assets.",
  },

  {
    code: "1050",
    name: "Current Assets",
    type: "Asset",
    category: "Current Assets",
    parentCode: "1000",
    systemKey: "coa_current_assets",
  },

  {
    code: "1050-7",
    name: "Inventory",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050",
    systemKey: "coa_inventory",
  },

  {
    code: "92f5-1777650698450-3",
    name: "Finished Goods",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050-7",
    systemKey: "coa_inventory_finished_goods",
  },

  {
    code: "92f5-1775646003629-3",
    name: "Other Product",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050-7",
    systemKey: "coa_inventory_other_product",
  },

  {
    code: "92f5-1775282534617-3",
    name: "Other Goods",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050-7",
    systemKey: "coa_inventory_other_goods",
  },

  {
    code: "1050-7-1003",
    name: "Work In Progress",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050-7",
    systemKey: "coa_inventory_wip",
  },

  {
    code: "1050-7-1002",
    name: "Packaging Materials",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050-7",
    systemKey: "coa_inventory_packaging_materials",
  },

  {
    code: "1050-7-1001",
    name: "Raw Materials",
    type: "Asset",
    category: "Inventory",
    parentCode: "1050-7",
    systemKey: "coa_inventory_raw_materials",
  },

  {
    code: "1050-06",
    name: "Cash & Cash Equivalents",
    type: "Asset",
    category: "Cash & Cash Equivalents",
    parentCode: "1050",
    systemKey: "coa_cash_equivalents",
  },

  {
    code: "1050-05-02",
    name: "Cash AT Bank",
    type: "Asset",
    category: "Cash & Cash Equivalents",
    parentCode: "1050-06",
    systemKey: "coa_cash_at_bank",
  },

  {
    code: "1050-06-01",
    name: "Cash In Hand",
    type: "Asset",
    category: "Cash & Cash Equivalents",
    parentCode: "1050-06",
    systemKey: "coa_cash_in_hand",
  },

  {
    code: "ce44-1773130289495-4",
    name: "Cash In Factory",
    type: "Asset",
    category: "Cash & Cash Equivalents",
    parentCode: "1050-06",
    systemKey: "coa_cash_in_factory",
  },

  {
    code: "1050-05",
    name: "Short-Term Investments",
    type: "Asset",
    category: "Current Assets",
    parentCode: "1050",
    systemKey: "coa_short_term_investments",
  },

  {
    code: "1050-04",
    name: "Advances, Deposits & Pre-Payments",
    type: "Asset",
    category: "Current Assets",
    parentCode: "1050",
    systemKey: "coa_advances_deposits_prepayments",
  },

  {
    code: "1050-03",
    name: "Others Receivables",
    type: "Asset",
    category: "Current Assets",
    parentCode: "1050",
    systemKey: "coa_other_receivables",
  },

  {
    code: "1050-02",
    name: "Accounts Receivable",
    type: "Asset",
    category: "Current Assets",
    parentCode: "1050",
    systemKey: "coa_accounts_receivable",
  },

  {
    code: "1050-01",
    name: "Inventories",
    type: "Asset",
    category: "Current Assets",
    parentCode: "1050",
    systemKey: "coa_inventories",
  },

  // ------------------------------------------------------------
  // NON CURRENT ASSETS
  // ------------------------------------------------------------

  {
    code: "1060",
    name: "Non Current Assets",
    type: "Asset",
    category: "Non Current Assets",
    parentCode: "1000",
    systemKey: "coa_non_current_assets",
  },

  {
    code: "1061",
    name: "Property Plant & Equipment",
    type: "Asset",
    category: "Non Current Assets",
    parentCode: "1060",
    systemKey: "coa_property_plant_equipment",
  },

  {
    code: "1060-02-01",
    name: "Accumulated Depreciation",
    type: "Asset",
    category: "Non Current Assets",
    parentCode: "1060",
    systemKey: "coa_accumulated_depreciation",
    description:
      "Contra-asset account used to accumulate depreciation against fixed assets.",
  },

  {
    code: "1062",
    name: "Investment",
    type: "Asset",
    category: "Non Current Assets",
    parentCode: "1060",
    systemKey: "coa_investment",
  },

  {
    code: "1063",
    name: "Intangible Assets",
    type: "Asset",
    category: "Non Current Assets",
    parentCode: "1060",
    systemKey: "coa_intangible_assets",
  },

  {
    code: "1064",
    name: "Product Registration",
    type: "Asset",
    category: "Intangible Assets",
    parentCode: "1063",
    systemKey: "coa_product_registration",
  },

  {
    code: "1065",
    name: "Amortisation",
    type: "Asset",
    category: "Non Current Assets",
    parentCode: "1060",
    systemKey: "coa_amortisation",
  },

  // ============================================================
  // LIABILITIES
  // ============================================================

  {
    code: "2000",
    name: "Liabilities",
    type: "Liability",
    category: "Liability",
    systemKey: "coa_root_liabilities",
    description: "Root account for all liabilities.",
  },

  {
    code: "2010",
    name: "Non Current Liabilities",
    type: "Liability",
    category: "Non Current Liabilities",
    parentCode: "2000",
    systemKey: "coa_non_current_liabilities",
  },

  {
    code: "2010-03",
    name: "Other Long-Term Liabilities",
    type: "Liability",
    category: "Non Current Liabilities",
    parentCode: "2010",
    systemKey: "coa_other_long_term_liabilities",
  },

  {
    code: "2010-02",
    name: "Lease Liabilities",
    type: "Liability",
    category: "Non Current Liabilities",
    parentCode: "2010",
    systemKey: "coa_lease_liabilities",
  },

  {
    code: "2010-01",
    name: "Long-Term Bank Loans",
    type: "Liability",
    category: "Non Current Liabilities",
    parentCode: "2010",
    systemKey: "coa_long_term_bank_loans",
  },

  {
    code: "2020",
    name: "Current Liabilities",
    type: "Liability",
    category: "Current Liabilities",
    parentCode: "2000",
    systemKey: "coa_current_liabilities",
  },

  {
    code: "2020-05",
    name: "Accrued Expenses",
    type: "Liability",
    category: "Current Liabilities",
    parentCode: "2020",
    systemKey: "coa_accrued_expenses",
  },

  {
    code: "2020-04",
    name: "Others Payable",
    type: "Liability",
    category: "Current Liabilities",
    parentCode: "2020",
    systemKey: "coa_other_payables",
  },

  {
    code: "2020-03",
    name: "Accounts Payable",
    type: "Liability",
    category: "Current Liabilities",
    parentCode: "2020",
    systemKey: "coa_accounts_payable",
  },

  {
    code: "2020-02",
    name: "Short-Term Loans From Sister Concern",
    type: "Liability",
    category: "Current Liabilities",
    parentCode: "2020",
    systemKey: "coa_short_term_sister_concern_loans",
  },

  {
    code: "2020-01",
    name: "Short-Term Bank Loans",
    type: "Liability",
    category: "Current Liabilities",
    parentCode: "2020",
    systemKey: "coa_short_term_bank_loans",
  },

  // ============================================================
  // EQUITY
  // ============================================================

  {
    code: "3000",
    name: "Equity",
    type: "Equity",
    category: "Equity",
    systemKey: "coa_root_equity",
  },

  {
    code: "3020",
    name: "Share Capital",
    type: "Equity",
    category: "Equity",
    parentCode: "3000",
    systemKey: "coa_share_capital",
  },

  {
    code: "3030",
    name: "Retain Earnings",
    type: "Equity",
    category: "Equity",
    parentCode: "3000",
    systemKey: "coa_retained_earnings",
  },

  {
    code: "3040",
    name: "Reserves",
    type: "Equity",
    category: "Equity",
    parentCode: "3000",
    systemKey: "coa_reserves",
  },

  // ============================================================
  // REVENUE
  // ============================================================

  {
    code: "4000",
    name: "Revenue",
    type: "Revenue",
    category: "Revenue",
    systemKey: "coa_root_revenue",
    plGroup: "revenue",
  },

  {
    code: "488b-1783625054887-1",
    name: "Sales Returns",
    type: "Revenue",
    category: "Sales Deductions",
    parentCode: "4000",
    systemKey: "coa_sales_returns_legacy",
    plGroup: "revenue",
  },

  {
    code: "488b-1783540943287-1",
    name: "Sales",
    type: "Revenue",
    category: "Revenue",
    parentCode: "4000",
    systemKey: "coa_sales",
    plGroup: "revenue",
  },

  {
    code: "4010",
    name: "Sales Deductions",
    type: "Revenue",
    category: "Sales Deductions",
    parentCode: "4000",
    systemKey: "coa_sales_deductions",
    plGroup: "revenue",
  },

  {
    code: "4010-03",
    name: "Rebates",
    type: "Revenue",
    category: "Sales Deductions",
    parentCode: "4010",
    systemKey: "coa_rebates",
    plGroup: "revenue",
  },

  {
    code: "4010-02",
    name: "Sales Discounts",
    type: "Revenue",
    category: "Sales Deductions",
    parentCode: "4010",
    systemKey: "coa_sales_discounts",
    plGroup: "revenue",
  },

  {
    code: "4010-01",
    name: "Sales Returns",
    type: "Revenue",
    category: "Sales Deductions",
    parentCode: "4010",
    systemKey: "coa_sales_returns",
    plGroup: "revenue",
  },

  {
    code: "4020",
    name: "Other Operating Revenue",
    type: "Revenue",
    category: "Other Operating Revenue",
    parentCode: "4000",
    systemKey: "coa_other_operating_revenue",
    plGroup: "revenue",
  },

  {
    code: "4020-01",
    name: "Commission Income",
    type: "Revenue",
    category: "Other Operating Revenue",
    parentCode: "4020",
    systemKey: "coa_commission_income",
    plGroup: "revenue",
  },

  {
    code: "4030",
    name: "Operating Revenue",
    type: "Revenue",
    category: "Operating Revenue",
    parentCode: "4000",
    systemKey: "coa_operating_revenue",
    plGroup: "revenue",
  },

  {
    code: "4030-03",
    name: "Revenue from Bulk Sales",
    type: "Revenue",
    category: "Operating Revenue",
    parentCode: "4030",
    systemKey: "coa_bulk_sales",
    plGroup: "revenue",
  },

  {
    code: "4030-02",
    name: "Rental Income",
    type: "Revenue",
    category: "Operating Revenue",
    parentCode: "4030",
    systemKey: "coa_rental_income",
    plGroup: "revenue",
  },

  {
    code: "4030-01",
    name: "Product Sales",
    type: "Revenue",
    category: "Operating Revenue",
    parentCode: "4030",
    systemKey: "coa_product_sales",
    plGroup: "revenue",
  },

  // ============================================================
  // EXPENSES
  // ============================================================

  {
    code: "5000",
    name: "Expense",
    type: "Expense",
    category: "Expense",
    systemKey: "coa_root_expense",
  },

  // ------------------------------------------------------------
  // SELLING & DISTRIBUTION
  // ------------------------------------------------------------

  {
    code: "5020",
    name: "Selling & Distribution",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5000",
    systemKey: "coa_selling_distribution",
    plGroup: "selling",
  },

  {
    code: "5020-06",
    name: "TA/DA Expense",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5020",
    systemKey: "coa_tada_expense",
    plGroup: "selling",
  },

  {
    code: "5020-05",
    name: "Marketing Expenses",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5020",
    systemKey: "coa_marketing_expenses",
    plGroup: "selling",
  },

  {
    code: "5020-04",
    name: "Freight Outward",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5020",
    systemKey: "coa_freight_outward",
    plGroup: "selling",
  },

  {
    code: "5020-02",
    name: "Advertising",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5020",
    systemKey: "coa_advertising",
    plGroup: "selling",
  },

  {
    code: "5020-01",
    name: "Sales Commission",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5020",
    systemKey: "coa_sales_commission",
    plGroup: "selling",
  },

  {
    code: "5020-03",
    name: "Bank Deposit Charge",
    type: "Expense",
    category: "Selling & Distribution",
    parentCode: "5020",
    systemKey: "coa_bank_deposit_charge",
    plGroup: "selling",
  },

  // ------------------------------------------------------------
  // COST OF GOODS SOLD
  // ------------------------------------------------------------

  {
    code: "5030",
    name: "Cost of Goods Sold",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5000",
    systemKey: "coa_cost_of_goods_sold",
    plGroup: "costOfSales",
  },

  {
    code: "5030-06",
    name: "Inventory Write-Down",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5030",
    systemKey: "coa_inventory_write_down",
    plGroup: "costOfSales",
  },

  {
    code: "5030-05",
    name: "Freight Inward",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5030",
    systemKey: "coa_freight_inward",
    plGroup: "costOfSales",
  },

  {
    code: "5030-04",
    name: "Manufacturing Overheads",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5030",
    systemKey: "coa_manufacturing_overheads",
    plGroup: "costOfSales",
  },

  {
    code: "5030-03",
    name: "Direct Labor",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5030",
    systemKey: "coa_direct_labor",
    plGroup: "costOfSales",
  },

  {
    code: "5030-02",
    name: "Purchase Packing Materials",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5030",
    systemKey: "coa_purchase_packing_materials",
    plGroup: "costOfSales",
  },

  {
    code: "5030-01",
    name: "Purchase Raw Materials",
    type: "Expense",
    category: "Cost of Goods Sold",
    parentCode: "5030",
    systemKey: "coa_purchase_raw_materials",
    plGroup: "costOfSales",
  },

  // ------------------------------------------------------------
  // OPERATING EXPENSES
  // ------------------------------------------------------------

  {
    code: "5040",
    name: "Operating Expenses",
    type: "Expense",
    category: "Operating Expenses",
    parentCode: "5000",
    systemKey: "coa_operating_expenses",
    plGroup: "admin",
  },

  {
    code: "5040-05",
    name: "Depreciation",
    type: "Expense",
    category: "Operating Expenses",
    parentCode: "5040",
    systemKey: "coa_depreciation_expense",
    plGroup: "admin",
  },

  {
    code: "5040-04",
    name: "Insurance",
    type: "Expense",
    category: "Operating Expenses",
    parentCode: "5040",
    systemKey: "coa_insurance",
    plGroup: "admin",
  },

  {
    code: "5040-03",
    name: "Utilities",
    type: "Expense",
    category: "Operating Expenses",
    parentCode: "5040",
    systemKey: "coa_utilities",
    plGroup: "admin",
  },

  {
    code: "5040-02",
    name: "Rent Expense",
    type: "Expense",
    category: "Operating Expenses",
    parentCode: "5040",
    systemKey: "coa_rent_expense",
    plGroup: "admin",
  },

  {
    code: "5040-01",
    name: "Salaries & Wages",
    type: "Expense",
    category: "Operating Expenses",
    parentCode: "5040",
    systemKey: "coa_salaries_wages",
    plGroup: "admin",
  },

  // ------------------------------------------------------------
  // FINANCE COSTS
  // ------------------------------------------------------------

  {
    code: "5050",
    name: "Finance Costs",
    type: "Expense",
    category: "Finance Costs",
    parentCode: "5000",
    systemKey: "coa_finance_costs",
    plGroup: "financeCost",
  },

  {
    code: "5050-03",
    name: "Foreign Exchange Loss",
    type: "Expense",
    category: "Finance Costs",
    parentCode: "5050",
    systemKey: "coa_foreign_exchange_loss",
    plGroup: "financeCost",
  },

  {
    code: "5050-02",
    name: "Bank Charges",
    type: "Expense",
    category: "Finance Costs",
    parentCode: "5050",
    systemKey: "coa_bank_charges",
    plGroup: "financeCost",
  },

  {
    code: "5050-01",
    name: "Interest Expense",
    type: "Expense",
    category: "Finance Costs",
    parentCode: "5050",
    systemKey: "coa_interest_expense",
    plGroup: "financeCost",
  },

  // ------------------------------------------------------------
  // OTHER EXPENSES
  // ------------------------------------------------------------

  {
    code: "5060",
    name: "Other Expenses",
    type: "Expense",
    category: "Other Expenses",
    parentCode: "5000",
    systemKey: "coa_other_expenses",
    plGroup: "nonOperating",
  },

  {
    code: "5060-02",
    name: "Impairment Loss",
    type: "Expense",
    category: "Other Expenses",
    parentCode: "5060",
    systemKey: "coa_impairment_loss",
    plGroup: "nonOperating",
  },

  {
    code: "5060-01",
    name: "Loss on Disposal",
    type: "Expense",
    category: "Other Expenses",
    parentCode: "5060",
    systemKey: "coa_loss_on_disposal",
    plGroup: "nonOperating",
  },
];

/**
 * ============================================================
 * Seed Chart of Accounts
 * ============================================================
 *
 * SAFE / IDEMPOTENT:
 *
 * - Existing accounts are NOT deleted.
 * - Existing balances are NOT changed.
 * - Existing account codes are NOT changed.
 * - Existing parent relationships are NOT changed.
 * - Missing accounts are created.
 * - systemKey is assigned to matching accounts.
 * - plGroup is assigned where defined.
 *
 * The seed can safely be executed multiple times.
 */
export async function seedChartOfAccounts() {
  console.log("\n===========================================");
  console.log("        CHART OF ACCOUNTS SEED");
  console.log("===========================================\n");

  const session = await mongoose.startSession();

  let createdCount = 0;
  let existingCount = 0;
  let updatedCount = 0;

  try {
    session.startTransaction();

    /**
     * --------------------------------------------------------
     * STEP 1
     * Create / find accounts in parent-first order.
     * --------------------------------------------------------
     */

    const accountMap = new Map<string, any>();

    for (const item of accounts) {
      /**
       * Find existing account primarily by CODE.
       *
       * This is important because your application already has
       * these account codes in production.
       */
      let account = await Account.findOne({
        code: item.code,
        deletedAt: { $exists: false },
      }).session(session);

      /**
       * If not found by code, try systemKey.
       *
       * This protects against a future situation where an account
       * was created using the systemKey but the code changed.
       */
      if (!account) {
        account = await Account.findOne({
          systemKey: item.systemKey,
          deletedAt: { $exists: false },
        }).session(session);
      }

      /**
       * Resolve parent.
       */
      let parentId: any = null;

      if (item.parentCode) {
        const parent = accountMap.get(item.parentCode);

        if (!parent) {
          throw new Error(
            `Parent account "${item.parentCode}" was not seeded before child "${item.code}".`,
          );
        }

        parentId = parent._id;
      }

      /**
       * ------------------------------------------------------
       * CREATE
       * ------------------------------------------------------
       */

      if (!account) {
        account = await Account.create(
          [
            {
              code: item.code,
              name: item.name,
              type: item.type,
              category: item.category,
              parent: parentId,
              balance: 0,
              currency: "USD",
              status: "Active",
              systemKey: item.systemKey,
              ...(item.plGroup ? { plGroup: item.plGroup } : {}),
              ...(item.description
                ? { description: item.description }
                : {}),
            },
          ],
          { session },
        ).then((docs) => docs[0]);

        createdCount++;

        console.log(`+ Created: ${item.code} - ${item.name}`);
      } else {
        /**
         * ------------------------------------------------------
         * EXISTING ACCOUNT
         * ------------------------------------------------------
         *
         * We deliberately DO NOT overwrite:
         *
         * - code
         * - name
         * - type
         * - parent
         * - balance
         * - currency
         * - status
         *
         * because this is an already-running ERP.
         */

        existingCount++;

        let changed = false;

        /**
         * Add systemKey if missing.
         */
        if (!account.systemKey) {
          account.systemKey = item.systemKey;
          changed = true;
        } else if (account.systemKey !== item.systemKey) {
          /**
           * Do not silently overwrite an existing systemKey.
           */
          console.warn(
            `⚠️ SystemKey mismatch for ${item.code}. ` +
              `Existing: ${account.systemKey}, ` +
              `Seed: ${item.systemKey}`,
          );
        }

        /**
         * Add PL group if missing.
         *
         * We don't overwrite an existing value.
         */
        if (item.plGroup && !account.plGroup) {
          account.plGroup = item.plGroup;
          changed = true;
        }

        /**
         * Add description only if currently empty.
         */
        if (item.description && !account.description) {
          account.description = item.description;
          changed = true;
        }

        if (changed) {
          await account.save({ session });
          updatedCount++;

          console.log(`~ Updated metadata: ${item.code} - ${item.name}`);
        } else {
          console.log(`= Exists: ${item.code} - ${item.name}`);
        }
      }

      /**
       * Store account by CODE.
       *
       * This is used by children to resolve their parent.
       */
      accountMap.set(item.code, account);
    }

    await session.commitTransaction();

    console.log("\n===========================================");
    console.log("       CHART OF ACCOUNTS SEED DONE");
    console.log("===========================================");
    console.log(`Created : ${createdCount}`);
    console.log(`Existing: ${existingCount}`);
    console.log(`Updated : ${updatedCount}`);
    console.log(`Total   : ${accounts.length}`);
    console.log("===========================================\n");

    return {
      success: true,
      created: createdCount,
      existing: existingCount,
      updated: updatedCount,
      total: accounts.length,
    };
  } catch (error) {
    await session.abortTransaction();

    console.error("\n❌ Chart of Accounts seed failed.");
    console.error(error);

    throw error;
  } finally {
    await session.endSession();
  }
}

export default seedChartOfAccounts;