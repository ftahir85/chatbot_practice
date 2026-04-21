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
      const res = await fetch("/api/chat-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          chat_id: chat.id,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response body from server");
      }

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
        {
          role: "assistant",
          content: botText || "No response received.",
        },
      ];

      updateMessages(updatedMessages);
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
          placeholder="Type message..."
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}
