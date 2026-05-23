import { cloneElement, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SimplePeer from "simple-peer/simplepeer.min.js";
import toast from "react-hot-toast";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";
import { getPeerRtcConfig } from "../utils/webrtcConfig";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  ArrowLeft,
  Copy,
  Camera,
  Circle,
  Square,
} from "lucide-react";

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user } = useAuth();

  const [room, setRoom] = useState(null);
  const [peers, setPeers] = useState([]); // [{ socketId, username, peer, camOn, micOn }]
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const localVideoRef = useRef();
  const peersRef = useRef([]);
  const streamRef = useRef();
  const videoGridRef = useRef();
  const [capturing, setCapturing] = useState(false);

  // ── Recording ──
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingCanvasRef = useRef(null);
  const recordingRafRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef(null);

  const isDirectCallRoom = room?.name?.startsWith("Call:");
  const primaryRemotePeer = peers[0];

  // Fetch room details
  useEffect(() => {
    api
      .get(`/rooms/${roomId}`)
      .then((r) => setRoom(r.data))
      .catch(() => {
        toast.error("Room not found");
        navigate("/");
      });
  }, [roomId]);

  // Get local media and join room
  useEffect(() => {
    if (!socket) return;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        socket.emit("join-room", roomId);
      })
      .catch(() => {
        toast.error("Could not access camera/microphone");
        // Join without media
        socket.emit("join-room", roomId);
      });

    return () => {
      socket.emit("leave-room", roomId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach(({ peer }) => peer.destroy());
      peersRef.current = [];
      setPeers([]);
    };
    // also stop any in-progress recording
    cancelAnimationFrame(recordingRafRef.current);
    clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [socket, roomId]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on("room-users", (users) => {
      // Create peer for each existing user
      users.forEach(({ socketId, username }) => {
        if (peersRef.current.find((p) => p.socketId === socketId)) return;
        const peer = createPeer(socketId, socket, streamRef.current);
        peersRef.current.push({ socketId, username, peer });
        setPeers([...peersRef.current]);
      });
    });

    socket.on("user-joined", ({ socketId, username }) => {
      toast(`${username} joined the room`, { icon: "👋" });
    });

    socket.on("user-left", ({ socketId }) => {
      const entry = peersRef.current.find((p) => p.socketId === socketId);
      if (entry) {
        entry.peer.destroy();
        toast(`${entry.username} left the room`);
      }
      peersRef.current = peersRef.current.filter(
        (p) => p.socketId !== socketId,
      );
      setPeers([...peersRef.current]);
    });

    socket.on("offer", ({ from, offer, username }) => {
      if (peersRef.current.find((p) => p.socketId === from)) return;
      const peer = addPeer(from, offer, socket, streamRef.current);
      peersRef.current.push({ socketId: from, username, peer });
      setPeers([...peersRef.current]);
    });

    socket.on("answer", ({ from, answer }) => {
      const entry = peersRef.current.find((p) => p.socketId === from);
      if (entry) entry.peer.signal(answer);
    });

    socket.on("ice-candidate", ({ from, candidate }) => {
      const entry = peersRef.current.find((p) => p.socketId === from);
      if (entry && candidate) entry.peer.signal(candidate);
    });

    socket.on("peer-camera-toggle", ({ socketId, enabled }) => {
      peersRef.current = peersRef.current.map((p) =>
        p.socketId === socketId ? { ...p, camOn: enabled } : p,
      );
      setPeers([...peersRef.current]);
    });

    socket.on("peer-mic-toggle", ({ socketId, enabled }) => {
      peersRef.current = peersRef.current.map((p) =>
        p.socketId === socketId ? { ...p, micOn: enabled } : p,
      );
      setPeers([...peersRef.current]);
    });

    return () => {
      socket.off("room-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("peer-camera-toggle");
      socket.off("peer-mic-toggle");
    };
  }, [socket]);

  function createPeer(targetSocketId, socket, stream) {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream: stream || undefined,
      config: getPeerRtcConfig(),
    });

    peer.on("signal", (data) => {
      if (data.type === "offer") {
        socket.emit("offer", { to: targetSocketId, offer: data });
      } else {
        socket.emit("ice-candidate", { to: targetSocketId, candidate: data });
      }
    });

    peer.on("stream", (remoteStream) => {
      setPeers((prev) =>
        prev.map((p) =>
          p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p,
        ),
      );
      peersRef.current = peersRef.current.map((p) =>
        p.socketId === targetSocketId ? { ...p, stream: remoteStream } : p,
      );
    });

    peer.on("error", (err) => console.error("Peer error:", err));

    return peer;
  }

  function addPeer(fromSocketId, offer, socket, stream) {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream: stream || undefined,
      config: getPeerRtcConfig(),
    });

    peer.on("signal", (data) => {
      if (data.type === "answer") {
        socket.emit("answer", { to: fromSocketId, answer: data });
      } else {
        socket.emit("ice-candidate", { to: fromSocketId, candidate: data });
      }
    });

    peer.on("stream", (remoteStream) => {
      setPeers((prev) =>
        prev.map((p) =>
          p.socketId === fromSocketId ? { ...p, stream: remoteStream } : p,
        ),
      );
      peersRef.current = peersRef.current.map((p) =>
        p.socketId === fromSocketId ? { ...p, stream: remoteStream } : p,
      );
    });

    peer.on("error", (err) => console.error("Peer error:", err));
    peer.signal(offer);

    return peer;
  }

  const toggleCam = () => {
    if (!streamRef.current) return;
    const next = !camOn;
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
    // Notify other participants
    const userData = Array.from(socket?.rooms ?? []).find(
      (r) => r !== socket?.id,
    );
    const rid = roomId;
    socket?.emit("camera-toggle", { roomId: rid, enabled: next });
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const next = !micOn;
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
    socket?.emit("mic-toggle", { roomId, enabled: next });
  };

  // ── Recording helpers ─────────────────────────────────────────────────────

  const startRecording = () => {
    if (recording) return;

    const grid = videoGridRef.current;
    if (!grid) {
      toast.error("Video grid not ready");
      return;
    }

    const width = grid.offsetWidth || 1280;
    const height = grid.offsetHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    recordingCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d");

    const paint = () => {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, width, height);

      const videoEls = Array.from(grid.querySelectorAll("video"));
      const gridRect = grid.getBoundingClientRect();

      for (const vid of videoEls) {
        if (vid.readyState < 2) continue;
        const rect = vid.getBoundingClientRect();
        const x = rect.left - gridRect.left;
        const y = rect.top - gridRect.top;

        try {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, rect.width, rect.height, 12);
          ctx.clip();
          ctx.drawImage(vid, x, y, rect.width, rect.height);
          ctx.restore();
        } catch {
          // skip tiles that cannot be drawn
        }
      }

      recordingRafRef.current = requestAnimationFrame(paint);
    };

    paint();

    const canvasStream = canvas.captureStream(30);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        canvasStream.addTrack(track);
      });
    }

    const mimeType =
      [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type)) || "";

    recordedChunksRef.current = [];
    const recorder = new MediaRecorder(
      canvasStream,
      mimeType ? { mimeType } : {},
    );

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${room?.name || roomId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Recording saved!");
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;

    setRecordSeconds(0);
    recordTimerRef.current = setInterval(() => {
      setRecordSeconds((seconds) => seconds + 1);
    }, 1000);

    setRecording(true);
    toast("Recording started", { icon: "🔴" });
  };

  const stopRecording = () => {
    if (!recording) return;

    cancelAnimationFrame(recordingRafRef.current);
    clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setRecording(false);
    setRecordSeconds(0);
  };

  const fmtTime = (seconds) => {
    const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
    const remainingSeconds = String(seconds % 60).padStart(2, "0");
    return `${minutes}:${remainingSeconds}`;
  };

  const leaveRoom = () => {
    stopRecording();
    navigate("/");
  };

  const takeScreenshot = async () => {
    if (capturing) return;
    setCapturing(true);

    try {
      const grid = videoGridRef.current;
      if (!grid) {
        toast.error("Nothing to capture");
        return;
      }

      // Collect all video elements inside the grid
      const videoEls = Array.from(grid.querySelectorAll("video"));
      if (videoEls.length === 0) {
        toast.error("No active video to capture");
        return;
      }

      // Build a composite canvas sized to the grid's bounding box
      const gridRect = grid.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = gridRect.width * scale;
      canvas.height = gridRect.height * scale;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        toast.error("Screenshot unavailable");
        return;
      }

      ctx.scale(scale, scale);

      // Fill background
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, gridRect.width, gridRect.height);

      // Draw each visible video tile
      for (const vid of videoEls) {
        if (vid.readyState < 2) continue;
        const rect = vid.getBoundingClientRect();
        const x = rect.left - gridRect.left;
        const y = rect.top - gridRect.top;
        try {
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(x, y, rect.width, rect.height, 12);
          ctx.clip();
          ctx.drawImage(vid, x, y, rect.width, rect.height);
          ctx.restore();
        } catch {
          // Skip tiles that cannot be drawn.
        }
      }

      // Timestamp watermark
      const ts = new Date().toLocaleString();
      ctx.font = "11px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.fillText(
        `${room?.name || roomId}  •  ${ts}`,
        10,
        gridRect.height - 8,
      );

      // Download
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `screenshot-${room?.name || roomId}-${Date.now()}.png`;
      a.click();

      toast.success("Screenshot saved!");
    } catch (err) {
      console.error("Screenshot error:", err);
      toast.error("Screenshot failed");
    } finally {
      setCapturing(false);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success("Room ID copied!");
  };

  return (
    <div className="min-h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header
        className={`border-b border-white/10 px-6 py-3 flex items-center justify-between z-20 ${
          isDirectCallRoom
            ? "absolute inset-x-0 top-0 bg-black/35 backdrop-blur-md"
            : "bg-gray-800"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-gray-400 hover:text-white transition"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="font-semibold">{room?.name || "Loading..."}</p>
            <div className="flex items-center gap-1">
              <code className="text-xs text-gray-500 font-mono">{roomId}</code>
              <button
                onClick={copyRoomId}
                className="text-gray-500 hover:text-gray-300"
              >
                <Copy size={11} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Users size={16} />
          <span>
            {peers.length + 1} participant{peers.length !== 0 ? "s" : ""}
          </span>
        </div>
      </header>

      {/* Video Grid */}
      <div className={`flex-1 ${isDirectCallRoom ? "relative" : "p-4"}`}>
        <div
          ref={videoGridRef}
          className={`h-full ${
            isDirectCallRoom
              ? "relative w-full h-full bg-black pt-16 pb-28 sm:pt-16 sm:pb-0"
              : `grid gap-4 ${
                  peers.length === 0
                    ? "grid-cols-1 max-w-2xl mx-auto"
                    : peers.length === 1
                      ? "grid-cols-2"
                      : peers.length <= 3
                        ? "grid-cols-2"
                        : "grid-cols-3"
                }`
          }`}
        >
          {isDirectCallRoom ? (
            <>
              {/* Main remote video fills the screen */}
              <div className="absolute inset-0 bg-black">
                {primaryRemotePeer ? (
                  <RemoteVideo
                    key={primaryRemotePeer.socketId}
                    stream={primaryRemotePeer.stream}
                    username={primaryRemotePeer.username}
                    camOn={primaryRemotePeer.camOn !== false}
                    micOn={primaryRemotePeer.micOn !== false}
                    fullScreen
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-black">
                    <div className="text-center text-slate-300">
                      <div className="mx-auto mb-4 w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center text-2xl font-bold">
                        {room?.name?.[0]?.toUpperCase() || "C"}
                      </div>
                      <p className="text-lg font-medium">Connecting...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Self preview like WhatsApp */}
              <div className="absolute right-3 bottom-24 sm:right-6 sm:bottom-6 z-10 w-24 h-32 sm:w-44 sm:h-auto sm:aspect-video rounded-xl sm:rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-gray-900">
                <div className="relative w-full h-full bg-gray-800">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${!camOn ? "hidden" : ""}`}
                  />
                  {!camOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gray-700 flex items-center justify-center text-lg sm:text-xl font-bold text-white">
                        {user?.username?.[0]?.toUpperCase()}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg max-w-[calc(100%-1rem)] truncate">
                    You {!micOn && "🔇"}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Local Video */}
              <div className="relative bg-gray-800 rounded-2xl overflow-hidden aspect-video">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover ${!camOn ? "hidden" : ""}`}
                />
                {!camOn && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold">
                      {user?.username?.[0]?.toUpperCase()}
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                  You {!micOn && "🔇"}
                </div>
              </div>

              {/* Remote Videos */}
              {peers.map(
                ({
                  socketId,
                  username,
                  stream,
                  camOn: peerCamOn,
                  micOn: peerMicOn,
                }) => (
                  <RemoteVideo
                    key={socketId}
                    stream={stream}
                    username={username}
                    camOn={peerCamOn !== false}
                    micOn={peerMicOn !== false}
                  />
                ),
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/70 backdrop-blur-md px-3 py-3 sm:static sm:bg-gray-800 sm:border-gray-700 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-4">
          {/* Mic toggle */}
          <ControlBtn
            onClick={toggleMic}
            active={micOn}
            label={micOn ? "Mute" : "Unmute"}
            icon={micOn ? <Mic size={20} /> : <MicOff size={20} />}
            compact
          />

          {/* Camera toggle */}
          <ControlBtn
            onClick={toggleCam}
            active={camOn}
            label={camOn ? "Camera Off" : "Camera On"}
            icon={camOn ? <Video size={20} /> : <VideoOff size={20} />}
            compact
          />

          {/* Screenshot */}

          {/* Record */}
          {recording ? (
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={stopRecording}
                className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition ring-2 ring-red-400 ring-offset-2 ring-offset-gray-800"
              >
                <Square size={20} className="fill-white" />
              </button>
              <span className="text-xs text-red-400 flex items-center gap-1 font-mono">
                <Circle size={8} className="fill-red-400 animate-pulse" />
                {fmtTime(recordSeconds)}
              </span>
            </div>
          ) : (
            <ControlBtn
              onClick={startRecording}
              active={true}
              label="Record"
              icon={<Circle size={20} className="text-red-400" />}
              compact
            />
          )}

          {/* Screenshot */}
          <ControlBtn
            onClick={takeScreenshot}
            active={true}
            label={capturing ? "Saving..." : "Screenshot"}
            icon={
              <Camera size={20} className={capturing ? "animate-pulse" : ""} />
            }
            compact
          />

          {/* Leave */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={leaveRoom}
              className="p-3 sm:p-4 rounded-full bg-red-600 hover:bg-red-700 transition"
            >
              <PhoneOff size={18} className="sm:w-5 sm:h-5" />
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400">Leave</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function RemoteVideo({
  stream,
  username,
  camOn = true,
  micOn = true,
  fullScreen = false,
}) {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const showVideo = stream && camOn;

  return (
    <div
      className={`relative overflow-hidden ${
        fullScreen
          ? "w-full h-full bg-black"
          : "bg-gray-800 rounded-2xl aspect-video"
      }`}
    >
      {/* Video element — always mounted when stream exists so it stays connected */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transition-opacity ${
            showVideo ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Avatar overlay when camera is off or no stream yet */}
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-white">
            {username?.[0]?.toUpperCase()}
          </div>
          {!camOn && stream && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <VideoOff size={12} /> Camera off
            </span>
          )}
          {!stream && (
            <span className="text-xs text-gray-500">Connecting...</span>
          )}
        </div>
      )}

      {/* Name tag */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
        <span>{username}</span>
        {!micOn && <MicOff size={11} className="text-red-400" />}
        {!camOn && <VideoOff size={11} className="text-red-400" />}
      </div>
    </div>
  );
}

function ControlBtn({ onClick, active, icon, label, compact = false }) {
  return (
    <div
      className={`flex flex-col items-center ${compact ? "gap-0.5" : "gap-1"}`}
    >
      <button
        onClick={onClick}
        className={`p-4 rounded-full transition ${
          active
            ? "bg-gray-700 hover:bg-gray-600"
            : "bg-red-600 hover:bg-red-700"
        } ${compact ? "p-3 sm:p-4" : ""}`}
      >
        {compact ? cloneElement(icon, { size: 18 }) : icon}
      </button>
      <span className="text-[10px] sm:text-xs text-gray-400 max-w-[4.5rem] text-center leading-tight">
        {label}
      </span>
    </div>
  );
}
