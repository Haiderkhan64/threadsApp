"use client";
import React, { useState, useEffect, useCallback } from "react";

const Home = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageType, setMessageType] = useState("offer");
  const [messageContent, setMessageContent] = useState("");
  const [textMessage, setTextMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("Connecting...");
  const [reconnectCount, setReconnectCount] = useState(0);
  const [error, setError] = useState("");
  const MAX_RECONNECTS = 5;

  // WebSocket connection function with exponential backoff
  const connectWebSocket = useCallback(() => {
    if (reconnectCount >= MAX_RECONNECTS) {
      setConnectionStatus("Max reconnection attempts reached");
      return;
    }

    const delay = Math.min(1000 * 2 ** reconnectCount, 30000); // Cap at 30s
    const ws = new WebSocket("ws://192.168.100.72:8000/ws/video_call/");

    ws.onopen = () => {
      setConnectionStatus("Connected");
      setReconnectCount(0);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) =>
          prev.some((msg) => JSON.stringify(msg) === JSON.stringify(data))
            ? prev
            : [...prev, data]
        );
      } catch (error) {
        console.error("Parse error:", error);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("Reconnecting...");
      setReconnectCount((prev) => prev + 1);
      setTimeout(connectWebSocket, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    setSocket(ws);
    return ws;
  }, [reconnectCount]);

  useEffect(() => {
    const ws = connectWebSocket();
    return () => ws?.readyState === WebSocket.OPEN && ws.close();
  }, [connectWebSocket]);

  const validateJSON = (content) => {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  };

  const sendMessage = () => {
    if (!socket?.readyState === WebSocket.OPEN) {
      setConnectionStatus("Not connected");
      return;
    }

    if (!messageContent.trim()) {
      setError("Enter message content");
      return;
    }

    if (messageType !== "text" && !validateJSON(messageContent)) {
      setError("Invalid JSON format");
      return;
    }

    try {
      let content = messageContent;
      if (messageType !== "text") {
        content = JSON.parse(messageContent);
      }

      const message = { type: messageType, content };
      socket.send(JSON.stringify(message));
      setMessages((prev) => [...prev, message]);
      setMessageContent("");
      setError("");
    } catch (error) {
      console.error("Send error:", error);
      setError("Failed to send message");
    }
  };

  const sendTextMessage = () => {
    if (!socket?.readyState === WebSocket.OPEN || !textMessage.trim()) {
      return;
    }

    try {
      const message = { type: "text", content: textMessage };
      socket.send(JSON.stringify(message));
      setMessages((prev) => [...prev, message]);
      setTextMessage("");
      setError("");
    } catch (error) {
      console.error("Text message error:", error);
      setError("Failed to send text message");
    }
  };

  return (
    <div className="p-5 max-w-2xl mx-auto bg-blue-50">
      <h1 className="text-2xl font-bold mb-4">Video Call Signaling</h1>
      <p className="mb-4">
        <strong>Status: </strong>
        <span
          className={
            connectionStatus.includes("Connected")
              ? "text-green-500"
              : "text-red-500"
          }
        >
          {connectionStatus}
        </span>
      </p>
      {error && <p className="text-red-500 mb-4">{error}</p>}

      {/* Text Message Section */}
      <div className="mb-6 bg-white p-4 rounded shadow">
        <h3 className="text-lg font-semibold mb-2">Text Message</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={textMessage}
            onChange={(e) => setTextMessage(e.target.value)}
            className="flex-1 p-2 border rounded"
            placeholder="Type a message..."
          />
          <button
            onClick={sendTextMessage}
            disabled={!socket || socket.readyState !== WebSocket.OPEN}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {/* Existing Video Call Controls */}
      <div className="mb-4">
        <label className="block mb-2">
          Message Type:
          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
            className="ml-2 p-2 border rounded"
          >
            <option value="offer">Offer</option>
            <option value="answer">Answer</option>
            <option value="candidate">Candidate</option>
            <option value="text">Text</option>
          </select>
        </label>
      </div>

      <textarea
        rows="4"
        value={messageContent}
        onChange={(e) => setMessageContent(e.target.value)}
        className="w-full p-2 border rounded mb-4"
        placeholder="Enter message content... (JSON or text)"
      />

      <div className="flex gap-4 mb-6">
        <button
          onClick={sendMessage}
          disabled={!socket || socket.readyState !== WebSocket.OPEN}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Send Message
        </button>
        <button
          onClick={() => setMessages([])}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Clear Messages
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-4">Messages:</h2>
      <div className="border rounded p-4 max-h-80 overflow-y-auto bg-white">
        {messages.length === 0 ? (
          <p className="text-gray-500">No messages yet</p>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className="mb-4 p-2 border-b last:border-b-0">
              <strong>Type:</strong> {msg.type}
              <br />
              <strong>Content:</strong>
              <pre className="whitespace-pre-wrap">
                {typeof msg.content === "object"
                  ? JSON.stringify(msg.content, null, 2)
                  : msg.content || JSON.stringify(msg)}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Home;
