"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { FormField, FormItem, FormMessage, FormControl } from "../ui/form";
import { updateConversationLastMessage } from "@/lib/actions/conversation.action";

// ─── Polyfill for crypto.randomUUID in non-secure / older browser contexts ───
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: RFC-4122 v4 UUID using Math.random
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThreadChatProps {
  roomId: string;
  currentUser: string;
  currentUserId: string;
  anotherUserId: string;
  anotherUserName?: string;
  conversationId?: string;
}

type MessageStatus = "sending" | "confirmed" | "failed";
type ConnectionStatus = "connected" | "disconnected" | "error" | "connecting";

interface Message {
  id: string;
  tempId?: string;
  message: string;
  sender: string;
  senderName: string;
  timestamp: string;
  status: MessageStatus;
}

type GroupedMessage = Message & { isFirst: boolean; isLast: boolean };

const MAX_RECONNECT_ATTEMPTS = 5;
const MAX_RECONNECT_DELAY_MS = 30000;

// ─── ThreadChat ───────────────────────────────────────────────────────────────

const ThreadChat = ({
  roomId,
  currentUser,
  currentUserId,
  anotherUserName,
  conversationId,
}: ThreadChatProps) => {
  const wsRef             = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const seenIds           = useRef<Set<string>>(new Set());
  const isUnmountedRef    = useRef(false);
  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement | null>(null);

  const [messages, setMessages]                 = useState<Message[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  const methods      = useForm<{ message: string }>({ defaultValues: { message: "" } });
  const messageValue = useWatch({ control: methods.control, name: "message" });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    isUnmountedRef.current = false;
    return () => { isUnmountedRef.current = true; };
  }, []);

  const connectWebSocket = useCallback(() => {
    if (isUnmountedRef.current) return;
    if (reconnectCountRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus("error");
      return;
    }

    setConnectionStatus("connecting");

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/chat/${roomId}/`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      if (isUnmountedRef.current) { ws.close(); return; }
      setConnectionStatus("connected");
      reconnectCountRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      if (isUnmountedRef.current) return;

      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data) as Record<string, unknown>;
      } catch (err) {
        console.error("[ThreadChat] malformed message:", err);
        return;
      }

      // ── Optimistic message confirmed by server ──────────────────────────
      if (data.type === "message_confirmed") {
        const { tempId, id, timestamp } = data as {
          tempId: string; id: string; timestamp: string;
        };
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === tempId
              ? { ...m, id, tempId: undefined, timestamp, status: "confirmed" }
              : m
          )
        );
        seenIds.current.add(id);
        return;
      }

      // ── Inbound message (live delivery OR history replay) ───────────────
      if (data.type === "chat_message") {
  const msgId      = data.id as string;
  const senderId   = data.sender as string;
  const senderName = (data.senderName as string | undefined);
  
  if (seenIds.current.has(msgId)) return;
  seenIds.current.add(msgId);

  setMessages((prev) => [
    ...prev,
    {
      id:         msgId,
      message:    data.message as string,
      sender:     senderId,
      // If senderName is missing or looks like a Clerk ID, use a fallback
      senderName: senderId === currentUserId 
  ? currentUser 
  : (senderName && !senderName.startsWith("user_") 
      ? senderName 
      : anotherUserName ?? senderId),
      timestamp:  (data.timestamp as string) ?? new Date().toISOString(),
      status:     "confirmed",
    },
  ]);
}
    };

    ws.onclose = (event: CloseEvent) => {
      if (isUnmountedRef.current) return;
      setConnectionStatus("disconnected");
      if (!event.wasClean && reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = Math.min(
          1_000 * 2 ** reconnectCountRef.current,
          MAX_RECONNECT_DELAY_MS
        );
        reconnectTimerRef.current = setTimeout(() => {
          reconnectCountRef.current += 1;
          connectWebSocket();
        }, delay);
      }
    };

    ws.onerror = () => {
      if (isUnmountedRef.current) return;
      setConnectionStatus("error");
    };
  }, [roomId, currentUser, currentUserId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connectWebSocket]);

  // ── Send message ──────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (data: { message: string }) => {
      const trimmed = data.message.trim();
      if (!trimmed || connectionStatus !== "connected" || !wsRef.current) return;

      const tempId    = generateId();
      const timestamp = new Date().toISOString();

      setMessages((prev) => [
        ...prev,
        {
          id: tempId, tempId,
          message:    trimmed,
          sender:     currentUserId,
          senderName: currentUser,
          timestamp,
          status: "sending",
        },
      ]);

      try {
        wsRef.current.send(
          JSON.stringify({
            message:    trimmed,
            sender:     currentUserId,
            senderName: currentUser,
            tempId,
          })
        );

        methods.reset();
        if (textareaRef.current) textareaRef.current.style.height = "auto";

        if (conversationId) {
          updateConversationLastMessage(conversationId, trimmed).catch((err) =>
            console.error("[ThreadChat] updateConversationLastMessage failed:", err)
          );
        }
      } catch (err) {
        console.error("[ThreadChat] send failed:", err);
        setMessages((prev) =>
          prev.map((m) => (m.tempId === tempId ? { ...m, status: "failed" } : m))
        );
      }
    },
    [connectionStatus, currentUser, currentUserId, conversationId, methods]
  );

  const grouped: GroupedMessage[] = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].sender !== msg.sender,
    isLast:  i === messages.length - 1 || messages[i + 1].sender !== msg.sender,
  }));

  const isConnected = connectionStatus === "connected";
  const canSend     = isConnected && messageValue.trim().length > 0;

  return (
    <div
      className="flex flex-col"
      style={{ height: "calc(100vh - 220px)", minHeight: "400px" }}
    >
      {!isConnected && <ConnectionBanner status={connectionStatus} />}

      <div className="flex-1 overflow-y-auto rounded-2xl bg-dark-2 px-4 py-5 scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState isConnecting={connectionStatus === "connecting"} />
        ) : (
          <div className="flex flex-col gap-1">
            {grouped.map((msg) => (
              <MessageBubble
                key={msg.tempId ?? msg.id}
                msg={msg}
                isMine={msg.sender === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-dark-4 bg-dark-2 p-2">
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} className="flex items-end gap-2">
            <FormField
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <textarea
                      {...field}
                      ref={(el) => {
                        textareaRef.current = el;
                        if (typeof field.ref === "function") field.ref(el);
                      }}
                      placeholder="Message…"
                      disabled={!isConnected}
                      rows={1}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          methods.handleSubmit(onSubmit)();
                        }
                      }}
                      onChange={(e) => {
                        field.onChange(e);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      className="w-full resize-none bg-transparent px-2 py-2 text-[14px] leading-relaxed text-light-1 placeholder-gray-1 outline-none disabled:opacity-40"
                      style={{ minHeight: "40px", maxHeight: "120px" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white transition-all hover:bg-primary-500/90 disabled:cursor-not-allowed disabled:opacity-30 active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const CONNECTION_CONFIG: Record<
  Exclude<ConnectionStatus, "connected">,
  { bg: string; dot: string; label: string }
> = {
  error:        { bg: "bg-red-500/10 text-red-400",       dot: "bg-red-500",    label: "Connection failed — please refresh" },
  connecting:   { bg: "bg-blue-500/10 text-blue-400",     dot: "bg-blue-500",   label: "Connecting…" },
  disconnected: { bg: "bg-yellow-500/10 text-yellow-400", dot: "bg-yellow-500", label: "Reconnecting…" },
};

function ConnectionBanner({ status }: { status: ConnectionStatus }) {
  if (status === "connected") return null;
  const { bg, dot, label } = CONNECTION_CONFIG[status];
  return (
    <div role="status" aria-live="polite" className={`mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium ${bg}`}>
      <span className={`h-2 w-2 rounded-full ${dot} animate-pulse`} aria-hidden="true" />
      {label}
    </div>
  );
}

function EmptyState({ isConnecting }: { isConnecting: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-dark-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-1" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="text-[15px] font-semibold text-light-1">
        {isConnecting ? "Loading messages…" : "Start the conversation"}
      </p>
      <p className="text-[13px] text-gray-1">Messages are end-to-end only between you two.</p>
    </div>
  );
}

function MessageBubble({ msg, isMine }: { msg: GroupedMessage; isMine: boolean }) {
  const bubbleShape = isMine
    ? msg.isFirst && msg.isLast ? "rounded-2xl"
    : msg.isFirst              ? "rounded-2xl rounded-br-md"
    : msg.isLast               ? "rounded-2xl rounded-tr-md"
    :                            "rounded-2xl rounded-r-md"
    : msg.isFirst && msg.isLast ? "rounded-2xl"
    : msg.isFirst               ? "rounded-2xl rounded-bl-md"
    : msg.isLast                ? "rounded-2xl rounded-tl-md"
    :                             "rounded-2xl rounded-l-md";

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"} ${msg.isFirst ? "mt-3" : "mt-0.5"}`}>
      <div className={`flex max-w-[75%] flex-col ${isMine ? "items-end" : "items-start"}`}>
        {!isMine && msg.isFirst && (
          <span className="mb-1 ml-3 text-[11px] font-semibold text-gray-1">
            {msg.senderName}
          </span>
        )}

        <div className={`relative px-4 py-2.5 text-[14px] leading-relaxed transition-opacity duration-150 ${
          msg.status === "sending" ? "opacity-60" : "opacity-100"
        } ${isMine ? "bg-primary-500 text-white" : "bg-dark-3 text-light-1"} ${bubbleShape}`}>
          <p className="break-words whitespace-pre-wrap">{msg.message}</p>
        </div>

        {msg.isLast && (
          <div className={`mt-1 flex items-center gap-1.5 px-1 ${isMine ? "flex-row-reverse" : ""}`}>
            <time dateTime={msg.timestamp} className="text-[11px] text-gray-1 tabular-nums">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </time>
            {isMine && <MessageStatusIcon status={msg.status} />}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageStatusIcon({ status }: { status: MessageStatus }) {
  if (status === "sending") {
    return (
      <span className="text-gray-1" aria-label="Sending">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      </span>
    );
  }
  if (status === "confirmed") {
    return (
      <span className="text-primary-500" aria-label="Delivered">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  return <span className="text-[11px] text-red-400" aria-label="Failed">✕</span>;
}

export default ThreadChat;