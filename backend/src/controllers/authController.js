const prisma = require("../models/prismaClient");
const { hashPassword, comparePassword } = require("../utils/bcrypt");
const { signToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

/**
 * POST /api/auth/register
 */
async function register(req, res) {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    throw new AppError("username, email and password are required", 400);
  }
  if (password.length < 6) {
    throw new AppError("Password must be at least 6 characters", 400);
  }

  const hashed = await hashPassword(password);

  // Prisma will throw P2002 on duplicate — caught by errorHandler
  const user = await prisma.user.create({
    data: { username, email, password: hashed },
    select: { id: true, username: true, email: true, role: true },
  });

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  res.status(201).json({ token, user });
}

/**
 * POST /api/auth/login
 */
async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError("email and password are required", 400);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new AppError("Invalid credentials", 401);

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new AppError("Invalid credentials", 401);

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
  if (!user) throw new AppError("User not found", 404);
  res.json(user);
}

module.exports = { register, login, getMe };
