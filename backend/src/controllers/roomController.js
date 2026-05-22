const { v4: uuidv4 } = require("uuid");
const prisma = require("../models/prismaClient");
const AppError = require("../utils/AppError");

/**
 * POST /api/rooms/create
 */
async function createRoom(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) throw new AppError("Room name is required", 400);

  const room = await prisma.room.create({
    data: {
      roomId: uuidv4(),
      name: name.trim(),
      createdBy: req.user.id,
    },
    include: {
      creator: { select: { id: true, username: true } },
    },
  });

  res.status(201).json(room);
}

/**
 * GET /api/rooms
 */
async function getRooms(req, res) {
  const rooms = await prisma.room.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, username: true } },
    },
  });
  res.json(rooms);
}

/**
 * GET /api/rooms/:roomId
 */
async function getRoomById(req, res) {
  const room = await prisma.room.findUnique({
    where: { roomId: req.params.roomId },
    include: {
      creator: { select: { id: true, username: true } },
    },
  });
  if (!room) throw new AppError("Room not found", 404);
  res.json(room);
}

/**
 * DELETE /api/rooms/:roomId
 */
async function deleteRoom(req, res) {
  const room = await prisma.room.findUnique({
    where: { roomId: req.params.roomId },
  });
  if (!room) throw new AppError("Room not found", 404);
  // Admin can delete any room; regular users can only delete their own
  if (req.user.role !== "ADMIN" && room.createdBy !== req.user.id) {
    throw new AppError("Not authorised", 403);
  }

  await prisma.room.delete({ where: { roomId: req.params.roomId } });
  res.json({ message: "Room deleted" });
}

module.exports = { createRoom, getRooms, getRoomById, deleteRoom };
