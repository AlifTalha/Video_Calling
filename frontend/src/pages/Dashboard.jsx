import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import api from "../utils/api";
import {
  Video,
  LogOut,
  Plus,
  Users,
  Copy,
  Hash,
  RefreshCw,
  PhoneCall,
  Search,
  CalendarDays,
  Activity,
  DoorOpen,
  Shield,
} from "lucide-react";
import IncomingCallModal from "../components/IncomingCallModal";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [joinId, setJoinId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  const fetchRooms = async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await api.get("/rooms");
      setRooms(res.data);
    } catch {
      toast.error("Failed to load rooms");
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRooms(true);
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("incoming-call", (data) => {
      setIncomingCall(data);
      toast("Incoming call from " + data.callerName, { icon: "📞" });
    });
    return () => socket.off("incoming-call");
  }, [socket]);

  const createRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/rooms/create", { name: roomName });
      toast.success("Room created!");
      setRoomName("");
      fetchRooms(true);
      navigate(`/room/${res.data.roomId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    navigate(`/room/${joinId.trim()}`);
  };

  const copyRoomId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success("Room ID copied!");
  };

  const filteredRooms = rooms.filter((room) => {
    const text = search.trim().toLowerCase();
    if (!text) return true;
    return (
      room.name?.toLowerCase().includes(text) ||
      room.roomId?.toLowerCase().includes(text) ||
      room.creator?.username?.toLowerCase().includes(text)
    );
  });

  const myRoomsCount = rooms.filter(
    (room) => room.creator?.username === user?.username,
  ).length;

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-sky-500/10 to-transparent" />

      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-sky-600 p-2.5 rounded-xl shadow-lg shadow-sky-600/30">
              <Video size={20} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-xl leading-none">VideoCall</p>
              <p className="text-xs text-slate-400 mt-1">
                Realtime meeting dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-sm hidden sm:block">
              Welcome,{" "}
              <span className="text-white font-semibold">{user?.username}</span>
              {user?.role === "ADMIN" && (
                <span className="ml-2 inline-flex items-center gap-1 text-xs bg-violet-900/50 text-violet-300 border border-violet-700 rounded px-1.5 py-0.5">
                  <Shield size={10} /> ADMIN
                </span>
              )}
            </span>
            {user?.role === "ADMIN" && (
              <button
                onClick={() => navigate("/admin")}
                className="flex items-center gap-2 text-violet-300 hover:text-white transition text-sm border border-violet-700 rounded-lg px-3 py-2 hover:bg-violet-900/40"
              >
                <Shield size={15} /> Admin Panel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition text-sm border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-800"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/60 p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Ready to start your next call?
            </h1>
            <p className="text-slate-400 mt-1 text-sm md:text-base">
              Create a room and share the room ID, or join an existing room
              instantly.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity size={14} className="text-emerald-400" />
            {socket?.connected
              ? "Signaling server connected"
              : "Reconnecting signaling server..."}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            title="Total Rooms"
            value={rooms.length}
            icon={<Users size={18} className="text-sky-300" />}
          />
          <StatCard
            title="Rooms You Created"
            value={myRoomsCount}
            icon={<Plus size={18} className="text-violet-300" />}
          />
          <StatCard
            title="Connection Status"
            value={socket?.connected ? "Online" : "Offline"}
            icon={
              <Activity
                size={18}
                className={
                  socket?.connected ? "text-emerald-300" : "text-amber-300"
                }
              />
            }
          />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-4 space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Plus size={20} className="text-sky-400" /> Create Room
              </h2>
              <form onSubmit={createRoom} className="space-y-3">
                <input
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-sky-500 text-sm"
                  placeholder="Room name..."
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded-lg py-2.5 text-sm font-medium transition"
                >
                  {loading ? "Creating..." : "Create & Join"}
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <DoorOpen size={20} className="text-emerald-400" /> Join with
                Room ID
              </h2>
              <form onSubmit={joinRoom} className="space-y-3">
                <input
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 text-sm"
                  placeholder="Enter room ID..."
                />
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-lg py-2.5 text-sm font-medium transition"
                >
                  Join Room
                </button>
              </form>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h3 className="font-medium text-slate-100 mb-3">Pro tips</h3>
              <ul className="text-sm text-slate-400 space-y-2">
                <li>Use a short room name so teammates can find it quickly.</li>
                <li>Copy room ID and share it directly in chat.</li>
                <li>Allow camera and microphone permissions when prompted.</li>
              </ul>
            </div>
          </section>

          <section className="xl:col-span-8">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Users size={20} className="text-violet-400" /> Available
                  Rooms
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search room, ID, creator"
                      className="w-64 max-w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-violet-500"
                    />
                  </div>
                  <button
                    onClick={() => fetchRooms()}
                    disabled={refreshing}
                    className="text-slate-300 hover:text-white transition border border-slate-700 rounded-lg p-2 hover:bg-slate-800 disabled:opacity-60"
                    title="Refresh rooms"
                  >
                    <RefreshCw
                      size={16}
                      className={refreshing ? "animate-spin" : ""}
                    />
                  </button>
                </div>
              </div>

              {filteredRooms.length === 0 ? (
                <div className="text-center py-16 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  <Video size={42} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    {rooms.length === 0
                      ? "No rooms yet. Create your first room."
                      : "No rooms match your search."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRooms.map((room) => (
                    <div
                      key={room.id}
                      className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:border-slate-600 transition"
                    >
                      <div>
                        <p className="font-semibold text-slate-100">
                          {room.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <CalendarDays size={12} />
                          Created by {room.creator?.username ||
                            "Unknown"} on {formatDate(room.createdAt)}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <code className="text-xs text-slate-300 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-700">
                            {room.roomId}
                          </code>
                          <button
                            onClick={() => copyRoomId(room.roomId)}
                            className="text-slate-400 hover:text-slate-200 transition"
                            title="Copy room ID"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/room/${room.roomId}`)}
                        className="inline-flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        <PhoneCall size={14} /> Join
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onClose={() => setIncomingCall(null)}
        />
      )}
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-400">
          {title}
        </p>
        {icon}
      </div>
      <p className="text-2xl font-semibold mt-2">{value}</p>
    </div>
  );
}
