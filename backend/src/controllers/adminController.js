const prisma = require("../models/prismaClient");
const AppError = require("../utils/AppError");

// ─── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users
 */
async function getAllUsers(req, res) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { rooms: true } },
    },
  });
  res.json(users);
}

/**
 * PATCH /api/admin/users/:id/role
 * Body: { role: 'ADMIN' | 'USER' }
 */
async function updateUserRole(req, res) {
  const { role } = req.body;
  if (!["ADMIN", "USER"].includes(role)) {
    throw new AppError("Invalid role. Must be ADMIN or USER", 400);
  }

  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) {
    throw new AppError("You cannot change your own role", 400);
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: { role },
    select: { id: true, username: true, email: true, role: true },
  });
  res.json(user);
}

/**
 * DELETE /api/admin/users/:id
 */
async function deleteUser(req, res) {
  const targetId = parseInt(req.params.id, 10);
  if (targetId === req.user.id) {
    throw new AppError("You cannot delete yourself", 400);
  }

  // Cascade: delete rooms first, then user
  await prisma.room.deleteMany({ where: { createdBy: targetId } });
  await prisma.user.delete({ where: { id: targetId } });

  res.json({ message: "User deleted" });
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/rooms
 */
async function getAllRooms(req, res) {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, username: true, email: true } },
    },
  });
  res.json(rooms);
}

/**
 * DELETE /api/admin/rooms/:roomId
 */
async function adminDeleteRoom(req, res) {
  const room = await prisma.room.findUnique({
    where: { roomId: req.params.roomId },
  });
  if (!room) throw new AppError("Room not found", 404);

  await prisma.room.delete({ where: { roomId: req.params.roomId } });
  res.json({ message: "Room deleted" });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/stats
 */
async function getStats(req, res) {
  const [totalUsers, totalRooms, adminCount] = await Promise.all([
    prisma.user.count(),
    prisma.room.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
  ]);
  res.json({
    totalUsers,
    totalRooms,
    adminCount,
    userCount: totalUsers - adminCount,
  });
}

module.exports = {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllRooms,
  adminDeleteRoom,
  getStats,
};
