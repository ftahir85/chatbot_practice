import { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import "./styles.css";

const API_BASE = "/api";

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    const loadChats = async () => {
      try {
        const res = await fetch(`${API_BASE}/chats`);
        if (!res.ok) throw new Error("Failed to load chats");

        const data = await res.json();

        const chats = data.map((c) => ({
          id: c.id,
          title: c.title || "New Chat",
          messages: [],
        }));

        setConversations(chats);

        if (chats.length > 0) {
          setActiveId(chats[0].id);

          const historyRes = await fetch(`${API_BASE}/history/${chats[0].id}`);
          if (!historyRes.ok) throw new Error("Failed to load chat history");

          const historyData = await historyRes.json();

          setConversations((prev) =>
            prev.map((c) =>
              c.id === chats[0].id ? { ...c, messages: historyData } : c
            )
          );
        }
      } catch (err) {
        console.error("Error loading chats:", err);
      }
    };

    loadChats();
  }, []);

  const handleSelectChat = async (chatId) => {
    setActiveId(chatId);

    try {
      const res = await fetch(`${API_BASE}/history/${chatId}`);
      if (!res.ok) throw new Error("Failed to fetch history");

      const data = await res.json();

      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, messages: data } : c
        )
      );
    } catch (err) {
      console.error("Error loading history:", err);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "New Chat" }),
      });

      if (!res.ok) throw new Error("Failed to create chat");

      const savedChat = await res.json();

      const newChat = {
        id: savedChat.id,
        title: savedChat.title || "New Chat",
        messages: [],
      };

      setConversations((prev) => [newChat, ...prev]);
      setActiveId(savedChat.id);
    } catch (err) {
      console.error("Error creating chat:", err);
    }
  };

  const updateMessages = (messages) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, messages } : c))
    );
  };

  const updateChatTitle = (message) => {
    const newTitle =
      message.slice(0, 25) + (message.length > 25 ? "..." : "");

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId && (!c.title || c.title === "New Chat")
          ? { ...c, title: newTitle }
          : c
      )
    );
  };

  const deleteChat = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/chat/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete chat");

      const updated = conversations.filter((c) => c.id !== id);
      setConversations(updated);

      if (activeId === id) {
        if (updated.length > 0) {
          const nextChat = updated[0];
          setActiveId(nextChat.id);

          const historyRes = await fetch(`${API_BASE}/history/${nextChat.id}`);
          if (!historyRes.ok) throw new Error("Failed to load next chat history");

          const historyData = await historyRes.json();

          setConversations((prev) =>
            prev.map((c) =>
              c.id === nextChat.id ? { ...c, messages: historyData } : c
            )
          );
        } else {
          setActiveId(null);
        }
      }
    } catch (err) {
      console.error("Error deleting chat:", err);
    }
  };

  const activeChat = conversations.find((c) => c.id === activeId);

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        createNewChat={createNewChat}
        loadChatHistory={handleSelectChat}
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
