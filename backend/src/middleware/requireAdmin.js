const AppError = require("../utils/AppError");

function requireAdmin(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    throw new AppError("Admin access required", 403);
  }
  next();
}

module.exports = requireAdmin;
