function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseIceServersJson(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function getIceServers() {
  const fromJson = parseIceServersJson(import.meta.env.VITE_ICE_SERVERS_JSON);
  if (fromJson && fromJson.length > 0) {
    return fromJson;
  }

  const stunUrls = parseCsv(import.meta.env.VITE_STUN_URLS);
  const turnUrls = parseCsv(import.meta.env.VITE_TURN_URLS);
  const turnUsername = import.meta.env.VITE_TURN_USERNAME;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

  const iceServers = [];

  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  } else {
    iceServers.push({ urls: ["stun:stun.l.google.com:19302"] });
  }

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}

export function getPeerRtcConfig() {
  return {
    iceServers: getIceServers(),
  };
}
