import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext();

function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:5000`;
  }

  return "http://localhost:5000";
}

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }

    const token = localStorage.getItem("token");
    const s = io(resolveSocketUrl(), {
      auth: { token },
      reconnectionAttempts: 5,
    });

    s.on("connect", () => {
      s.emit("get-online-users");
    });

    s.on("online-users", (users) => {
      setOnlineUsers(Array.isArray(users) ? users : []);
    });

    socketRef.current = s;
    setSocket(s);

    return () => {
      s.off("online-users");
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
      setOnlineUsers([]);
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
