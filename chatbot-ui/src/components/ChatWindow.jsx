import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ChatWindow({
  chat,
  updateMessages,
  updateChatTitle,
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!chat) {
    return <div className="chat-window">Select or create a chat</div>;
  }

  // ✨ NEW: Top Welcome Header
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
    if (!input.trim()) return;

    const message = input;
    setInput("");
    setLoading(true);

    // ✅ Update chat title on first message
    if (chat.messages.length === 0) {
      updateChatTitle(message);
    }

    let updatedMessages = [
      ...chat.messages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ];

    updateMessages(updatedMessages);

    try {
      const res = await fetch("http://127.0.0.1:8000/chat-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      });

      if (!res.body) {
        const data = await res.json();

        updatedMessages = [
          ...chat.messages,
          { role: "user", content: message },
          { role: "assistant", content: data.response },
        ];

        updateMessages(updatedMessages);
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let botText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        botText += decoder.decode(value, { stream: true });

        updatedMessages = [
          ...chat.messages,
          { role: "user", content: message },
          { role: "assistant", content: botText },
        ];

        updateMessages(updatedMessages);
      }
    } catch (err) {
      console.error("Error:", err);

      updateMessages([
        ...chat.messages,
        { role: "user", content: message },
        { role: "assistant", content: "Error getting response." },
      ]);
    }

    setLoading(false);
  };

  return (
    <div className="chat-window">

      {/* ✨ NEW TOP HEADER */}
      <WelcomeHeader />

      {/* MESSAGES */}
      <div className="messages">
        {chat.messages.map((m, i) => (
          <div key={i} className={m.role}>
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      {/* INPUT */}
      <div className="input-box">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message..."
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button onClick={sendMessage} disabled={loading}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}