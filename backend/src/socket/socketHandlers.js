const { verifyToken } = require("../utils/jwt");

// roomId -> Set of socket IDs
const rooms = new Map();
// socketId -> { userId, username, roomId }
const socketUserMap = new Map();
// userId -> { socketId, username } (for direct calls + online users)
const userSocketMap = new Map();

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));
    try {
      socket.user = verifyToken(token);
      next();
    } catch {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const { id: userId, username } = socket.user;
    userSocketMap.set(String(userId), { socketId: socket.id, username });
    console.log(`User connected: ${username} (${socket.id})`);
    emitOnlineUsers(io);

    // ─── Room Events ───────────────────────────────────────────────────────────
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      if (!rooms.has(roomId)) rooms.set(roomId, new Set());
      rooms.get(roomId).add(socket.id);
      socketUserMap.set(socket.id, { userId, username, roomId });

      // Notify others in room
      socket.to(roomId).emit("user-joined", { socketId: socket.id, username });

      // Send current users list to the joining user
      const usersInRoom = [];
      rooms.get(roomId).forEach((sid) => {
        if (sid !== socket.id && socketUserMap.has(sid)) {
          usersInRoom.push({
            socketId: sid,
            username: socketUserMap.get(sid).username,
          });
        }
      });
      socket.emit("room-users", usersInRoom);
    });

    socket.on("leave-room", (roomId) => {
      leaveRoom(socket, roomId, io);
    });

    // ─── WebRTC Signaling ──────────────────────────────────────────────────────
    socket.on("offer", ({ to, offer }) => {
      io.to(to).emit("offer", { from: socket.id, offer, username });
    });

    socket.on("answer", ({ to, answer }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", { from: socket.id, candidate });
    });

    // ─── Camera / Mic State ────────────────────────────────────────────────────
    socket.on("camera-toggle", ({ roomId, enabled }) => {
      socket.to(roomId).emit("peer-camera-toggle", {
        socketId: socket.id,
        enabled,
      });
    });

    socket.on("mic-toggle", ({ roomId, enabled }) => {
      socket.to(roomId).emit("peer-mic-toggle", {
        socketId: socket.id,
        enabled,
      });
    });

    // ─── Direct Call Events ────────────────────────────────────────────────────
    socket.on("get-online-users", () => {
      socket.emit("online-users", getOnlineUsers());
    });

    socket.on("call-user", ({ to, roomId }) => {
      const target = userSocketMap.get(String(to));
      if (target?.socketId) {
        io.to(target.socketId).emit("incoming-call", {
          from: socket.id,
          callerId: userId,
          callerName: username,
          roomId,
        });
      } else {
        socket.emit("call-failed", { message: "User is not online" });
      }
    });

    socket.on("call-accepted", ({ to, roomId }) => {
      io.to(to).emit("call-accepted", { from: socket.id, roomId });
    });

    socket.on("call-rejected", ({ to }) => {
      io.to(to).emit("call-rejected", { from: socket.id });
    });

    socket.on("call-ended", ({ to }) => {
      io.to(to).emit("call-ended", { from: socket.id });
    });

    // ─── Disconnect ────────────────────────────────────────────────────────────
    socket.on("disconnect", () => {
      const userData = socketUserMap.get(socket.id);
      if (userData) {
        leaveRoom(socket, userData.roomId, io);
      }
      const current = userSocketMap.get(String(userId));
      if (current?.socketId === socket.id) {
        userSocketMap.delete(String(userId));
      }
      emitOnlineUsers(io);
      console.log(`User disconnected: ${username} (${socket.id})`);
    });
  });
}

function getOnlineUsers() {
  return Array.from(userSocketMap.entries()).map(([id, data]) => ({
    id: Number(id),
    username: data.username,
  }));
}

function emitOnlineUsers(io) {
  io.emit("online-users", getOnlineUsers());
}

function leaveRoom(socket, roomId, io) {
  if (!roomId || !rooms.has(roomId)) return;
  rooms.get(roomId).delete(socket.id);
  if (rooms.get(roomId).size === 0) rooms.delete(roomId);
  socketUserMap.delete(socket.id);
  socket.leave(roomId);
  socket.to(roomId).emit("user-left", { socketId: socket.id });
}

module.exports = { registerSocketHandlers };
