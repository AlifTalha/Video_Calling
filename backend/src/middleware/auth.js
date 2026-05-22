const { verifyToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) throw new AppError("No token provided", 401);

  const token = authHeader.split(" ")[1];
  if (!token) throw new AppError("Invalid token format", 401);

  req.user = verifyToken(token);
  next();
}

module.exports = authMiddleware;
