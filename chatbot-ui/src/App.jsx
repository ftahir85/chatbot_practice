import { useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import "./styles.css";

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);

  // Create new chat
  const createNewChat = () => {
    const id = Date.now();
    const newChat = {
      id,
      title: "New Chat",
      messages: [],
    };

    setConversations((prev) => [newChat, ...prev]);
    setActiveId(id);
  };

  // Active chat
  const activeChat = conversations.find((c) => c.id === activeId);

  // Update messages
  const updateMessages = (messages) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId ? { ...c, messages } : c
      )
    );
  };

  // ✅ NEW: update chat title on first message
  const updateChatTitle = (message) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && c.messages.length === 0
          ? {
              ...c,
              title:
                message.length > 25
                  ? message.slice(0, 25) + "..."
                  : message,
            }
          : c
      )
    );
  };

  // Delete chat
  const deleteChat = (id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (activeId === id) {
      setActiveId(null);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        createNewChat={createNewChat}
        setActiveId={setActiveId}
        deleteChat={deleteChat}
        activeId={activeId}
      />

      <ChatWindow
        chat={activeChat}
        updateMessages={updateMessages}
        updateChatTitle={updateChatTitle}
      />
    </div>
  );
}