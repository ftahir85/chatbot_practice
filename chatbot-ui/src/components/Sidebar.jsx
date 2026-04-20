export default function Sidebar({
  conversations,
  createNewChat,
  setActiveId,
  deleteChat,
  activeId,
}) {
  return (
    <div className="sidebar">

      {/* HEADER */}
      <div className="sidebar-header">
        <div className="logo">💬</div>
        
      </div>

      {/* NEW CHAT BUTTON */}
      <button className="new-chat-btn" onClick={createNewChat}>
        + New Chat
      </button>

      {/* RECENTS (UPDATED LOOK) */}
      <div className="section-title">✨ Recents</div>

      {/* CHAT LIST */}
      <div className="chat-list">
        {conversations.map((chat) => (
          <div
            key={chat.id}
            className={`chat-item ${
              activeId === chat.id ? "active" : ""
            }`}
            onClick={() => setActiveId(chat.id)}
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