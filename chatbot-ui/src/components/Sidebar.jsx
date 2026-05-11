import { useState } from 'react';

export default function Sidebar({
  conversations,
  createNewChat,
  loadChatHistory,
  deleteChat,
  activeId,
}) {
  // 1. Create the state for toggling
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="w-64 h-screen bg-gray-900 flex flex-col border-r border-gray-700 flex-shrink-0">
      
      {/* HEADER */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-700">
        <span className="text-2xl">💬</span>
        <span className="text-white font-bold text-lg">ChatBOT</span>
      </div>

      {/* NEW CHAT BUTTON */}
      <div className="px-3 py-3">
        <button
          onClick={createNewChat}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-600 text-white text-sm font-medium hover:bg-gray-700 transition-all duration-200"
        >
          <span className="text-lg">+</span>
          New Chat
        </button>
      </div>

      {/* RECENTS LABEL (Now a Button for toggling) */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-1 flex items-center justify-between w-full group cursor-pointer"
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          ✨ Recents
        </span>
        {/* Simple CSS arrow that rotates based on state */}
        <span className={`text-gray-500 text-xs transition-transform duration-200 ${!isExpanded ? '-rotate-90' : ''}`}>
          ▼
        </span>
      </button>

      {/* CHAT LIST (Expandable Container) */}
      <div className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="overflow-y-auto h-full px-2 py-1 space-y-1 scrollbar-thin scrollbar-thumb-gray-600">
          {conversations.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChatHistory(chat.id)}
              className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${
                activeId === chat.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="flex-1 text-sm truncate">{chat.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all duration-200 ml-2 text-base"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}