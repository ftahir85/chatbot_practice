import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

const API_BASE = "https://ftdomain.ddns.net/api";

const fetchWithNgrok = (url, options = {}) =>
  fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "ngrok-skip-browser-warning": "true",
    },
  });

export default function ChatWindow({
  chat,
  updateMessages,
  updateChatTitle,
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null); // ✅ store stream to stop it immediately

  // ✅ Load chat history from backend when chat is selected
  useEffect(() => {
    if (!chat?.id) return;
    fetchWithNgrok(`${API_BASE}/history/${chat.id}`)
      .then((res) => res.json())
      .then((data) => updateMessages(data))
      .catch((err) => console.error("Failed to load history:", err));
  }, [chat?.id]);

  if (!chat) {
    return <div className="chat-window">Select or create a chat</div>;
  }

  // 🎤 Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream; // ✅ save stream reference
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        // ✅ Stop stream immediately — removes mic icon from browser
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("file", blob, "audio.webm");

        try {
          const res = await fetchWithNgrok(`${API_BASE}/transcribe`, {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.text) {
            setInput(data.text);
          }
        } catch (err) {
          console.error("Transcription error:", err);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Microphone access denied. Please allow microphone access.");
    }
  };

  // ⏹ Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  // 🔊 Play bot response as audio
  const speakResponse = async (text) => {
    try {
      const res = await fetchWithNgrok(`${API_BASE}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      new Audio(url).play();
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  const WelcomeHeader = () => (
    <div className="top-welcome">
      <div className="logo-big">✨💬</div>
      <div className="welcome-title">ChatBOT</div>
      <div className="welcome-subtitle">
        Ask me anything — I can help with explanations, coding, writing and more.
      </div>
    </div>
  );

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const message = input.trim();
    const existingMessages = [...chat.messages];
    setInput("");
    setLoading(true);

    if (existingMessages.length === 0) {
      updateChatTitle(message);
    }

    let updatedMessages = [
      ...existingMessages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ];
    updateMessages(updatedMessages);

    try {
      const res = await fetchWithNgrok(`${API_BASE}/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, chat_id: chat.id }),
      });

      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      if (!res.body) throw new Error("No response body from server");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        botText += decoder.decode(value, { stream: true });
        updatedMessages = [
          ...existingMessages,
          { role: "user", content: message },
          { role: "assistant", content: botText },
        ];
        updateMessages(updatedMessages);
      }

      botText += decoder.decode();
      updatedMessages = [
        ...existingMessages,
        { role: "user", content: message },
        { role: "assistant", content: botText || "No response received." },
      ];
      updateMessages(updatedMessages);

      // 🔊 Auto-play bot response
      if (botText) {
        await speakResponse(botText);
      }

    } catch (err) {
      console.error("Error:", err);
      updateMessages([
        ...existingMessages,
        { role: "user", content: message },
        { role: "assistant", content: "Error getting response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-window">
      <WelcomeHeader />
      <div className="messages">
        {chat.messages.map((m, i) => (
          <div key={i} className={m.role}>
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}
      </div>
      <div className="input-box">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or hold 🎤 to speak..."
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          disabled={loading}
        />

        {/* 🎤 Voice button */}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={loading}
          style={{
            background: recording ? "#e53e3e" : "#4a5568",
            fontSize: "1.2rem",
            padding: "0 12px",
          }}
          title="Hold to speak"
        >
          {recording ? "🔴" : "🎤"}
        </button>

        {/* Send button */}
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}