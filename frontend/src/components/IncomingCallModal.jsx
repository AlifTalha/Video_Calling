import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video } from "lucide-react";

export default function IncomingCallModal({ call, onClose }) {
  const { socket } = useSocket();
  const navigate = useNavigate();

  const acceptCall = () => {
    socket.emit("call-accepted", { to: call.from, roomId: call.roomId });
    toast.success("Call accepted");
    onClose();
    navigate(`/room/${call.roomId}`);
  };

  const rejectCall = () => {
    socket.emit("call-rejected", { to: call.from });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl w-80 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Video size={28} />
        </div>
        <h3 className="text-xl font-bold mb-1">Incoming Call</h3>
        <p className="text-gray-400 mb-8">{call.callerName} is calling you</p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={rejectCall}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 px-5 py-3 rounded-full transition font-medium"
          >
            <PhoneOff size={18} /> Decline
          </button>
          <button
            onClick={acceptCall}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-5 py-3 rounded-full transition font-medium"
          >
            <Phone size={18} /> Accept
          </button>
        </div>
      </div>
    </div>
  );
}
