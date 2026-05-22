import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Shield,
  Users,
  Video,
  Trash2,
  LogOut,
  RefreshCw,
  Home,
  ChevronDown,
  Activity,
  UserCog,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

export default function AdminPanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("users"); // 'users' | 'rooms'
  const [users, setUsers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // ─── Fetch helpers ────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/rooms");
      setRooms(res.data);
    } catch {
      toast.error("Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchUsers();
    fetchRooms();
  }, [fetchStats, fetchUsers, fetchRooms]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const changeRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      toast.success("Role updated");
      fetchUsers();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update role");
    }
  };

  const removeUser = async (id, username) => {
    if (!confirm(`Delete user "${username}" and all their rooms?`)) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast.success("User deleted");
      fetchUsers();
      fetchRooms();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete user");
    }
  };

  const removeRoom = async (roomId, name) => {
    if (!confirm(`Delete room "${name}"?`)) return;
    try {
      await api.delete(`/admin/rooms/${roomId}`);
      toast.success("Room deleted");
      fetchRooms();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete room");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const fmt = (iso) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* gradient */}
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b from-violet-500/10 to-transparent" />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur px-6 py-4 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-violet-600 p-2.5 rounded-xl shadow-lg shadow-violet-600/30">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-xl leading-none">Admin Panel</p>
              <p className="text-xs text-slate-400 mt-1">Full system control</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition text-sm border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-800"
            >
              <Home size={15} /> Dashboard
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition text-sm border border-slate-700 rounded-lg px-3 py-2 hover:bg-slate-800"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Welcome */}
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/60 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back,{" "}
              <span className="text-violet-400">{user?.username}</span>
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              You have full administrative access to all users and rooms.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity size={14} className="text-violet-400" />
            <span className="text-violet-300 font-medium">ADMIN</span>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats?.totalUsers ?? "–"}
            color="text-sky-300"
            icon={<Users size={16} className="text-sky-300" />}
          />
          <StatCard
            label="Regular Users"
            value={stats?.userCount ?? "–"}
            color="text-slate-300"
            icon={<Users size={16} className="text-slate-300" />}
          />
          <StatCard
            label="Admins"
            value={stats?.adminCount ?? "–"}
            color="text-violet-300"
            icon={<Shield size={16} className="text-violet-300" />}
          />
          <StatCard
            label="Total Rooms"
            value={stats?.totalRooms ?? "–"}
            color="text-emerald-300"
            icon={<Video size={16} className="text-emerald-300" />}
          />
        </section>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 pb-0">
          {["users", "rooms"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition capitalize ${
                tab === t
                  ? "bg-slate-800 text-white border border-b-0 border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "users" ? (
                <span className="flex items-center gap-1.5">
                  <Users size={14} /> Users ({users.length})
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Video size={14} /> Rooms ({rooms.length})
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => {
              if (tab === "users") fetchUsers();
              else fetchRooms();
            }}
            disabled={loading}
            className="ml-auto text-slate-400 hover:text-white transition border border-slate-700 rounded-lg p-2 hover:bg-slate-800 disabled:opacity-50 mb-1"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Users Table */}
        {tab === "users" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {users.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                {loading ? "Loading..." : "No users found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">User</th>
                      <th className="px-5 py-3 text-left">Email</th>
                      <th className="px-5 py-3 text-left">Role</th>
                      <th className="px-5 py-3 text-left">Rooms</th>
                      <th className="px-5 py-3 text-left">Joined</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 transition"
                      >
                        <td className="px-5 py-3 font-medium">{u.username}</td>
                        <td className="px-5 py-3 text-slate-400">{u.email}</td>
                        <td className="px-5 py-3">
                          <RoleBadge role={u.role} />
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {u._count?.rooms ?? 0}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {fmt(u.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* only allow changing role of others */}
                            {u.id !== user.id && (
                              <RoleDropdown
                                current={u.role}
                                onChange={(role) => changeRole(u.id, role)}
                              />
                            )}
                            {u.id !== user.id && (
                              <button
                                onClick={() => removeUser(u.id, u.username)}
                                className="text-red-400 hover:text-red-300 transition p-1.5 rounded hover:bg-red-900/30"
                                title="Delete user"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                            {u.id === user.id && (
                              <span className="text-xs text-slate-500 italic">
                                (you)
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Rooms Table */}
        {tab === "rooms" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {rooms.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                {loading ? "Loading..." : "No rooms found."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Room Name</th>
                      <th className="px-5 py-3 text-left">Room ID</th>
                      <th className="px-5 py-3 text-left">Created By</th>
                      <th className="px-5 py-3 text-left">Created</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-800/60 hover:bg-slate-800/40 transition"
                      >
                        <td className="px-5 py-3 font-medium">{r.name}</td>
                        <td className="px-5 py-3">
                          <code className="text-xs text-slate-300 bg-slate-800 px-2 py-0.5 rounded">
                            {r.roomId}
                          </code>
                        </td>
                        <td className="px-5 py-3 text-slate-400">
                          {r.creator?.username}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
                          {fmt(r.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => removeRoom(r.roomId, r.name)}
                            className="text-red-400 hover:text-red-300 transition p-1.5 rounded hover:bg-red-900/30"
                            title="Delete room"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider text-slate-400">
          {label}
        </p>
        {icon}
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RoleBadge({ role }) {
  return role === "ADMIN" ? (
    <span className="inline-flex items-center gap-1 text-xs bg-violet-900/50 text-violet-300 border border-violet-700 rounded px-2 py-0.5">
      <Shield size={11} /> ADMIN
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-0.5">
      <UserCog size={11} /> USER
    </span>
  );
}

function RoleDropdown({ current, onChange }) {
  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-slate-800 border border-slate-700 text-xs rounded px-2 py-1.5 pr-6 focus:outline-none focus:border-violet-500 cursor-pointer"
      >
        <option value="USER">USER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <ChevronDown
        size={12}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
    </div>
  );
}
