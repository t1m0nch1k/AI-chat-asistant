import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../store/useAppStore'
import { useCoderStore } from '../store/useCoderStore'
import { Chat } from '../types'
import { cn } from '../utils/cn'
import { FileExplorer } from './Workspace/FileExplorer'

export const Sidebar: React.FC<{ onOpenScheduler?: () => void }> = ({ onOpenScheduler }) => {
  const { isCoderMode } = useCoderStore()

  if (isCoderMode) return null

  return (
    <nav className="w-sidebar-width min-w-[260px] bg-surface-container-low/70 backdrop-blur-xl border-r border-outline-variant flex flex-col h-full z-40">
      <AISidebar onOpenScheduler={onOpenScheduler} />
    </nav>
  )
}

// ── AI Mode Sidebar ────────────────────────────────────────────────────────

const AISidebar: React.FC<{ onOpenScheduler?: () => void }> = ({ onOpenScheduler }) => {
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
  } = useAppStore()

  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const filtered = chats.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const sorted = [...filtered.filter((c) => c.pinned), ...filtered.filter((c) => !c.pinned)]

  const handleNewChat = async () => {
    const id = await createNewChat()
    setCurrentChat(id)
    setCurrentPage('chat')
  }

  const startEdit = (chat: Chat) => {
    setEditingId(chat.id)
    setEditValue(chat.title)
  }

  const commitEdit = () => {
    if (editingId && editValue.trim()) renameChat(editingId, editValue.trim())
    setEditingId(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  const togglePin = (chatId: string) => {
    useAppStore.setState((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, pinned: !c.pinned } : c)),
    }))
  }

  const handleOpenWorkspace = async () => {
    try {
      const r = await window.api.coderPickWorkspace()
      if (r?.success && r.data) {
        useCoderStore.setState({ rootPath: r.data.path })
        setTimeout(async () => {
          const scan = await window.api.coderScan(true)
          if (scan.success && scan.data) useCoderStore.setState({ tree: scan.data.tree })
        }, 100)
      }
    } catch (e) {
      console.error('Failed to pick workspace:', e)
    }
  }

  return (
    <>
      <div className="px-md py-md border-b border-outline-variant/50">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-xs bg-primary text-on-primary py-sm rounded-md font-label-caps text-label-caps hover:bg-primary-fixed-dim transition-colors active:scale-95 shadow-sm"
        >
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
          New Chat
        </button>
      </div>

      <div className="px-sm pt-md pb-sm flex flex-col gap-[2px]">
        <NavItem icon="chat" label="Chat" active onClick={() => setCurrentPage('chat')} />
        <NavItem icon="history" label="History" onClick={() => setSearchQuery('')} />
        <NavItem icon="folder" label="Projects" onClick={handleOpenWorkspace} />
        <NavItem icon="extension" label="Extensions" onClick={() => window.api.openUrl('https://open-vsx.org/')} />
      </div>

      <div className="px-sm mb-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-sm flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">search</span>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-surface-container-high border-none rounded-md py-[6px] pl-[28px] pr-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/50 focus:ring-1 focus:ring-primary/50 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-sm flex items-center text-on-surface-variant/50 hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-sm pb-sm flex flex-col gap-[2px]">
        <AnimatePresence>
          {sorted.length === 0 && (
            <p className="text-body-sm text-on-surface-variant/50 text-center py-md">
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
              onSelect={() => { if (editingId !== chat.id) { setCurrentChat(chat.id); setCurrentPage('chat') } }}
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

      <div className="mt-auto px-sm flex flex-col gap-[2px] pt-md border-t border-outline-variant/30 mx-sm pb-sm">
        <NavItem icon="help" label="Help" onClick={() => window.api.openUrl('https://opencode.ai')} />
        <NavItem icon="feedback" label="Feedback" onClick={() => window.api.openUrl('https://docs.google.com/forms/d/e/1FAIpQLSesBH7_FYbgCepuPATAw_qhehV3656bm4akXKLGN8EgVVwBNA/viewform?usp=dialog')} />
      </div>
    </>
  )
}

// ── Coder Mode Sidebar ─────────────────────────────────────────────────────

const CoderSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState('folder')
  const [projectLoading, setProjectLoading] = useState(false)
  const { chats } = useAppStore()

  const handleNewProject = async () => {
    if (projectLoading) return
    setProjectLoading(true)
    try {
      const result = await window.api.coderPickWorkspace()
      if (result && result.success && result.data) {
        const path = result.data.path
        if (!path) return
        
        // 1. Set the root path in the Main process first (Crucial for scan to work)
        await window.api.coderSetWorkspace(path)
        
        // 2. Update the CoderStore rootPath (for UI)
        useCoderStore.getState().setWorkspaceRoot(path)
        
        // 3. Trigger the scan
        const scanResult = await window.api.coderScan(true)
        if (scanResult && scanResult.success && scanResult.data) {
          useCoderStore.getState().setTree(scanResult.data.tree)
        } else {
          console.error('Coder scan failed:', scanResult?.error)
        }
      }
    } catch (e) {
      console.error('Critical error in Coder project selection:', e)
    } finally {
      setProjectLoading(false)
    }
  }

  return (
    <>
      <div className="px-md py-md border-b border-outline-variant/50 flex gap-xs">
        <button
          onClick={handleNewProject}
          disabled={projectLoading}
          className="flex-1 flex items-center justify-center gap-xs bg-secondary text-on-secondary py-sm rounded-md font-label-caps text-label-caps hover:bg-secondary-fixed transition-colors active:scale-95 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[14px]">{projectLoading ? 'sync' : 'add'}</span>
          {projectLoading ? 'Opening...' : 'New Project'}
        </button>
        <button
          onClick={handleNewProject}
          disabled={projectLoading}
          className="px-sm flex items-center justify-center gap-xs bg-surface-container text-on-surface border border-outline-variant/50 rounded-md hover:bg-surface-container-high transition-colors active:scale-95 disabled:opacity-50"
          title="Select Folder"
        >
          <span className="material-symbols-outlined text-[14px]">folder_open</span>
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[48px] border-r border-outline-variant/30 flex flex-col items-center py-sm gap-sm shrink-0">
          <ActivityBarItem icon="chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
          <ActivityBarItem icon="history" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <ActivityBarItem icon="folder" active={activeTab === 'folder'} onClick={() => setActiveTab('folder')} />
          <ActivityBarItem icon="extension" active={activeTab === 'extension'} onClick={() => setActiveTab('extension')} />
          <div className="mt-auto flex flex-col gap-sm">
            <ActivityBarItem icon="help" onClick={() => window.api.openUrl('https://opencode.ai')} />
            <ActivityBarItem icon="feedback" onClick={() => window.api.openUrl('https://docs.google.com/forms/d/e/1FAIpQLSesBH7_FYbgCepuPATAw_qhehV3656bm4akXKLGN8EgVVwBNA/viewform?usp=dialog')} />
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {activeTab === 'folder' && (
            <div className="flex-1 overflow-y-auto px-sm py-sm">
              <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">PROJECT FILES</div>
              <p className="text-body-sm text-on-surface-variant/50 text-center py-md">
                Explorer is available in the main workspace panel.
              </p>
            </div>
          )}
          {activeTab === 'chat' && (
            <div className="flex-1 overflow-y-auto px-sm py-sm flex flex-col gap-[2px]">
              <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">RECENT CHATS</div>
              {chats.length === 0 && <p className="text-body-sm text-on-surface-variant/50 text-center py-md">No chats yet</p>}
              {chats.slice(0, 10).map((c) => (
                <div key={c.id} className="flex items-center gap-sm px-md py-[4px] rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors">
                  <span className="material-symbols-outlined text-[14px]">chat</span>
                  <span className="text-body-sm truncate">{c.title}</span>
                </div>
              ))}
            </div>
          )}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto px-sm py-sm">
              <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">VERSION HISTORY</div>
              <p className="text-body-sm text-on-surface-variant/50 text-center py-md">Git integration coming soon</p>
            </div>
          )}
          {activeTab === 'extension' && (
            <div className="flex-1 overflow-y-auto px-sm py-sm">
              <div className="font-label-caps text-label-caps text-on-surface-variant px-md py-sm">EXTENSIONS</div>
              <p className="text-body-sm text-on-surface-variant/50 text-center py-md">Browse extensions via the command palette.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── Nav Item ────────────────────────────────────────────────────────────────

const NavItem: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-sm px-md py-sm rounded-xl transition-all duration-200 cursor-pointer select-none text-label-caps w-full text-left',
      active
        ? 'bg-secondary-container/10 text-secondary border-l-2 border-secondary'
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
    )}
  >
    <span className="material-symbols-outlined text-[18px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {icon}
    </span>
    <span className="mt-[1px]">{label}</span>
  </button>
)

// ── Activity Bar Item ──────────────────────────────────────────────────────

const ActivityBarItem: React.FC<{ icon: string; active?: boolean; onClick?: () => void }> = ({ icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'p-sm rounded-md transition-all duration-150 relative cursor-pointer',
      active
        ? 'bg-secondary-container/20 text-secondary'
        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
    )}
  >
    {active && <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-secondary rounded-r-full" />}
    <span className="material-symbols-outlined text-[20px]" style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
      {icon}
    </span>
  </button>
)

// ── Chat Item ───────────────────────────────────────────────────────────────

interface ChatItemProps {
  chat: Chat; isActive: boolean; isHovered: boolean; isEditing: boolean; editValue: string
  onHover: (id: string | null) => void; onSelect: () => void; onDelete: () => void
  onStartEdit: () => void; onCommitEdit: () => void; onCancelEdit: () => void
  onEditChange: (v: string) => void; onTogglePin: () => void
}

const ChatItem: React.FC<ChatItemProps> = ({
  chat, isActive, isHovered, isEditing, editValue, onHover, onSelect,
  onDelete, onStartEdit, onCommitEdit, onCancelEdit, onEditChange, onTogglePin,
}) => {
  const timeAgo = formatTimeAgo(chat.lastUpdated)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [isEditing])

  return (
    <motion.div
      layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group flex items-center gap-sm px-md py-[6px] rounded-xl cursor-pointer transition-all duration-150',
        isActive ? 'bg-secondary-container/10 text-secondary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high',
      )}
      onClick={onSelect}
      onMouseEnter={() => onHover(chat.id)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="material-symbols-outlined text-[16px] shrink-0" style={chat.pinned ? { fontVariationSettings: "'FILL' 1" } : undefined}>
        {chat.pinned ? 'pin' : 'chat'}
      </span>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onCommitEdit(); if (e.key === 'Escape') onCancelEdit(); e.stopPropagation() }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-surface-container-high border border-primary/40 rounded px-1 py-0.5 text-body-sm outline-none text-on-surface"
          />
        ) : (
          <>
            <p className="text-body-sm font-medium truncate leading-tight">{chat.title}</p>
            <p className="text-[10px] text-on-surface-variant/40 mt-[1px]">{timeAgo}</p>
          </>
        )}
      </div>
      {isEditing ? (
        <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onCommitEdit} className="p-0.5 rounded hover:bg-secondary/20 text-secondary transition-colors"><span className="material-symbols-outlined text-[12px]">check</span></button>
          <button onClick={onCancelEdit} className="p-0.5 rounded hover:bg-surface-container-highest text-on-surface-variant transition-colors"><span className="material-symbols-outlined text-[12px]">close</span></button>
        </div>
      ) : isHovered ? (
        <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onTogglePin} className={cn('p-0.5 rounded transition-colors', chat.pinned ? 'text-secondary hover:bg-secondary/20' : 'text-on-surface-variant/50 hover:bg-surface-container-highest')}>
            <span className="material-symbols-outlined text-[12px]">{chat.pinned ? 'pin' : 'keep'}</span>
          </button>
          <button onClick={onStartEdit} className="p-0.5 rounded hover:bg-surface-container-highest text-on-surface-variant/50 hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[12px]">edit</span>
          </button>
          <button onClick={onDelete} className="p-0.5 rounded hover:bg-error/20 text-on-surface-variant/50 hover:text-error transition-colors">
            <span className="material-symbols-outlined text-[12px]">delete</span>
          </button>
        </div>
      ) : null}
    </motion.div>
  )
}

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
