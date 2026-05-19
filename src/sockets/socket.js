import { Server } from "socket.io";

export const onlineUsers = new Map();

let io;

export const initSocket = (server, allowedOrigins) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket Connected:", socket.id);

    const userId = socket.handshake.auth.userId;
    console.log("Handshake auth:", socket.handshake.auth);

    if (userId) {
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, []);
      }

      onlineUsers.get(userId).push(socket.id);

      console.log("User Connected:", userId);
    }

    socket.on("disconnect", () => {
      console.log("Socket Disconnected:", socket.id);

      if (userId) {
        const sockets = onlineUsers.get(userId) || [];
        const updated = sockets.filter(id => id !== socket.id);

        if (updated.length === 0) {
          onlineUsers.delete(userId);
        } else {
          onlineUsers.set(userId, updated);
        }
      }
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};