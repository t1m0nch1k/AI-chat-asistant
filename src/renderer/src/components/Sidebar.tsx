import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  MessageSquare,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  Pencil,
  Check,
  X,
  AlarmClock
} from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { Chat } from '../types'
import { cn } from '../utils/cn'
import { AgentPanel } from './AgentPanel'
import { AgentMemory } from './AgentMemory'

export const Sidebar: React.FC<{ onOpenScheduler?: () => void }> = ({ onOpenScheduler }) => {
  const {
    chats,
    currentChatId,
    searchQuery,
    setSearchQuery,
    createNewChat,
    deleteChat,
    renameChat,
    setCurrentChat,
    setCurrentPage,
    agentTask
  } = useAppStore()

  const [collapsed, setCollapsed] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pinned chats first
  const sorted = [
    ...filtered.filter((c) => c.pinned),
    ...filtered.filter((c) => !c.pinned)
  ]

  const handleNewChat = () => {
    const id = createNewChat()
    setCurrentChat(id)
    setCurrentPage('chat')
  }

  const startEdit = (chat: Chat) => {
    setEditingId(chat.id)
    setEditValue(chat.title)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) {
      renameChat(editingId, editValue.trim())
    }
    setEditingId(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const togglePin = (chatId: string) => {
    const chat = chats.find((c) => c.id === chatId)
    if (!chat) return
    // We use renameChat-like approach via store — update pinned via setSettings workaround
    // Actually we need to update the chat object directly
    useAppStore.setState((state) => ({
      chats: state.chats.map((c) =>
        c.id === chatId ? { ...c, pinned: !c.pinned } : c
      )
    }))
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-2 border-r border-white/5 w-10">
        <button
          onClick={() => setCollapsed(false)}
          title="Expand sidebar"
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={handleNewChat}
          title="New Chat"
          className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-white/40 hover:text-white"
        >
          <Plus size={14} />
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 180, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col border-r border-white/5 overflow-hidden"
      style={{ width: 180, minWidth: 180 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">
          Chats
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewChat}
            title="New Chat"
            className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          >
            <Plus size={13} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2 py-2">
        <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
          <Search size={11} className="text-white/30 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="bg-transparent text-[11px] outline-none w-full text-white/70 placeholder:text-white/25"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-white/20 hover:text-white/50 transition-colors"
            >
              <X size={10} />
            </button>
          )}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        <AnimatePresence>
          {sorted.length === 0 && (
            <p className="text-[11px] text-white/25 text-center py-4">
              {searchQuery ? 'No results' : 'No chats yet'}
            </p>
          )}
          {sorted.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={chat.id === currentChatId}
              isHovered={hoveredId === chat.id}
              isEditing={editingId === chat.id}
              editValue={editValue}
              onHover={setHoveredId}
              onSelect={() => {
                if (editingId === chat.id) return
                setCurrentChat(chat.id)
                setCurrentPage('chat')
              }}
              onDelete={() => deleteChat(chat.id)}
              onStartEdit={() => startEdit(chat)}
              onCommitEdit={commitEdit}
              onCancelEdit={cancelEdit}
              onEditChange={setEditValue}
              onTogglePin={() => togglePin(chat.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Scheduler Button */}
      <div className="px-2 py-2">
        <button
          onClick={onOpenScheduler}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all text-[11px] font-medium border border-white/5"
        >
          <AlarmClock size={13} className="text-accent" />
          <span>Scheduler</span>
        </button>
      </div>

      {/* Agent Panel */}
      <AgentPanel
        task={agentTask}
        onStop={() => { window.api.agentStop() }}
      />

      {/* Agent Memory */}
      <AgentMemory />
    </motion.div>
  )
}

// ── Chat Item ─────────────────────────────────────────────────────────────────

interface ChatItemProps {
  chat: Chat
  isActive: boolean
  isHovered: boolean
  isEditing: boolean
  editValue: string
  onHover: (id: string | null) => void
  onSelect: () => void
  onDelete: () => void
  onStartEdit: () => void
  onCommitEdit: () => void
  onCancelEdit: () => void
  onEditChange: (v: string) => void
  onTogglePin: () => void
}

const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  isActive,
  isHovered,
  isEditing,
  editValue,
  onHover,
  onSelect,
  onDelete,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onEditChange,
  onTogglePin
}) => {
  const timeAgo = formatTimeAgo(chat.lastUpdated)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex items-start gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors',
        isActive ? 'bg-accent/20 text-white' : 'hover:bg-white/5 text-white/60 hover:text-white'
      )}
      onClick={onSelect}
      onMouseEnter={() => onHover(chat.id)}
      onMouseLeave={() => onHover(null)}
    >
      {chat.pinned ? (
        <Pin size={11} className="mt-0.5 shrink-0 opacity-60 text-accent" />
      ) : (
        <MessageSquare size={11} className="mt-0.5 shrink-0 opacity-60" />
      )}

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCommitEdit()
              if (e.key === 'Escape') onCancelEdit()
              e.stopPropagation()
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white/10 border border-accent/40 rounded px-1 py-0.5 text-[11px] outline-none text-white"
          />
        ) : (
          <>
            <p className="text-[11px] font-medium truncate leading-tight">{chat.title}</p>
            <p className="text-[10px] text-white/25 mt-0.5">{timeAgo}</p>
          </>
        )}
      </div>

      {/* Action buttons */}
      {isEditing ? (
        <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onCommitEdit}
            className="p-0.5 rounded hover:bg-green-500/20 text-green-400 transition-colors"
            title="Save"
          >
            <Check size={11} />
          </button>
          <button
            onClick={onCancelEdit}
            className="p-0.5 rounded hover:bg-white/10 text-white/30 transition-colors"
            title="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      ) : isHovered ? (
        <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onTogglePin}
            className={cn(
              'p-0.5 rounded transition-colors',
              chat.pinned
                ? 'text-accent hover:bg-accent/20'
                : 'text-white/30 hover:bg-white/10 hover:text-white/60'
            )}
            title={chat.pinned ? 'Unpin' : 'Pin'}
          >
            {chat.pinned ? <PinOff size={10} /> : <Pin size={10} />}
          </button>
          <button
            onClick={onStartEdit}
            className="p-0.5 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            title="Rename"
          >
            <Pencil size={10} />
          </button>
          <button
            onClick={onDelete}
            className="p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={10} />
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}
