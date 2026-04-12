import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer, WebSocket } from "ws";
import Redis from "ioredis";
import mongoose from "mongoose";
import crypto from "crypto";

// ─── Environment ─────────────────────────────────────────────────────────────

const dev = process.env.NODE_ENV !== "production";
const PORT = parseInt(process.env.PORT ?? "3000", 10);
const MONGODB_URL = process.env.MONGODB_URL!;
const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

if (!MONGODB_URL) {
  throw new Error("MONGODB_URL environment variable is required");
}

// ─── Next.js app ─────────────────────────────────────────────────────────────

const app = next({ dev });
const handle = app.getRequestHandler();

// ─── Redis clients (pub + sub must be separate connections) ──────────────────

const pub = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

pub.on("error", (err) => console.error("[Redis pub]", err.message));
sub.on("error", (err) => console.error("[Redis sub]", err.message));

// ─── In-memory room registry ─────────────────────────────────────────────────

const chatRooms = new Map<string, Set<WebSocket>>();
const videoRoom = new Set<WebSocket>();
const videoSockets = new Map<string, WebSocket>(); // userId → ws

// ─── MongoDB WsMessage model ──────────────────────────────────────────────────

const msgSchema = new mongoose.Schema(
  {
    id:        { type: String, required: true, unique: true },
    sender:    { type: String, required: true },
    senderName: { type: String, default: "" }, 
    content:   { type: String, required: true },
    room_id:   { type: String, required: true },
    timestamp: { type: Date,   default: Date.now },
    expiresAt: { type: Date }, // TTL field — MongoDB auto-deletes after 30 days
    status: {   
      type: String,   
      enum: ['sent', 'delivered', 'read'],   
      default: 'sent' 
    }
  },
  { collection: "messages" }
);
msgSchema.index({ room_id: 1, timestamp: 1 });
msgSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL index

const WsMessage =
  (mongoose.models["WsMessage"] as mongoose.Model<any>) ??
  mongoose.model("WsMessage", msgSchema);

// ─── DB connection (lazy singleton) ──────────────────────────────────────────

let dbConnected = false;
async function connectDB(): Promise<void> {
  if (dbConnected || mongoose.connection.readyState !== 0) {
    dbConnected = true;
    return;
  }
  await mongoose.connect(MONGODB_URL);
  dbConnected = true;
  console.log("[MongoDB] connected");
}

// ─── Redis subscriber — fan-out to local WebSocket clients ───────────────────

sub.on("message", (channel: string, raw: string) => {
  try {
    const data = JSON.parse(raw) as {
      type: "chat" | "video";
      roomId?: string;
      payload: unknown;
      senderChannel?: string;
    };

    if (data.type === "chat" && data.roomId) {
      const room = chatRooms.get(data.roomId);
      if (!room) return;
      const serialised = JSON.stringify(data.payload);
      room.forEach((ws) => {
        // Skip sender — they already received a message_confirmed receipt
        if ((ws as any).__channelName === data.senderChannel) return;
        if (ws.readyState === WebSocket.OPEN) ws.send(serialised);
      });
    }

    if (data.type === "video") {
      const serialised = JSON.stringify(data.payload);
      videoRoom.forEach((ws) => {
        if ((ws as any).__channelName === data.senderChannel) return;
        if (ws.readyState === WebSocket.OPEN) ws.send(serialised);
      });
    }
  } catch (err) {
    console.error("[Redis fan-out] parse error", err);
  }
});

sub.subscribe("chat", "video", (err) => {
  if (err) console.error("[Redis sub] subscribe error", err);
  else console.log("[Redis sub] subscribed to chat + video channels");
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

app.prepare().then(async () => {
  await connectDB();

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // ─── WebSocket Server: noServer: true + manual upgrade filtering ─────────
  const wss = new WebSocketServer({ noServer: true });

  // Custom upgrade handler — only intercept /ws/* paths
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url ?? "", true);
    
    // Only handle our custom WebSocket endpoints
    if (pathname?.startsWith("/ws/")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } 
    // Let Next.js handle its own HMR and other upgrades
    else {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
    }
  });

  // ─── Connection handler (your existing logic, now properly isolated) ─────
  wss.on("connection", async (ws, req) => {
    const { pathname } = parse(req.url ?? "");

    // Assign a unique channel name — mirrors Django's ws.channel_name
    (ws as any).__channelName = crypto.randomUUID();

    // Add error handler to prevent uncaught exceptions
    ws.on("error", (err) => {
      console.error("[ws] connection error:", err.message);
    });

    // ── ws/chat/<roomId>/ ─────────────────────────────────────────────────

    const chatMatch = pathname?.match(/^\/ws\/chat\/([\w-]+)\/$/);
    if (chatMatch) {
      const roomId = chatMatch[1];

      // group_add
      if (!chatRooms.has(roomId)) chatRooms.set(roomId, new Set());
      chatRooms.get(roomId)!.add(ws);

      // Replay message history — last 50 messages for this room
      try {
        const history = await WsMessage.find({ room_id: roomId })
          .sort({ timestamp: 1 })
          .limit(50)
          .lean<{ id: string; sender: string; senderName?: string; content: string; timestamp: Date, status: string }[]>();

        history.forEach((m) => {
          ws.send(
            JSON.stringify({
              type:      "chat_message",
              id:        m.id,
              message:   m.content,
              sender:    m.sender,
              senderName: m.senderName ?? m.sender,
              timestamp: m.timestamp.toISOString(),
              status:    m.status,
            })
          );
        });
      } catch (err) {
        console.error("[chat] history replay failed", err);
      }



      ws.on("message", async (raw) => {
        try {
          const data = JSON.parse(raw.toString()) as {
            message?:  string;
            sender?:   string;
            type?:     "ack" | "delivered" | "read" | "typing" | "chat";
            msgId?:    string;
            tempId?:   string; // client-generated id for optimistic reconciliation
            isTyping?: boolean; // added for typing indicator
          };

          // ── Message Status Updates (Delivered / Read) ─────────────────
          if (data.type === "delivered" && data.msgId) {
            await WsMessage.findOneAndUpdate(
              { id: data.msgId },
              { status: "delivered" }
            );
            // Notify the original sender
            await pub.publish("chat", JSON.stringify({
              type: "chat",
              roomId,
              senderChannel: (ws as any).__channelName,
              payload: { type: "status_update", msgId: data.msgId, status: "delivered" }
            }));
            return;
          }

          if (data.type === "read" && data.msgId) {
            await WsMessage.findOneAndUpdate(
              { id: data.msgId },
              { status: "read" }
            );
            await pub.publish("chat", JSON.stringify({
              type: "chat",
              roomId,
              senderChannel: (ws as any).__channelName,
              payload: { type: "status_update", msgId: data.msgId, status: "read" }
            }));
            return;
          }

          // ── Typing Indicator ──────────────────────────────────────────
          if (data.type === "typing") {
            await pub.publish("chat", JSON.stringify({
              type: "chat",
              roomId,
              senderChannel: (ws as any).__channelName,
              payload: { type: "typing", sender: data.sender, isTyping: data.isTyping }
            }));
            return;
          }

          // ── Incoming chat message ─────────────────────────────────────
          if (!data.message || !data.sender) {
            ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
            return;
          }

          const msgId     = crypto.randomUUID();
          const timestamp = new Date().toISOString();
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

          const payload = {
            type:      "chat_message",
            id:        msgId,
            message:   data.message,
            sender:    data.sender,
            senderName: (data as any).senderName ?? data.sender,
            timestamp,
          };

          // Store in Redis as a short-term delivery buffer (30-day TTL).
          await pub.setex(
            `msg:${msgId}`,
            60 * 60 * 24 * 30,
            JSON.stringify(payload)
          );

          // Store in MongoDB as a durable fallback for offline recipients.
          await WsMessage.create({
            id:        msgId,
            sender:    data.sender,
            senderName: (data as any).senderName ?? data.sender,
            content:   data.message,
            room_id:   roomId,
            expiresAt,
            status:    "sent" // initialized based on new schema
          });

          // Fan out via Redis pub/sub to all OTHER sockets in this room.
          await pub.publish(
            "chat",
            JSON.stringify({
              type:          "chat",
              roomId,
              senderChannel: (ws as any).__channelName,
              payload,
            })
          );

          // Send confirmed receipt directly back to the sender.
          ws.send(JSON.stringify({
            type:      "message_confirmed",
            tempId:    data.tempId,
            id:        msgId,
            timestamp,
          }));

        } catch (err) {
          console.error("[chat] receive error", err);
          ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
      });

      // group_discard
      ws.on("close", () => {
        chatRooms.get(roomId)?.delete(ws);
        if (chatRooms.get(roomId)?.size === 0) chatRooms.delete(roomId);
      });

      return; // handled
    }

    // ── ws/video_call/ ────────────────────────────────────────────────────

if (pathname === "/ws/video_call/") {
  let registeredUserId: string | null = null;
 
  ws.on("message", async (raw) => {
    try {
      const data = JSON.parse(raw.toString());
 
      // ── Register ──────────────────────────────────────────────────────────
      if (data.type === "register" && data.userId) {
        // If this userId was registered on a different socket, clean up
        const existing = videoSockets.get(data.userId);
        if (existing && existing !== ws) {
          existing.close(1000, "replaced");
        }
        registeredUserId = data.userId;
        videoSockets.set(data.userId, ws);
        ws.send(JSON.stringify({ type: "registered", userId: data.userId }));
        console.log(`[video] registered: ${data.userId} (total: ${videoSockets.size})`);
        return;
      }
 
      // Require registration for all other messages
      if (!registeredUserId) {
        ws.send(JSON.stringify({ type: "error", content: "Not registered" }));
        return;
      }
 
      // ── Relay to target ───────────────────────────────────────────────────
      const targetId = data.to as string | undefined;
      if (!targetId) {
        console.warn("[video] message missing 'to' field:", data.type);
        return;
      }
 
      const targetWs = videoSockets.get(targetId);
 
      if (!targetWs || targetWs.readyState !== 1 /* WebSocket.OPEN */) {
        console.log(`[video] target ${targetId} offline for ${data.type}`);
        if (data.type === "call-initiate") {
          ws.send(JSON.stringify({ type: "call-unavailable", to: targetId }));
        }
        return;
      }
 
      // Relay — always stamp `from` with the sender's registered userId
      const relayed = { ...data, from: registeredUserId };
      console.log(`[video] relay ${data.type}: ${registeredUserId} → ${targetId}`);
      console.log(`[video] ✓ RELAYED ${data.type} to ${targetId} (ws state: ${targetWs.readyState})`);
      targetWs.send(JSON.stringify(relayed));
 
    } catch (err) {
      console.error("[video] message error:", err);
      ws.send(JSON.stringify({ type: "error", content: "Invalid JSON" }));
    }
  });
 
  ws.on("close", (code, reason) => {
    if (registeredUserId) {
      // Only delete if this is still the active socket for this user
      if (videoSockets.get(registeredUserId) === ws) {
        videoSockets.delete(registeredUserId);
        console.log(`[video] unregistered: ${registeredUserId} (code: ${code})`);
      }
      registeredUserId = null;
    }
  });
 
  return;
}


    // Unknown endpoint within /ws/
    ws.close(1008, "Unknown WebSocket endpoint");
  });

  // ─── Graceful shutdown ───────────────────────────────────────────────────
  process.on("SIGINT", () => {
    console.log("\nShutting down gracefully...");
    wss.close(() => {
      pub.quit();
      sub.quit();
      mongoose.disconnect();
      server.close(() => {
        console.log("Server closed");
        process.exit(0);
      });
    });
  });

  // ─── Start server ───────────────────────────────────────────────────────
  server.listen(PORT, () => {
    console.log(`\n> Next.js ready on http://localhost:${PORT}`);
    console.log("> WebSocket endpoints:");
    console.log(`>   ws://localhost:${PORT}/ws/chat/<roomId>/`);
    console.log(`>   ws://localhost:${PORT}/ws/video_call/`);
  });
});