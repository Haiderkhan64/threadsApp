"use client";

import { useEffect, useRef } from "react";
import { useVideoCall } from "@/hook/useVideoCall";

interface VideoCallOverlayProps {
  currentUserId: string;
  currentUserName: string;
  currentUserImage: string;
}

export function VideoCallOverlay({
  currentUserId,
  currentUserName,
  currentUserImage,
}: VideoCallOverlayProps) {
  const {
    callState,
    incomingCall,
    localVideoRef,
    remoteVideoCallbackRef,
    isMuted,
    isCameraOff,
    remoteHasVideo, // ← NEW
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
  } = useVideoCall({ currentUserId, currentUserName });

  // Keep startCall ref fresh so the global handler never goes stale
  const startCallRef = useRef(startCall);
  useEffect(() => {
    startCallRef.current = startCall;
  }, [startCall]);

  // Register global trigger once on mount
  useEffect(() => {
    (window as any).__startVideoCall = (targetId: string, targetName: string) => {
      console.log("[VideoCallOverlay] __startVideoCall triggered for", targetId);
      startCallRef.current(targetId, targetName);
    };
    return () => {
      delete (window as any).__startVideoCall;
    };
  }, []);

  const isInCall = ["calling", "connecting", "active"].includes(callState);
  const showOverlay =
    isInCall ||
    callState === "incoming" ||
    callState === "ended" ||
    callState === "unavailable";

  if (!showOverlay) return null;

  // Name/image of the remote party (works for both caller and callee)
  const remoteName  = incomingCall?.fromName  ?? "Caller";
  const remoteImage = incomingCall?.fromImage ?? "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ── Incoming call screen ─────────────────────────────────────────── */}
      {callState === "incoming" && incomingCall && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96, height: 96, borderRadius: "50%",
              overflow: "hidden", border: "3px solid #877EFF",
            }}
          >
            {incomingCall.fromImage ? (
              <img
                src={incomingCall.fromImage}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%", height: "100%",
                  background: "#877EFF33",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#877EFF", fontSize: 32, fontWeight: 500,
                }}
              >
                {incomingCall.fromName[0]}
              </div>
            )}
          </div>

          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#EFEFEF", fontSize: 22, fontWeight: 500, margin: 0 }}>
              {incomingCall.fromName}
            </p>
            <p style={{ color: "#697C89", fontSize: 14, margin: "6px 0 0" }}>
              Incoming video call…
            </p>
          </div>

          <div style={{ display: "flex", gap: 32, marginTop: 8 }}>
            {/* Decline */}
            <button
              onClick={declineCall}
              aria-label="Decline call"
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#FF4D4D", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3.4 20.4l17-17M20.6 20.4l-17-17" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Accept */}
            <button
              onClick={() => {
                console.log("[VideoCallOverlay] Accept button clicked");
                acceptCall();
              }}
              aria-label="Accept call"
              style={{
                width: 64, height: 64, borderRadius: "50%",
                background: "#1D9E75", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.5 3.6a2 2 0 0 1 1.99-2.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Active / connecting call screen ──────────────────────────────── */}
      {isInCall && (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>

          {/* Remote video — hidden (not removed) when no video track yet */}
          <video
            ref={remoteVideoCallbackRef}
            autoPlay
            playsInline
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              background: "#121417",
              // Hide via opacity so the element stays mounted and stream
              // can attach at any time without re-mounting the element.
              opacity: remoteHasVideo ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          />

          {/* ── Avatar placeholder — shown when remote camera is off ── */}
          {!remoteHasVideo && callState === "active" && (
            <div
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "#121417",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 88, height: 88, borderRadius: "50%",
                  overflow: "hidden", border: "3px solid #2A2D35",
                  background: "#1F1F22",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {remoteImage ? (
                  <img
                    src={remoteImage}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#697C89" strokeWidth="1.5">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </svg>
                )}
              </div>
              <p style={{ color: "#EFEFEF", fontSize: 16, fontWeight: 500, margin: 0 }}>
                {remoteName}
              </p>
              <p style={{ color: "#697C89", fontSize: 13, margin: 0 }}>
                Camera unavailable
              </p>
            </div>
          )}

          {/* Calling placeholder */}
          {callState === "calling" && (
            <div
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 16,
              }}
            >
              <div
                style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "#1F1F22",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#697C89" strokeWidth="1.5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <p style={{ color: "#697C89", fontSize: 15 }}>Calling…</p>
            </div>
          )}

          {/* Connecting spinner */}
          {callState === "connecting" && (
            <div
              style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 12,
              }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: "3px solid #877EFF", borderTopColor: "transparent",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <p style={{ color: "#697C89", fontSize: 15 }}>Connecting…</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Local video — Picture-in-Picture */}
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute", bottom: 100, right: 16,
              width: 120, height: 160,
              objectFit: "cover", borderRadius: 12,
              border: "2px solid #1F1F22", background: "#121417",
              opacity: isCameraOff ? 0 : 1,
              transition: "opacity 0.2s",
            }}
          />

          {/* Call controls */}
          <div
            style={{
              position: "absolute", bottom: 24, left: "50%",
              transform: "translateX(-50%)",
              display: "flex", gap: 16,
              background: "rgba(18,20,23,0.85)",
              padding: "12px 20px", borderRadius: 40,
              backdropFilter: "blur(8px)",
            }}
          >
            <ControlBtn onClick={toggleMute} active={isMuted} label={isMuted ? "Unmute" : "Mute"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                {isMuted ? (
                  <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </>
                )}
              </svg>
            </ControlBtn>

            <ControlBtn onClick={toggleCamera} active={isCameraOff} label={isCameraOff ? "Camera on" : "Camera off"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                {isCameraOff ? (
                  <>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A4 4 0 1 1 7.72 7.72" />
                  </>
                ) : (
                  <>
                    <path d="M23 7 16 12l7 5V7z" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                )}
              </svg>
            </ControlBtn>

            <button
              onClick={hangUp}
              aria-label="End call"
              style={{
                width: 52, height: 52, borderRadius: "50%",
                background: "#FF4D4D", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 2 2 0 0 1-.45-2.11l.27-.7M3.6 1.5a2 2 0 0 1 2 1.99v3a2 2 0 0 1-1.72 2 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 2.11-.45l1.27-1.27a16 16 0 0 0 2.6 3.41" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Ended / unavailable screen ───────────────────────────────────── */}
      {(callState === "ended" || callState === "unavailable") && (
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, color: "#EFEFEF" }}>
            {callState === "unavailable" ? "User unavailable" : "Call ended"}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Reusable control button ───────────────────────────────────────────────────
function ControlBtn({
  onClick, active, label, children,
}: {
  onClick: () => void;
  active: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 52, height: 52, borderRadius: "50%",
        background: active ? "#877EFF" : "#1F1F22",
        border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "background 0.2s",
      }}
    >
      {children}
    </button>
  );
}