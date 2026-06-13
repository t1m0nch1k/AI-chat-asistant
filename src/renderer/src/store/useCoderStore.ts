import { create } from 'zustand'
import { CoderFileNode, CoderWorkspaceState, CoderChatMessage, CoderInlineEditState, GitStatus, PendingChange, ComposerFile, CoderAgentStep, CoderAgentState, RelevantFile } from '../types'

// ── Store Interface ─────────────────────────────────────────────────────────────

interface CoderStore extends CoderWorkspaceState {
  isCoderMode: boolean

  // ── Chat ────────────────────────────────────────────────────────────────────
  chatMessages: CoderChatMessage[]
  chatStreaming: boolean
  chatInput: string

  // ── Inline Editing (Cmd+K) ────────────────────────────────────────────────
  inlineEdit: CoderInlineEditState | null

  // ── Editor ──────────────────────────────────────────────────────────────────
  selectedCode: { text: string; startLine: number; endLine: number } | null

  // ── Indexing ────────────────────────────────────────────────────────────────
  indexingStatus: 'idle' | 'indexing' | 'ready' | 'error'
  indexedFiles: number

  // ── Git ─────────────────────────────────────────────────────────────────────
  gitStatus: GitStatus | null

  // ── UI ──────────────────────────────────────────────────────────────────────
  showChatPanel: boolean
  activeSidePanel: 'explorer' | 'search' | 'git' | 'none'

  // ── Cursor/OpenCode: Composer ───────────────────────────────────────────────
  composerFiles: ComposerFile[]
  composerActiveFile: string | null
  showComposerPanel: boolean

  // ── Cursor/OpenCode: Agent ──────────────────────────────────────────────────
  agentState: CoderAgentState

  // ── Cursor/OpenCode: Pending Changes ────────────────────────────────────────
  pendingChanges: PendingChange[]
  showChangesPanel: boolean

  // ── Cursor/OpenCode: Relevant Files (Auto-open) ────────────────────────────
  relevantFiles: RelevantFile[]
  autoOpenFiles: boolean

  // ── Actions ─────────────────────────────────────────────────────────────────
  setCoderMode: (enabled: boolean) => void
  setWorkspaceRoot: (path: string | null) => void
  setTree: (tree: CoderFileNode[]) => void
  setScanning: (scanning: boolean) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  clearWorkspace: () => void

  // Chat
  addChatMessage: (msg: CoderChatMessage) => void
  updateLastChatMessage: (content: string) => void
  setChatStreaming: (streaming: boolean) => void
  setChatInput: (input: string) => void
  clearChat: () => void

  // Inline Edit
  startInlineEdit: (selectedCode: { text: string; startLine: number; endLine: number }) => void
  setInlineEdit: (state: CoderInlineEditState | null) => void
  applyInlineEdit: () => void
  rejectInlineEdit: () => void

  // Editor
  setSelectedCode: (selection: { text: string; startLine: number; endLine: number } | null) => void

  // Indexing
  setIndexingStatus: (status: 'idle' | 'indexing' | 'ready' | 'error') => void
  setIndexedFiles: (count: number) => void

  // Git
  setGitStatus: (status: GitStatus | null) => void

  // UI
  toggleChatPanel: () => void
  setShowChatPanel: (show: boolean) => void
  setActiveSidePanel: (panel: 'explorer' | 'search' | 'git' | 'none') => void

  // ── Cursor/OpenCode: Composer Actions ───────────────────────────────────────
  openComposerFile: (path: string, content: string) => void
  updateComposerFile: (path: string, content: string) => void
  closeComposerFile: (path: string) => void
  setComposerActiveFile: (path: string | null) => void
  toggleComposerPanel: () => void
  setShowComposerPanel: (show: boolean) => void
  applyComposerChanges: () => void
  rejectComposerChanges: () => void

  // ── Cursor/OpenCode: Agent Actions ────────────────────────────────────────
  setAgentMode: (mode: 'chat' | 'agent' | 'composer') => void
  startAgent: (goal: string) => void
  addAgentStep: (step: CoderAgentStep) => void
  updateAgentStep: (stepId: string, updates: Partial<CoderAgentStep>) => void
  completeAgent: () => void
  stopAgent: () => void
  setAutoApprove: (auto: boolean) => void

  // ── Cursor/OpenCode: Pending Changes Actions ────────────────────────────────
  addPendingChange: (change: PendingChange) => void
  applyPendingChange: (changeId: string) => void
  rejectPendingChange: (changeId: string) => void
  applyAllPendingChanges: () => void
  rejectAllPendingChanges: () => void
  clearPendingChanges: () => void
  setShowChangesPanel: (show: boolean) => void

  // ── Cursor/OpenCode: Relevant Files Actions ──────────────────────────────────
  setRelevantFiles: (files: RelevantFile[]) => void
  addRelevantFile: (file: RelevantFile) => void
  openRelevantFile: (path: string) => void
  setAutoOpenFiles: (auto: boolean) => void
  clearRelevantFiles: () => void
}

export const useCoderStore = create<CoderStore>((set, get) => ({
  // ── Base State ──────────────────────────────────────────────────────────────
  rootPath: null,
  tree: [],
  openFiles: [],
  activeFile: null,
  isScanning: false,
  isCoderMode: false,

  // ── Chat ────────────────────────────────────────────────────────────────────
  chatMessages: [],
  chatStreaming: false,
  chatInput: '',

  // ── Inline Edit ───────────────────────────────────────────────────────────
  inlineEdit: null,

  // ── Editor ─────────────────────────────────────────────────────────────────
  selectedCode: null,

  // ── Indexing ────────────────────────────────────────────────────────────────
  indexingStatus: 'idle',
  indexedFiles: 0,

  // ── Git ─────────────────────────────────────────────────────────────────────
  gitStatus: null,

  // ── UI ──────────────────────────────────────────────────────────────────────
  showChatPanel: true,
  activeSidePanel: 'explorer',

  // ── Cursor/OpenCode: Composer ───────────────────────────────────────────────
  composerFiles: [],
  composerActiveFile: null,
  showComposerPanel: false,

  // ── Cursor/OpenCode: Agent ──────────────────────────────────────────────────
  agentState: {
    isRunning: false,
    steps: [],
    currentStep: null,
    goal: '',
    mode: 'chat',
    autoApprove: false,
  },

  // ── Cursor/OpenCode: Pending Changes ────────────────────────────────────────
  pendingChanges: [],
  showChangesPanel: false,

  // ── Cursor/OpenCode: Relevant Files ────────────────────────────────────────
  relevantFiles: [],
  autoOpenFiles: true,

  // ── Actions ─────────────────────────────────────────────────────────────────
  setCoderMode: (enabled) => set({ isCoderMode: enabled }),

  setWorkspaceRoot: (rootPath) => set({ rootPath }),

  setTree: (tree) => set({ tree }),

  setScanning: (isScanning) => set({ isScanning }),

  openFile: (path) => set((state) => ({
    openFiles: state.openFiles.includes(path)
      ? state.openFiles
      : [...state.openFiles, path],
    activeFile: path,
  })),

  closeFile: (path) => set((state) => {
    const newOpenFiles = state.openFiles.filter((f) => f !== path)
    let newActiveFile = state.activeFile

    if (state.activeFile === path) {
      newActiveFile = newOpenFiles.length > 0
        ? newOpenFiles[newOpenFiles.length - 1]
        : null
    }

    return {
      openFiles: newOpenFiles,
      activeFile: newActiveFile,
    }
  }),

  setActiveFile: (activeFile) => set({ activeFile }),

  clearWorkspace: () => set({
    rootPath: null,
    tree: [],
    openFiles: [],
    activeFile: null,
    isScanning: false,
    chatMessages: [],
    inlineEdit: null,
    selectedCode: null,
    indexingStatus: 'idle',
    indexedFiles: 0,
    gitStatus: null,
    composerFiles: [],
    composerActiveFile: null,
    showComposerPanel: false,
    agentState: {
      isRunning: false,
      steps: [],
      currentStep: null,
      goal: '',
      mode: 'chat',
      autoApprove: false,
    },
    pendingChanges: [],
    showChangesPanel: false,
    relevantFiles: [],
  }),

  // ── Chat ────────────────────────────────────────────────────────────────────
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, msg],
  })),

  updateLastChatMessage: (content) => set((state) => {
    const msgs = [...state.chatMessages]
    const last = msgs[msgs.length - 1]
    if (last && last.role === 'assistant') {
      last.content = content
      last.timestamp = Date.now()
    }
    return { chatMessages: msgs }
  }),

  setChatStreaming: (chatStreaming) => set({ chatStreaming }),

  setChatInput: (chatInput) => set({ chatInput }),

  clearChat: () => set({ chatMessages: [], chatInput: '' }),

  // ── Inline Edit ─────────────────────────────────────────────────────────────
  startInlineEdit: (selectedCode) => set({
    selectedCode,
    inlineEdit: {
      status: 'input',
      originalCode: selectedCode.text,
      startLine: selectedCode.startLine,
      endLine: selectedCode.endLine,
      prompt: '',
      suggestedCode: null,
    },
  }),

  setInlineEdit: (inlineEdit) => set({ inlineEdit }),

  applyInlineEdit: () => set((state) => {
    if (!state.inlineEdit || !state.inlineEdit.suggestedCode) return state
    return {
      inlineEdit: { ...state.inlineEdit, status: 'applied' },
    }
  }),

  rejectInlineEdit: () => set({ inlineEdit: null, selectedCode: null }),

  // ── Editor ─────────────────────────────────────────────────────────────────
  setSelectedCode: (selectedCode) => set({ selectedCode }),

  // ── Indexing ────────────────────────────────────────────────────────────────
  setIndexingStatus: (indexingStatus) => set({ indexingStatus }),

  setIndexedFiles: (indexedFiles) => set({ indexedFiles }),

  // ── Git ─────────────────────────────────────────────────────────────────────
  setGitStatus: (gitStatus) => set({ gitStatus }),

  // ── UI ──────────────────────────────────────────────────────────────────────
  toggleChatPanel: () => set((state) => ({ showChatPanel: !state.showChatPanel })),

  setShowChatPanel: (showChatPanel) => set({ showChatPanel }),

  setActiveSidePanel: (activeSidePanel) => set({ activeSidePanel }),

  // ── Cursor/OpenCode: Composer ───────────────────────────────────────────────
  openComposerFile: (path, content) => set((state) => {
    const existing = state.composerFiles.find((f) => f.path === path)
    if (existing) {
      return {
        composerFiles: state.composerFiles.map((f) =>
          f.path === path ? { ...f, isActive: true } : { ...f, isActive: false }
        ),
        composerActiveFile: path,
      }
    }
    const lang = path.split('.').pop()?.toLowerCase() || 'text'
    const newFile: ComposerFile = {
      path,
      content,
      originalContent: content,
      language: lang,
      isActive: true,
      isModified: false,
    }
    return {
      composerFiles: [...state.composerFiles.map((f) => ({ ...f, isActive: false })), newFile],
      composerActiveFile: path,
      showComposerPanel: true,
    }
  }),

  updateComposerFile: (path, content) => set((state) => ({
    composerFiles: state.composerFiles.map((f) =>
      f.path === path
        ? { ...f, content, isModified: f.originalContent !== content }
        : f
    ),
  })),

  closeComposerFile: (path) => set((state) => {
    const newFiles = state.composerFiles.filter((f) => f.path !== path)
    const newActive = newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null
    return {
      composerFiles: newFiles,
      composerActiveFile: newActive,
    }
  }),

  setComposerActiveFile: (path) => set((state) => ({
    composerFiles: state.composerFiles.map((f) => ({ ...f, isActive: f.path === path })),
    composerActiveFile: path,
  })),

  toggleComposerPanel: () => set((state) => ({ showComposerPanel: !state.showComposerPanel })),

  setShowComposerPanel: (showComposerPanel) => set({ showComposerPanel }),

  applyComposerChanges: () => set((state) => {
    // Mark all modified files as applied and reset original content
    return {
      composerFiles: state.composerFiles.map((f) => ({
        ...f,
        originalContent: f.content,
        isModified: false,
      })),
      showComposerPanel: false,
    }
  }),

  rejectComposerChanges: () => set((state) => ({
    composerFiles: state.composerFiles.map((f) => ({
      ...f,
      content: f.originalContent,
      isModified: false,
    })),
  })),

  // ── Cursor/OpenCode: Agent ──────────────────────────────────────────────────
  setAgentMode: (mode) => set((state) => ({
    agentState: { ...state.agentState, mode },
  })),

  startAgent: (goal) => set((state) => ({
    agentState: {
      ...state.agentState,
      isRunning: true,
      steps: [],
      currentStep: null,
      goal,
    },
  })),

  addAgentStep: (step) => set((state) => ({
    agentState: {
      ...state.agentState,
      steps: [...state.agentState.steps, step],
      currentStep: step.id,
    },
  })),

  updateAgentStep: (stepId, updates) => set((state) => ({
    agentState: {
      ...state.agentState,
      steps: state.agentState.steps.map((s) =>
        s.id === stepId ? { ...s, ...updates } : s
      ),
    },
  })),

  completeAgent: () => set((state) => ({
    agentState: {
      ...state.agentState,
      isRunning: false,
      currentStep: null,
    },
  })),

  stopAgent: () => set((state) => ({
    agentState: {
      ...state.agentState,
      isRunning: false,
      currentStep: null,
    },
  })),

  setAutoApprove: (auto) => set((state) => ({
    agentState: { ...state.agentState, autoApprove: auto },
  })),

  // ── Cursor/OpenCode: Pending Changes ────────────────────────────────────────
  addPendingChange: (change) => set((state) => ({
    pendingChanges: [...state.pendingChanges, change],
    showChangesPanel: true,
  })),

  applyPendingChange: (changeId) => set((state) => ({
    pendingChanges: state.pendingChanges.map((c) =>
      c.id === changeId ? { ...c, status: 'applied' as const } : c
    ),
  })),

  rejectPendingChange: (changeId) => set((state) => ({
    pendingChanges: state.pendingChanges.map((c) =>
      c.id === changeId ? { ...c, status: 'rejected' as const } : c
    ),
  })),

  applyAllPendingChanges: () => set((state) => ({
    pendingChanges: state.pendingChanges.map((c) =>
      c.status === 'pending' ? { ...c, status: 'applied' as const } : c
    ),
  })),

  rejectAllPendingChanges: () => set((state) => ({
    pendingChanges: state.pendingChanges.map((c) =>
      c.status === 'pending' ? { ...c, status: 'rejected' as const } : c
    ),
  })),

  clearPendingChanges: () => set({ pendingChanges: [] }),

  setShowChangesPanel: (showChangesPanel) => set({ showChangesPanel }),

  // ── Cursor/OpenCode: Relevant Files ─────────────────────────────────────────
  setRelevantFiles: (files) => set({ relevantFiles: files }),

  addRelevantFile: (file) => set((state) => ({
    relevantFiles: [...state.relevantFiles, file],
  })),

  openRelevantFile: (path) => {
    const { openFile, autoOpenFiles } = get()
    if (autoOpenFiles) {
      openFile(path)
    }
  },

  setAutoOpenFiles: (auto) => set({ autoOpenFiles: auto }),

  clearRelevantFiles: () => set({ relevantFiles: [] }),
}))
