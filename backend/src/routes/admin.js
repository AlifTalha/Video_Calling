const express = require("express");
const authMiddleware = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");
const {
  getAllUsers,
  updateUserRole,
  deleteUser,
  getAllRooms,
  adminDeleteRoom,
  getStats,
} = require("../controllers/adminController");

const router = express.Router();

// All admin routes require auth + admin role
router.use(authMiddleware, requireAdmin);

router.get("/stats", getStats);

router.get("/users", getAllUsers);
router.patch("/users/:id/role", updateUserRole);
router.delete("/users/:id", deleteUser);

router.get("/rooms", getAllRooms);
router.delete("/rooms/:roomId", adminDeleteRoom);

module.exports = router;
