import { create } from 'zustand'
import { Settings, Chat, Message, Provider, AgentTask } from '../types'

// ============================================================
// Default Settings
// ============================================================

const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o',
  ollamaBaseUrl: 'http://localhost:11434',
  openrouterBaseUrl: 'https://openrouter.ai/api/v1',
  personaId: 'professional',
  systemPrompt: 'You are a helpful AI Assistant running on Windows 11. Be concise and helpful.',
  temperature: 0.7,
  maxTokens: 2048,
  language: navigator.language.startsWith('ru') ? 'ru' : 'en',
  theme: 'dark',
  fontSize: 'md',
  sendOnEnter: true,
  autoStart: false,
  minimizeToTray: true,
  globalHotkey: 'Alt+Shift+G',
  showNotifications: true,
  proxyEnabled: false,
  proxyUrl: '',
  agentEnabled: false,
  allowedPaths: [],
  requireConfirmation: true,
  backgroundVoiceEnabled: false,
  wakeWords: ['ассистент', 'assistant', 'джарвис'],
  ttsRate: 0,
  ttsVolume: 100,
  ttsVoice: '',
  logToFile: true
}

// ============================================================
// Store Interface
// ============================================================

interface AppState {
  settings: Settings
  currentChatId: string | null
  chats: Chat[]
  isTyping: boolean
  searchQuery: string
  currentPage: 'chat' | 'settings'
  abortController: AbortController | null
  userPaths: { desktop: string; documents: string; homedir: string } | null

  // Agent state
  agentTask: AgentTask | null
  agentRunning: boolean
  setAgentTask: (task: AgentTask | null) => void
  setAgentRunning: (running: boolean) => void

  // Settings actions
  setSettings: (settings: Partial<Settings>) => void
  loadSettings: () => Promise<void>
  saveSettings: () => Promise<void>
  loadUserPaths: () => Promise<void>

  // Chat actions
  addMessage: (chatId: string, message: Message) => void
  updateLastMessage: (chatId: string, content: string) => void
  finalizeLastMessage: (chatId: string, content: string) => void
  createNewChat: () => string
  deleteChat: (chatId: string) => void
  renameChat: (chatId: string, title: string) => void
  setCurrentChat: (chatId: string) => void
  clearCurrentChat: () => void

  // UI actions
  setTyping: (isTyping: boolean) => void
  setSearchQuery: (q: string) => void
  setCurrentPage: (page: 'chat' | 'settings') => void
  setAbortController: (ctrl: AbortController | null) => void
}

// ============================================================
// Store Implementation
// ============================================================

export const useAppStore = create<AppState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  currentChatId: null,
  chats: [],
  isTyping: false,
  searchQuery: '',
  currentPage: 'chat',
  abortController: null,
  userPaths: null,
  agentTask: null,
  agentRunning: false,

  setAgentTask: (agentTask) => set({ agentTask }),
  setAgentRunning: (agentRunning) => set({ agentRunning }),

  // ── Settings ──────────────────────────────────────────────

  setSettings: (newSettings) =>
    set((state) => ({ settings: { ...state.settings, ...newSettings } })),

  loadSettings: async () => {
    try {
      const saved = await window.api.getSettings()
      if (saved?.settings) {
        set({ settings: { ...DEFAULT_SETTINGS, ...saved.settings } })
      }
      if (saved?.chats) {
        const chats: Chat[] = saved.chats
        set({
          chats,
          currentChatId: chats.length > 0 ? chats[0].id : null
        })
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  },

  saveSettings: async () => {
    const { settings, chats } = get()
    await window.api.saveSettings({ settings, chats })
  },

  loadUserPaths: async () => {
    try {
      const info = await window.api.getUserInfo()
      set({ userPaths: { desktop: info.desktop, documents: info.documents, homedir: info.homedir } })
    } catch (e) {
      console.error('Failed to load user paths:', e)
    }
  },

  // ── Chat ──────────────────────────────────────────────────

  addMessage: async (chatId, message) => {
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === chatId)
      if (idx === -1) return state
      const chats = [...state.chats]
      chats[idx] = {
        ...chats[idx],
        messages: [...chats[idx].messages, message],
        lastUpdated: Date.now(),
        // Auto-title from first user message
        title:
          chats[idx].title === 'New Chat' && message.role === 'user'
            ? message.content.slice(0, 40) + (message.content.length > 40 ? '…' : '')
            : chats[idx].title
      }
      return { chats }
    })
    // Auto-save after updating state
    const { chats } = get()
    await window.api.saveSettings({ chats })
  },

  updateLastMessage: async (chatId, content) => {
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === chatId)
      if (idx === -1) return state
      const chats = [...state.chats]
      const messages = [...chats[idx].messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = { ...messages[lastIdx], content, streaming: true }
      }
      chats[idx] = { ...chats[idx], messages, lastUpdated: Date.now() }
      return { chats }
    })
    // We don't auto-save streaming updates to avoid excessive disk I/O, 
    // but we'll save on finalize.
  },

  finalizeLastMessage: async (chatId, content) => {
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === chatId)
      if (idx === -1) return state
      const chats = [...state.chats]
      const messages = [...chats[idx].messages]
      const lastIdx = messages.length - 1
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = { ...messages[lastIdx], content, streaming: false }
      }
      chats[idx] = { ...chats[idx], messages, lastUpdated: Date.now() }
      return { chats }
    })
    const { chats } = get()
    await window.api.saveSettings({ chats })
  },

  createNewChat: async () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      lastUpdated: Date.now()
    }
    set((state) => ({
      chats: [newChat, ...state.chats],
      currentChatId: newChat.id
    }))
    const { chats } = get()
    await window.api.saveSettings({ chats })
    return newChat.id
  },

  deleteChat: async (chatId) => {
    set((state) => {
      const chats = state.chats.filter((c) => c.id !== chatId)
      const currentChatId =
        state.currentChatId === chatId ? (chats[0]?.id ?? null) : state.currentChatId
      return { chats, currentChatId }
    })
    const { chats } = get()
    await window.api.saveSettings({ chats })
  },

  renameChat: async (chatId, title) => {
    set((state) => ({
      chats: state.chats.map((c) => (c.id === chatId ? { ...c, title } : c))
    }))
    const { chats } = get()
    await window.api.saveSettings({ chats })
  },

  setCurrentChat: (chatId) => set({ currentChatId: chatId }),

  clearCurrentChat: async () => {
    set((state) => {
      const idx = state.chats.findIndex((c) => c.id === state.currentChatId)
      if (idx === -1) return state
      const chats = [...state.chats]
      chats[idx] = { ...chats[idx], messages: [], title: 'New Chat', lastUpdated: Date.now() }
      return { chats }
    })
    const { chats } = get()
    await window.api.saveSettings({ chats })
  },

  // ── UI ────────────────────────────────────────────────────

  setTyping: (isTyping) => set({ isTyping }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setAbortController: (abortController) => set({ abortController })
}))
