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

export default function ChatWindow({ chat, updateMessages, updateChatTitle }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const messagesEndRef = useRef(null);
  
  // Use a ref to store the current audio object
  const currentAudio = useRef(null);

  // MASTER STOP FUNCTION
  const stopAllAudio = () => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.src = ""; // Force clear the source
      currentAudio.current.load();
      currentAudio.current = null;
    }
    // Also cancel Web Speech API just in case it's being used elsewhere
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  useEffect(() => {
    // Stop audio immediately when switching chats
    stopAllAudio();

    if (!chat?.id) return;
    fetchWithNgrok(`${API_BASE}/history/${chat.id}`)
      .then((res) => res.json())
      .then((data) => updateMessages(data))
      .catch((err) => console.error("Failed to load history:", err));
    
    return () => stopAllAudio();
  }, [chat?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-800 text-gray-400">
        <div className="text-6xl mb-4">💬</div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome to ChatBOT</h2>
        <p className="text-gray-400">Select or create a chat to get started</p>
      </div>
    );
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
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
          if (data.text) setInput(data.text);
        } catch (err) {
          console.error("Transcription error:", err);
        }
      };
      mediaRecorder.start();
      setRecording(true);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const speakResponse = async (text) => {
    try {
      stopAllAudio(); // Kill any currently playing audio before starting new one
      const res = await fetchWithNgrok(`${API_BASE}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio.current = audio;
      
      // Auto-clean up the URL after playing to prevent memory leaks
      audio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio.current = null;
      };
      
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    stopAllAudio(); // Kill audio when a new message is sent

    const message = input.trim();
    const existingMessages = [...chat.messages];
    setInput("");
    setLoading(true);

    if (existingMessages.length === 0) updateChatTitle(message);

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

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let botText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        botText += decoder.decode(value, { stream: true });
        updateMessages([
          ...existingMessages,
          { role: "user", content: message },
          { role: "assistant", content: botText },
        ]);
      }

      botText += decoder.decode();
      updateMessages([
        ...existingMessages,
        { role: "user", content: message },
        { role: "assistant", content: botText || "No response received." },
      ]);

      if (botText) await speakResponse(botText);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-800 h-screen relative">
      {/* ADDED: Manual Stop Audio Button (Top Right) */}
      {loading === false && (
         <button 
           onClick={stopAllAudio}
           className="absolute top-4 right-4 z-50 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1 rounded-full text-xs transition-all border border-red-500/50"
         >
           Stop Audio 🔇
         </button>
      )}

      <div className="flex items-center justify-center gap-3 py-4 border-b border-gray-700 bg-gray-900">
        <span className="text-3xl">✨</span>
        <div className="text-center">
          <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            ChatBOT
          </h1>
          <p className="text-xs text-gray-400">Ask me anything — I can help with explanations, coding, and more.</p>
        </div>
        <span className="text-3xl">💬</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {chat.messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[70%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-cyan-500 text-black rounded-br-sm" : "bg-gray-700 text-white rounded-bl-sm"}`}>
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-700 text-white px-4 py-3 rounded-2xl rounded-bl-sm text-sm animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-4 border-t border-gray-700 bg-gray-900">
        <div className="flex items-center gap-2 bg-gray-700 rounded-2xl px-4 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type or hold 🎤 to speak..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1 bg-transparent text-white outline-none text-sm py-1"
          />
          <button onMouseDown={startRecording} onMouseUp={stopRecording} className={`p-2 rounded-xl ${recording ? "bg-red-500" : "bg-gray-600"}`}>
            {recording ? "🔴" : "🎤"}
          </button>
          <button onClick={sendMessage} className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
