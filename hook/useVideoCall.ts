"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type CallState =
  | "idle"
  | "calling"
  | "incoming"
  | "connecting"
  | "active"
  | "ended"
  | "unavailable";

export interface IncomingCallInfo {
  from: string;
  fromName: string;
  fromImage: string;
  _offerSdp: RTCSessionDescriptionInit;
}

interface UseVideoCallOptions {
  currentUserId: string;
  currentUserName: string;
}

const STATIC_ICE_FALLBACK: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turns:openrelay.metered.ca:443",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
];

let cachedIceServers: RTCIceServer[] | null = null;

async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) return cachedIceServers;

  const meteredKey = process.env.NEXT_PUBLIC_METERED_API_KEY;
  if (meteredKey) {
    try {
      const res = await fetch(
        `https://nextjs-threads.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`,
        { signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const servers: RTCIceServer[] = await res.json();
        log("ICE", "#1D9E75", `Metered: loaded ${servers.length} ICE servers`);
        cachedIceServers = servers;
        return servers;
      }
    } catch (e) {
      log("ICE", "#FF4D4D", "Metered fetch failed, falling back:", e);
    }
  }

  const turnHost = process.env.NEXT_PUBLIC_TURN_HOST;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USER;
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turnHost && turnUser && turnCred) {
    cachedIceServers = [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: `turn:${turnHost}:3478`, username: turnUser, credential: turnCred },
      { urls: `turn:${turnHost}:3478?transport=tcp`, username: turnUser, credential: turnCred },
      { urls: `turns:${turnHost}:5349`, username: turnUser, credential: turnCred },
    ];
    log("ICE", "#1D9E75", "self-hosted TURN configured");
    return cachedIceServers;
  }

  log("ICE", "#F59E0B", "no TURN credentials — using static fallback (may fail cross-browser)");
  cachedIceServers = STATIC_ICE_FALLBACK;
  return cachedIceServers;
}

const log = (label: string, color: string, ...args: unknown[]) =>
  console.log(`%c[VC:${label}]`, `color:${color};font-weight:bold`, ...args);

interface SocketEntry { ws: WebSocket; registered: boolean }
const activeSockets = new Map<string, SocketEntry>();

export function useVideoCall({ currentUserId, currentUserName }: UseVideoCallOptions) {
  const wsRef               = useRef<WebSocket | null>(null);
  const pcRef               = useRef<RTCPeerConnection | null>(null);
  const streamRef           = useRef<MediaStream | null>(null);
  const pendingICE          = useRef<RTCIceCandidateInit[]>([]);
  const remoteIsSet         = useRef(false);
  const callStateRef        = useRef<CallState>("idle");
  const remoteIdRef         = useRef<string | null>(null);
  const incomingRef         = useRef<IncomingCallInfo | null>(null);
  const signalingActive     = useRef(false);
  const iceRestartCount     = useRef(0);
  const pendingRemoteStream = useRef<MediaStream | null>(null);
  const iceServersRef       = useRef<RTCIceServer[] | null>(null);

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const [callState,      rawSetCS] = useState<CallState>("idle");
  const [incomingCall,   rawSetIC] = useState<IncomingCallInfo | null>(null);
  const [isMuted,        setIsMuted]      = useState(false);
  const [isCameraOff,    setIsCameraOff]  = useState(false);
  const [remoteHasVideo, setRemoteHasVideo] = useState(false); // ← NEW

  const setCS = useCallback((s: CallState) => {
    log("STATE", "#877EFF", s);
    callStateRef.current = s;
    rawSetCS(s);
  }, []);

  const setIC = useCallback((c: IncomingCallInfo | null) => {
    incomingRef.current = c;
    rawSetIC(c);
  }, []);

  // Pre-fetch ICE servers on mount
  useEffect(() => {
    getIceServers().then(servers => {
      iceServersRef.current = servers;
      log("ICE", "#1D9E75", `pre-fetched ${servers.length} ICE servers`);
    });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const send = useCallback((msg: object): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      log("SEND", "#1D9E75", (msg as any).type, "→", (msg as any).to ?? "—");
      ws.send(JSON.stringify(msg));
      return true;
    }
    log("SEND", "#FF4D4D", `WS not open (${ws?.readyState}), dropping`, (msg as any).type);
    return false;
  }, []);

  const attachRemoteStream = useCallback((stream: MediaStream) => {
    pendingRemoteStream.current = stream;
    const el = remoteVideoRef.current;
    if (el) {
      log("TRACK", "#1D9E75", "attaching remote stream to video element");
      el.srcObject = stream;
    } else {
      log("TRACK", "#697C89", "video element not mounted yet — buffered");
    }
  }, []);

  const flushICE = useCallback(async (pc: RTCPeerConnection) => {
    const buf = pendingICE.current.splice(0);
    if (buf.length) log("ICE", "#697C89", `flushing ${buf.length} buffered candidates`);
    for (const c of buf) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
      catch (e) { log("ICE", "#FF4D4D", "flush error:", e); }
    }
  }, []);

  const doTeardown = useCallback((next: CallState = "ended") => {
    log("TEARDOWN", "#FF4D4D", "→", next);
    signalingActive.current = false;
    iceRestartCount.current = 0;
    try { pcRef.current?.close(); } catch (_) {}
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    pcRef.current  = null;
    streamRef.current = null;
    pendingRemoteStream.current = null;
    if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteIsSet.current = false;
    pendingICE.current  = [];
    setRemoteHasVideo(false); // ← RESET on teardown
    setCS(next);
    setIC(null);
    remoteIdRef.current = null;
  }, [setCS, setIC]);

  const doIceRestart = useCallback(async (pc: RTCPeerConnection, targetId: string) => {
    if (pc.signalingState !== "stable") {
      log("ICE-RESTART", "#F59E0B", "skipping — signalingState:", pc.signalingState);
      return;
    }
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      send({ type: "ice-restart", to: targetId, sdp: offer });
      log("ICE-RESTART", "#1D9E75", "restart offer sent");
    } catch (e) {
      log("ICE-RESTART", "#FF4D4D", "restart failed:", e);
    }
  }, [send]);

  const buildPC = useCallback((targetId: string): RTCPeerConnection => {
    log("PC", "#697C89", "building for", targetId);
    try { pcRef.current?.close(); } catch (_) {}
    remoteIsSet.current = false;
    pendingICE.current  = [];
    pendingRemoteStream.current = null;
    iceRestartCount.current = 0;
    setRemoteHasVideo(false); // ← RESET when building new PC

    const iceServers = iceServersRef.current ?? STATIC_ICE_FALLBACK;
    log("PC", "#697C89", `using ${iceServers.length} ICE servers`);

    const pc = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: "all",
      sdpSemantics: "unified-plan" as any,
      bundlePolicy: "max-bundle",
      rtcpMuxPolicy: "require",
    } as RTCConfiguration);

    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        log("ICE", "#697C89", "local candidate:", e.candidate.type, e.candidate.protocol);
        send({ type: "ice-candidate", to: targetId, candidate: e.candidate.toJSON() });
      } else {
        log("ICE", "#697C89", "gathering complete");
      }
    };

    pc.onicegatheringstatechange = () =>
      log("ICE", "#697C89", "gathering:", pc.iceGatheringState);

    pc.oniceconnectionstatechange = () => {
      log("ICE", "#697C89", "connection:", pc.iceConnectionState);

      if (pc.iceConnectionState === "failed") {
        if (iceRestartCount.current < 2) {
          iceRestartCount.current++;
          log("ICE", "#F59E0B", `restart attempt ${iceRestartCount.current}`);
          doIceRestart(pc, targetId);
        } else {
          log("ICE", "#FF4D4D", "ICE failed after retries — tearing down");
          doTeardown("ended");
          setTimeout(() => setCS("idle"), 1500);
        }
        return;
      }

      if (pc.iceConnectionState === "disconnected") {
        setTimeout(() => {
          if (pcRef.current === pc && pc.iceConnectionState === "disconnected") {
            if (iceRestartCount.current < 2) {
              iceRestartCount.current++;
              log("ICE", "#F59E0B", "still disconnected — restarting ICE");
              doIceRestart(pc, targetId);
            }
          }
        }, 5000);
      }
    };

    pc.onsignalingstatechange = () =>
      log("SIG", "#697C89", "signaling:", pc.signalingState);

    pc.onconnectionstatechange = () => {
      log("PC", "#697C89", "conn:", pc.connectionState);
      if (pc.connectionState === "connected") {
        signalingActive.current = false;
        iceRestartCount.current = 0;
        setCS("active");
      }
      if (pc.connectionState === "failed") {
        log("PC", "#FF4D4D", "connection level failed — tearing down");
        doTeardown("ended");
        setTimeout(() => setCS("idle"), 1500);
      }
    };

    // ← SET remoteHasVideo when a video track arrives
    pc.ontrack = (e) => {
      log("TRACK", "#1D9E75", "remote track:", e.track.kind);
      if (e.track.kind === "video") {
        setRemoteHasVideo(true);
      }
      if (e.streams[0]) attachRemoteStream(e.streams[0]);
    };

    return pc;
  }, [attachRemoteStream, doIceRestart, doTeardown, send, setCS]);

  const getMedia = useCallback(async (): Promise<MediaStream> => {
    if (!navigator.mediaDevices?.getUserMedia) {
    log("MEDIA", "#FF4D4D", "navigator.mediaDevices unavailable — use localhost not 127.0.0.1");
    return new MediaStream();
  }
    try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    streamRef.current = null;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) await new Promise(r => setTimeout(r, 500 * attempt));
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        log("MEDIA", "#1D9E75", "acquired:", stream.getTracks().map(t => t.kind));
        return stream;
      } catch (err: any) {
        if (err.name === "NotReadableError" && attempt < 2) {
          log("MEDIA", "#F59E0B", `Camera busy, retry ${attempt + 1}/3...`);
          continue;
        }
        if (err.name === "NotReadableError" || err.name === "NotFoundError") {
          log("MEDIA", "#F59E0B", "Camera unavailable — audio only");
          try {
            const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = audio;
            return audio;
          } catch { return new MediaStream(); }
        }
        throw err;
      }
    }
    return new MediaStream();
  }, []);

  const ensureRegistered = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const maxWait = 6000;
      const interval = 50;
      let elapsed = 0;
      const check = () => {
        const entry = activeSockets.get(currentUserId);
        if (entry?.registered && entry.ws.readyState === WebSocket.OPEN) {
          if (wsRef.current !== entry.ws) {
            log("WS", "#697C89", "ensureRegistered: syncing wsRef");
            wsRef.current = entry.ws;
          }
          log("WS", "#1D9E75", "ensureRegistered ✓");
          resolve();
          return;
        }
        elapsed += interval;
        if (elapsed >= maxWait) {
          log("WS", "#FF4D4D", `ensureRegistered timed out`);
          resolve();
          return;
        }
        setTimeout(check, interval);
      };
      check();
    });
  }, [currentUserId]);

  // ── Public API ────────────────────────────────────────────────────────────

  const startCall = useCallback(async (targetUserId: string, _name: string) => {
    if (callStateRef.current !== "idle") {
      log("CALL", "#FF4D4D", "not idle, ignoring:", callStateRef.current);
      return;
    }
    log("CALL", "#877EFF", "startCall →", targetUserId);
    remoteIdRef.current = targetUserId;
    setCS("calling");
    signalingActive.current = true;

    if (!iceServersRef.current) iceServersRef.current = await getIceServers();
    await ensureRegistered();

    try {
      const stream = await getMedia();
      const pc = buildPC(targetUserId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      const sent = send({
        type: "call-initiate",
        to: targetUserId,
        from: currentUserId,
        fromName: currentUserName,
        sdp: offer,
      });
      if (!sent) doTeardown("idle");
    } catch (e) {
      log("CALL", "#FF4D4D", "error:", e);
      doTeardown("idle");
    }
  }, [buildPC, currentUserId, currentUserName, doTeardown, ensureRegistered, getMedia, send, setCS]);

  const acceptCall = useCallback(async () => {
    const inc = incomingRef.current;
    log("ACCEPT", "#1D9E75", "triggered | inc:", inc ? `from=${inc.from}` : "NULL");

    if (!inc) { log("ACCEPT", "#FF4D4D", "no incoming call"); return; }
    if (!inc._offerSdp) { log("ACCEPT", "#FF4D4D", "no offer SDP"); return; }

    setCS("connecting");
    signalingActive.current = true;

    if (!iceServersRef.current) iceServersRef.current = await getIceServers();
    await ensureRegistered();

    try {
      let stream: MediaStream;
      try {
        stream = await getMedia();
      } catch (mediaErr: any) {
        if (mediaErr.name === "NotAllowedError") {
          log("ACCEPT", "#FF4D4D", "Media permission denied");
          setCS("idle");
          return;
        }
        log("ACCEPT", "#F59E0B", "Media fallback: empty stream");
        stream = new MediaStream();
      }

      const pc = buildPC(inc.from);
      if (stream.getTracks().length > 0) {
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
      }

      await pc.setRemoteDescription(new RTCSessionDescription(inc._offerSdp));
      remoteIsSet.current = true;
      await flushICE(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const sent = send({ type: "call-answer", to: inc.from, sdp: answer });
      log("ACCEPT", "#1D9E75", sent ? "call-answer SENT ✓" : "call-answer FAILED ✗");
      if (!sent) doTeardown("idle");
    } catch (e) {
      log("ACCEPT", "#FF4D4D", "THREW:", e instanceof Error ? `${e.name}: ${e.message}` : e);
      doTeardown("idle");
    }
  }, [buildPC, currentUserId, doTeardown, ensureRegistered, flushICE, getMedia, send, setCS]);

  const declineCall = useCallback(() => {
    const inc = incomingRef.current;
    if (inc) send({ type: "call-declined", to: inc.from });
    setIC(null);
    setCS("idle");
    signalingActive.current = false;
  }, [send, setCS, setIC]);

  const hangUp = useCallback(() => {
    const target = remoteIdRef.current ?? incomingRef.current?.from;
    if (target) send({ type: "call-end", to: target });
    doTeardown("ended");
    setTimeout(() => setCS("idle"), 1500);
  }, [doTeardown, send, setCS]);

  const toggleMute   = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(c => !c);
  }, []);

  const remoteVideoCallbackRef = useCallback((el: HTMLVideoElement | null) => {
    (remoteVideoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el && pendingRemoteStream.current) {
      log("TRACK", "#1D9E75", "video element mounted — attaching buffered stream");
      el.srcObject = pendingRemoteStream.current;
    }
  }, []);

  // ── WebSocket lifecycle ───────────────────────────────────────────────────

  useEffect(() => {
    if (!currentUserId) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url   = `${proto}://${window.location.host}/ws/video_call/`;

    const existing = activeSockets.get(currentUserId);
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      log("WS", "#697C89", "reusing existing socket for", currentUserId);
      wsRef.current = existing.ws;
      return () => { log("WS", "#697C89", "unmount — preserving shared socket"); };
    }

    log("WS", "#877EFF", "connecting as", currentUserId);

    let destroyed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;

    const connect = () => {
      if (destroyed) return;

      const stale = activeSockets.get(currentUserId);
      if (stale && stale.ws.readyState < WebSocket.CLOSING) stale.ws.close(1000, "reconnecting");

      const socket = new WebSocket(url);
      const entry: SocketEntry = { ws: socket, registered: false };
      activeSockets.set(currentUserId, entry);
      wsRef.current = socket;

      socket.onopen = () => {
        log("WS", "#1D9E75", "open — registering");
        reconnectAttempts = 0;
        socket.send(JSON.stringify({ type: "register", userId: currentUserId }));
      };

      socket.onclose = (e) => {
        log("WS", "#FF4D4D", `closed: ${e.code} "${e.reason}"`);
        entry.registered = false;
        if (activeSockets.get(currentUserId) === entry) activeSockets.delete(currentUserId);
        if (destroyed || reconnectAttempts >= 8) return;
        const delay = signalingActive.current ? 150 : Math.min(500 * 2 ** reconnectAttempts, 30_000);
        log("WS", "#697C89", `reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
        reconnectTimer = setTimeout(() => { reconnectAttempts++; connect(); }, delay);
      };

      socket.onerror = (e) => log("WS", "#FF4D4D", "error:", e);

      socket.onmessage = async (event) => {
        let data: any;
        try { data = JSON.parse(event.data as string); }
        catch { log("WS", "#FF4D4D", "bad JSON"); return; }

        log("RECV", "#697C89", data.type, "| state:", callStateRef.current);

        switch (data.type) {

          case "registered": {
            entry.registered = true;
            wsRef.current = socket;
            log("WS", "#1D9E75", "registered ✓");
            break;
          }

          case "call-initiate": {
            log("RECV", "#877EFF", "call-initiate from:", data.from, "sdp:", !!data.sdp);
            if (callStateRef.current !== "idle") {
              socket.send(JSON.stringify({ type: "call-declined", to: data.from }));
              break;
            }
            if (!data.sdp) { log("RECV", "#FF4D4D", "no SDP"); break; }
            setIC({
              from: data.from,
              fromName: data.fromName ?? "Unknown",
              fromImage: data.fromImage ?? "",
              _offerSdp: data.sdp,
            });
            setCS("incoming");
            remoteIdRef.current = data.from;
            break;
          }

          case "call-answer": {
            log("RECV", "#877EFF", "call-answer | pc:", !!pcRef.current, "sdp:", !!data.sdp);
            const pc = pcRef.current;
            if (!pc || !data.sdp) break;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
              remoteIsSet.current = true;
              log("RECV", "#1D9E75", "remote desc (answer) set ✓");
              await flushICE(pc);
              setCS("connecting");
            } catch (e) {
              log("RECV", "#FF4D4D", "setRemoteDescription failed:", e);
            }
            break;
          }

          case "ice-restart": {
            log("RECV", "#F59E0B", "ice-restart offer received");
            const pc = pcRef.current;
            if (!pc || !data.sdp) break;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              const target = data.from ?? remoteIdRef.current;
              send({ type: "call-answer", to: target, sdp: answer });
              log("RECV", "#1D9E75", "ice-restart answer sent ✓");
            } catch (e) {
              log("RECV", "#FF4D4D", "ice-restart answer failed:", e);
            }
            break;
          }

          case "ice-candidate": {
            if (!data.candidate) break;
            const pc = pcRef.current;
            if (pc && remoteIsSet.current) {
              try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); }
              catch (e) { log("ICE", "#FF4D4D", "addIceCandidate error:", e); }
            } else {
              pendingICE.current.push(data.candidate);
              log("ICE", "#697C89", `buffered (remoteIsSet=${remoteIsSet.current})`);
            }
            break;
          }

          case "call-declined":
          case "call-end":
          case "call-unavailable": {
            log("RECV", "#FF4D4D", "call ended:", data.type);
            try { pcRef.current?.close(); } catch (_) {}
            try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
            pcRef.current  = null;
            streamRef.current = null;
            pendingRemoteStream.current = null;
            if (localVideoRef.current)  localVideoRef.current.srcObject  = null;
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            remoteIsSet.current = false;
            pendingICE.current  = [];
            signalingActive.current = false;
            iceRestartCount.current = 0;
            setRemoteHasVideo(false); // ← RESET on remote call-end
            setIC(null);
            remoteIdRef.current = null;
            setCS(data.type === "call-unavailable" ? "unavailable" : "ended");
            setTimeout(() => setCS("idle"), 1500);
            break;
          }

          default:
            log("RECV", "#697C89", "unknown type:", data.type);
        }
      };
    };

    connect();

    return () => {
      log("WS", "#FF4D4D", "effect cleanup for", currentUserId);
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const sock = wsRef.current;
      if (sock) {
        sock.close(1000, "unmount");
        const e = activeSockets.get(currentUserId);
        if (e?.ws === sock) activeSockets.delete(currentUserId);
      }
      try { pcRef.current?.close(); } catch (_) {}
      try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  return {
    callState,
    incomingCall,
    localVideoRef,
    remoteVideoRef,
    remoteVideoCallbackRef,
    isMuted,
    isCameraOff,
    remoteHasVideo, // ← NEW export
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
  };
}