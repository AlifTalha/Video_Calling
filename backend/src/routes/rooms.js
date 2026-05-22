const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  createRoom,
  getRooms,
  getRoomById,
  deleteRoom,
} = require("../controllers/roomController");

const router = express.Router();

router.use(authMiddleware);

router.post("/create", createRoom);
router.get("/", getRooms);
router.get("/:roomId", getRoomById);
router.delete("/:roomId", deleteRoom);

module.exports = router;
