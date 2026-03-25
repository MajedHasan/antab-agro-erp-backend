import mongoose from "mongoose";
import { Account } from "../models/account.model";
import { Voucher } from "../models/voucher.model";
import { VoucherLine } from "../models/voucher-line.model";

async function migrateOpeningBalances() {
  console.log("Connected to MongoDB");

  // 1️⃣ Find the Equity account
  const equityAccount = await Account.findOne({
    type: "Equity",
    deletedAt: { $exists: false },
    status: "Active",
  }).lean();

  if (!equityAccount) {
    throw new Error(
      "No Equity account found. Please create an Equity account first.",
    );
  }

  console.log("Using Equity account:", equityAccount.code, equityAccount.name);

  // 2️⃣ Find all accounts with non-zero balance
  const accounts = await Account.find({
    balance: { $ne: 0 },
    _id: { $ne: equityAccount._id },
    deletedAt: { $exists: false },
  }).lean();

  if (!accounts.length) {
    console.log("No accounts with non-zero balance. Migration skipped.");
    return;
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const acc of accounts) {
      const amount = acc.balance;

      // create opening voucher
      const voucher = await Voucher.create(
        [
          {
            voucherNo: `OPEN-${acc.code}`,
            date: new Date(),
            type: "Opening",
            narration: `Opening balance for ${acc.name}`,
            status: "Posted",
            postedAt: new Date(),
          },
        ],
        { session },
      );

      // create voucher lines: debit or credit based on account type
      const lines: any[] = [
        {
          voucherId: voucher[0]._id,
          accountId: acc._id,
          debit: acc.type === "Asset" || acc.type === "Expense" ? amount : 0,
          credit:
            acc.type === "Liability" ||
            acc.type === "Revenue" ||
            acc.type === "Equity"
              ? amount
              : 0,
          narration: "Opening balance",
        },
        {
          voucherId: voucher[0]._id,
          accountId: equityAccount._id,
          debit:
            acc.type === "Liability" ||
            acc.type === "Revenue" ||
            acc.type === "Equity"
              ? amount
              : 0,
          credit: acc.type === "Asset" || acc.type === "Expense" ? amount : 0,
          narration: "Balancing entry",
        },
      ];

      await VoucherLine.insertMany(lines, { session });

      console.log(
        `Created opening voucher for account ${acc.code} (${acc.name}): ${amount}`,
      );
    }

    await session.commitTransaction();
    console.log("Migration completed successfully.");
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// Run the migration
(async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://antab_agro:antab_agro@factory.24tvhbm.mongodb.net/?appName=Factory",
    ); // replace with your DB
    await migrateOpeningBalances();
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();
