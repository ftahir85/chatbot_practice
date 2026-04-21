export default function Sidebar({
  conversations,
  createNewChat,
  loadChatHistory,
  deleteChat,
  activeId,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo">💬</div>
      </div>

      <button className="new-chat-btn" onClick={createNewChat}>
        + New Chat
      </button>

      <div className="section-title">✨ Recents</div>

      <div className="chat-list">
        {conversations.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${activeId === chat.id ? "active" : ""}`}
            onClick={() => loadChatHistory(chat.id)}
          >
            <span className="chat-title">{chat.title}</span>

            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                deleteChat(chat.id);
              }}
            >
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
