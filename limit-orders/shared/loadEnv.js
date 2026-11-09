const path = require("path");
const dotenv = require("dotenv");

function loadLimitOrdersEnv(customPath) {
  const envPath = customPath || path.resolve(__dirname, "../.env");
  return dotenv.config({ path: envPath });
}

loadLimitOrdersEnv();

module.exports = { loadLimitOrdersEnv };
