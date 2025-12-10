import dotenv from "dotenv";
dotenv.config();

export default {
  port: process.env.PORT || 5001,
  mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/antab_agro",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || "access",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "refresh",
    accessExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  },
  verification: {
    expiresIn: process.env.VERIFY_EXPIRES_IN || "1d",
  },
  reset: {
    expiresIn: process.env.RESET_EXPIRES_IN || "1h",
  },
};
