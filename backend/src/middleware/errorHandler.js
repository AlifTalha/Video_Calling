const config = require("../config");
const AppError = require("../utils/AppError");

/**
 * Handle Prisma-specific errors and convert them to AppError.
 */
function handlePrismaError(err) {
  // Unique constraint violation
  if (err.code === "P2002") {
    const field = err.meta?.target?.join(", ") || "field";
    return new AppError(`A record with this ${field} already exists.`, 409);
  }
  // Record not found
  if (err.code === "P2025") {
    return new AppError("Record not found.", 404);
  }
  return null;
}

/**
 * Global Express error-handling middleware.
 */
function errorHandler(err, req, res, next) {
  // Prisma errors
  const prismaErr = handlePrismaError(err);
  if (prismaErr) {
    return res
      .status(prismaErr.statusCode)
      .json({ message: prismaErr.message });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Invalid or expired token." });
  }

  // Known operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Unknown / programming errors — don't leak details in production
  console.error("UNHANDLED ERROR:", err);
  const message =
    config.nodeEnv === "development" ? err.message : "Internal server error";
  res.status(500).json({ message });
}

module.exports = errorHandler;
