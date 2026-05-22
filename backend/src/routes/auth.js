const express = require("express");
const authMiddleware = require("../middleware/auth");
const {
  register,
  login,
  getMe,
  getUsers,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/users", authMiddleware, getUsers);

module.exports = router;
