export const onlineUsers = new Map();

export const initializeSocket = (io) => {

  io.on("connection", (socket) => {

    console.log("Socket Connected:", socket.id);

    /* ---------- REGISTER USER ---------- */

    socket.on("registerUser", ({ userId }) => {

      if (!userId) return;

      const existingSockets =
        onlineUsers.get(userId) || [];

      /* Prevent duplicate socket ids */

      if (!existingSockets.includes(socket.id)) {
        existingSockets.push(socket.id);
      }

      onlineUsers.set(
        userId,
        existingSockets
      );

      console.log("Online Users:", onlineUsers);
    });

    /* ---------- DISCONNECT ---------- */

    socket.on("disconnect", () => {

      console.log(
        "Socket Disconnected:",
        socket.id
      );

      for (const [userId, sockets] of onlineUsers.entries()) {

        /* Remove disconnected socket */

        const updatedSockets = sockets.filter(
          (id) => id !== socket.id
        );

        /* Remove user if no sockets left */

        if (updatedSockets.length === 0) {

          onlineUsers.delete(userId);

        } else {

          onlineUsers.set(
            userId,
            updatedSockets
          );
        }
      }

      console.log(
        "Online Users:",
        onlineUsers
      );
    });
  });
};