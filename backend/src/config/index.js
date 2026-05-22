require("dotenv").config();

function parseClientUrls(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const clientUrls = parseClientUrls(
  process.env.CLIENT_URLS || process.env.CLIENT_URL || "http://localhost:5173",
);

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  jwtSecret: process.env.JWT_SECRET || "fallback_secret_change_in_production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: clientUrls[0] || "http://localhost:5173",
  clientUrls,
  nodeEnv: process.env.NODE_ENV || "development",
};

module.exports = config;
