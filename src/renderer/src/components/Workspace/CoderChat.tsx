import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { useAppStore } from '../../store/useAppStore'
import { cn } from '../../utils/cn'
import { CoderChatMessage, CodeChange, PendingChange } from '../../types'
import { useCoderAgentLoop } from '../../hooks/useCoderAgentLoop'

// ── Mode Switcher ─────────────────────────────────────────────────────────────

const ModeSwitcher: React.FC = () => {
  const { agentState, setAgentMode } = useCoderStore()
  const modes = [
    { id: 'chat' as const, label: 'Chat', icon: 'chat', desc: 'Ask questions' },
    { id: 'agent' as const, label: 'Agent', icon: 'auto_fix_high', desc: 'AI works autonomously' },
    { id: 'composer' as const, label: 'Composer', icon: 'edit_note', desc: 'Multi-file editing' },
  ]

  return (
    <div className="flex gap-xs bg-surface-container-high rounded-lg p-[2px] shrink-0">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setAgentMode(mode.id)}
          className={cn(
            'flex items-center gap-xs px-sm py-[4px] rounded-md text-[11px] font-medium transition-all',
            agentState.mode === mode.id
              ? 'bg-secondary text-on-secondary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
          )}
          title={mode.desc}
        >
          <span className="material-symbols-outlined text-[14px]">{mode.icon}</span>
          {mode.label}
        </button>
      ))}
    </div>
  )
}

// ── Agent Status Panel ────────────────────────────────────────────────────────

const AgentStatusPanel: React.FC<{ plan: any }> = ({ plan }) => {
  if (!plan || plan.status === 'idle') return null

  const steps = plan.steps || []
  const currentStepIdx = plan.currentStep

  return (
    <div className="border-b border-outline-variant/30 bg-surface-container p-sm space-y-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-[14px] text-secondary animate-spin">sync</span>
          <span className="text-[11px] font-medium text-on-surface">Agent: {plan.goal.slice(0, 50)}...</span>
        </div>
        <span className="text-[10px] text-on-surface-variant">{plan.status}</span>
      </div>
      <div className="space-y-[2px]">
        {steps.map((step: any, i: number) => (
          <div key={step.id} className="flex items-center gap-xs text-[10px]">
            <span className={cn(
              'material-symbols-outlined text-[12px]',
              step.status === 'done' ? 'text-success' :
              step.status === 'failed' ? 'text-error' :
              i === currentStepIdx ? 'text-secondary animate-spin' : 'text-on-surface-variant'
            )}>
              {step.status === 'done' ? 'check_circle' :
               step.status === 'failed' ? 'error' :
               i === currentStepIdx ? 'sync' : 'circle'}
            </span>
            <span className={cn(
              'text-on-surface-variant',
              step.status === 'done' && 'line-through opacity-50'
            )}>
              {step.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Relevant Files Suggestion ─────────────────────────────────────────────────

const RelevantFilesPanel: React.FC = () => {
  const { relevantFiles, autoOpenFiles, setAutoOpenFiles, openRelevantFile, clearRelevantFiles } = useCoderStore()

  if (relevantFiles.length === 0) return null

  return (
    <div className="border-b border-outline-variant/30 bg-surface-container p-sm space-y-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-[14px] text-secondary">lightbulb</span>
          <span className="text-[11px] font-medium text-on-surface">Relevant Files</span>
        </div>
        <div className="flex items-center gap-xs">
          <label className="flex items-center gap-[2px] text-[10px] text-on-surface-variant cursor-pointer">
            <input
              type="checkbox"
              checked={autoOpenFiles}
              onChange={(e) => setAutoOpenFiles(e.target.checked)}
              className="accent-secondary"
            />
            Auto-open
          </label>
          <button
            onClick={clearRelevantFiles}
            className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-error transition-colors"
          >
            close
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-xs">
        {relevantFiles.map((file) => (
          <button
            key={file.path}
            onClick={() => openRelevantFile(file.path)}
            className="flex items-center gap-[2px] px-xs py-[2px] bg-secondary/10 text-secondary rounded text-[10px] hover:bg-secondary/20 transition-colors"
            title={file.reason}
          >
            <span className="material-symbols-outlined text-[10px]">description</span>
            {file.path.split('/').pop()}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Main Chat Component ───────────────────────────────────────────────────────

export const CoderChat: React.FC = () => {
  const {
    rootPath,
    activeFile,
    chatMessages,
    chatStreaming,
    chatInput,
    addChatMessage,
    updateLastChatMessage,
    setChatStreaming,
    setChatInput,
    clearChat,
    openFile,
    agentState,
    startAgent,
    addAgentStep,
    updateAgentStep,
    completeAgent,
    stopAgent,
    setAutoApprove,
    addPendingChange,
    applyPendingChange,
    rejectPendingChange,
    applyAllPendingChanges,
    rejectAllPendingChanges,
    setRelevantFiles,
    openRelevantFile,
    pendingChanges,
    showChangesPanel,
    setShowChangesPanel,
    composerFiles,
    openComposerFile,
    updateComposerFile,
  } = useCoderStore()

  const { settings } = useAppStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionIndex, setMentionIndex] = useState(0)
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const abortRef = useRef(false)

  const { run: runAgentLoop, stop: stopAgentLoop, plan: agentPlan, isRunning: isAgentRunning } = useCoderAgentLoop({
    settings,
    onStepResult: (step, result) => {
      addAgentStep({
        id: step.id,
        type: step.toolCall?.name === 'read_file' ? 'read' :
            step.toolCall?.name === 'write_file' ? 'write' :
            step.toolCall?.name === 'run_terminal' ? 'terminal' :
            step.toolCall?.name === 'search_codebase' ? 'search' : 'thinking',
        description: step.description,
        status: step.status as any,
        timestamp: Date.now(),
      })
      
      if (result.length > 200) {
        addChatMessage({
          id: crypto.randomUUID(),
          role: 'system',
          content: `Result from ${step.description}: ${result.slice(0, 500)}...`,
          timestamp: Date.now(),
        })
      }
    },
    onComplete: (summary) => {
      addChatMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: summary,
        timestamp: Date.now(),
      })
      completeAgent()
    }
  })

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatStreaming])

  // Build system prompt with context (Cursor/OpenCode style)
  const buildSystemPrompt = useCallback(() => {
    const parts: string[] = []
    parts.push(`You are Nexus Coder, an AI coding assistant integrated into an IDE similar to Cursor and VS Code with Copilot.`)
    parts.push(`You help users write, edit, and understand code. You have full access to the workspace.`)
    parts.push(`Workspace: ${rootPath || '(none)'}`)

    if (activeFile) {
      parts.push(`\nCurrently open file: ${activeFile}`)
    }

    if (attachedFiles.length > 0) {
      parts.push(`\nAttached files: ${attachedFiles.join(', ')}`)
    }

    // Add composer context if in composer mode
    if (agentState.mode === 'composer' && composerFiles.length > 0) {
      parts.push(`\nComposer files (multi-file editing mode):`)
      for (const f of composerFiles) {
        parts.push(`  - ${f.path} (${f.isModified ? 'modified' : 'clean'})`)
      }
    }

    // Add active mode info
    parts.push(`\nMode: ${agentState.mode}`)
    if (agentState.mode === 'agent') {
      parts.push(`In Agent mode, you can propose file reads, searches, and edits. You control the workflow.`)
    }
    if (agentState.mode === 'composer') {
      parts.push(`In Composer mode, you can edit multiple files simultaneously. Show all changes at once.`)
    }

    parts.push(`\nWhen suggesting code changes, use these formats:`)
    parts.push(`\nFor file edits (with unified diff context):`)
    parts.push(`\`\`\`change:filepath`)
    parts.push(`// new or modified code`)
    parts.push(`\`\`\``)
    parts.push(`\nFor creating new files:`)
    parts.push(`\`\`\`create:filepath`)
    parts.push(`// new file content`)
    parts.push(`\`\`\``)
    parts.push(`\nFor reading files (you can suggest opening):`)
    parts.push(`\`\`\`open:filepath`)
    parts.push(`reason: why this file is relevant`)
    parts.push(`\`\`\``)
    parts.push(`\nFor running terminal commands:`)
    parts.push(`\`\`\`terminal`)
    parts.push(`command`)
    parts.push(`\`\`\``)
    parts.push(`\nFor searching the codebase:`)
    parts.push(`\`\`\`search:query`)
    parts.push(`\`\`\``)

    parts.push(`\nWhen you need to read a file, say "I'll read [filename]" and use the open format.`)
    parts.push(`When you need to run a command, say "I'll run: [command]" and use the terminal format.`)

    return parts.join('\n')
  }, [rootPath, activeFile, attachedFiles, agentState.mode, agentState.goal, composerFiles])

  // Parse AI response for various actions
  const parseAIResponse = (content: string) => {
    const changes: CodeChange[] = []
    const pending: PendingChange[] = []
    const opens: { path: string; reason: string }[] = []
    const terminals: { command: string }[] = []
    const searches: { query: string }[] = []

    // Parse change blocks
    const changeRegex = /```change:([^\n]+)\n([\s\S]*?)```/g
    let match
    while ((match = changeRegex.exec(content)) !== null) {
      const filePath = match[1].trim()
      const code = match[2].trim()
      changes.push({
        id: crypto.randomUUID(),
        filePath,
        originalCode: '',
        suggestedCode: code,
        startLine: 0,
        endLine: 0,
        status: 'pending',
        description: `Change in ${filePath}`,
      })
      pending.push({
        id: crypto.randomUUID(),
        filePath,
        originalCode: '',
        suggestedCode: code,
        startLine: 0,
        endLine: 0,
        status: 'pending',
        description: `Change in ${filePath}`,
      })
    }

    // Parse create blocks
    const createRegex = /```create:([^\n]+)\n([\s\S]*?)```/g
    while ((match = createRegex.exec(content)) !== null) {
      const filePath = match[1].trim()
      const code = match[2].trim()
      pending.push({
        id: crypto.randomUUID(),
        filePath,
        originalCode: '',
        suggestedCode: code,
        startLine: 0,
        endLine: 0,
        status: 'pending',
        description: `Create ${filePath}`,
        isNewFile: true,
      })
    }

    // Parse open blocks
    const openRegex = /```open:([^\n]+)\n(?:reason:\s*)?([^`]*)?```/g
    while ((match = openRegex.exec(content)) !== null) {
      opens.push({
        path: match[1].trim(),
        reason: (match[2] || 'Relevant file').trim(),
      })
    }

    // Also catch inline "open:path" mentions
    const inlineOpenRegex = /open:([\w./\\-]+\.[\w]+)/g
    while ((match = inlineOpenRegex.exec(content)) !== null) {
      const path = match[1].trim()
      if (!opens.find((o) => o.path === path)) {
        opens.push({ path, reason: 'Mentioned in response' })
      }
    }

    // Parse terminal blocks
    const terminalRegex = /```terminal\n([\s\S]*?)```/g
    while ((match = terminalRegex.exec(content)) !== null) {
      terminals.push({ command: match[1].trim() })
    }

    // Parse search blocks
    const searchRegex = /```search:([^\n]+)```/g
    while ((match = searchRegex.exec(content)) !== null) {
      searches.push({ query: match[1].trim() })
    }

    return { changes, pending, opens, terminals, searches }
  }

  // Execute auto-actions from AI response
  const executeAutoActions = async (parsed: ReturnType<typeof parseAIResponse>) => {
    // Auto-open suggested files
    if (parsed.opens.length > 0) {
      const relevantFiles = parsed.opens.map((o) => ({
        path: o.path,
        reason: o.reason,
        score: 1.0,
      }))
      setRelevantFiles(relevantFiles)
      for (const f of relevantFiles) {
        openRelevantFile(f.path)
      }
    }

    // Add pending changes
    for (const change of parsed.pending) {
      addPendingChange(change)
    }

    // Execute terminal commands in agent mode (with confirmation unless auto-approve)
    if (agentState.mode === 'agent' && parsed.terminals.length > 0) {
      for (const t of parsed.terminals) {
        if (agentState.autoApprove) {
          try {
            const result = await window.api.coderTerminal(t.command)
            if (result.success) {
              addChatMessage({
                id: crypto.randomUUID(),
                role: 'system',
                content: `Terminal: ${t.command}\n${result.stdout || '(no output)'}`,
                timestamp: Date.now(),
              })
            }
          } catch (e: any) {
            addChatMessage({
              id: crypto.randomUUID(),
              role: 'system',
              content: `Terminal error: ${e.message}`,
              timestamp: Date.now(),
            })
          }
        }
      }
    }

    // Handle searches
    if (parsed.searches.length > 0) {
      for (const s of parsed.searches) {
        try {
          const result = await window.api.coderSearchCodebase(s.query)
          if (result.success && result.results) {
            addChatMessage({
              id: crypto.randomUUID(),
              role: 'system',
              content: `Search results for "${s.query}":\n${result.results.slice(0, 5).map((r) => `- ${r.relativePath}:${r.line}: ${r.text}`).join('\n')}`,
              timestamp: Date.now(),
            })
          }
        } catch (e) {
          // ignore search errors
        }
      }
    }
  }

  // Handle @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setChatInput(value)

    const lastAt = value.lastIndexOf('@')
    if (lastAt !== -1) {
      const afterAt = value.slice(lastAt + 1)
      const beforeAt = value.slice(0, lastAt)
      if (!afterAt.includes(' ') && (beforeAt.length === 0 || /\s$/.test(beforeAt))) {
        setMentionQuery(afterAt.toLowerCase())
        setShowMentions(true)
        setMentionIndex(0)
      } else {
        setShowMentions(false)
      }
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (filePath: string) => {
    const lastAt = chatInput.lastIndexOf('@')
    const newInput = chatInput.slice(0, lastAt) + `@${filePath} `
    setChatInput(newInput)
    setShowMentions(false)
    setAttachedFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]))
    inputRef.current?.focus()
  }

  const getMentionCandidates = () => {
    const { tree } = useCoderStore.getState()
    const files: string[] = []
    const collect = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.isDirectory) {
          files.push(node.relativePath)
        }
        if (node.children) collect(node.children)
      }
    }
    collect(tree)
    return files.filter((f) => f.toLowerCase().includes(mentionQuery))
  }

  // Main send handler
  const handleSend = async () => {
    if (!chatInput.trim() || chatStreaming) return
    abortRef.current = false

    const userContent = chatInput.trim()
    const userMsg: CoderChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
      attachedFiles: [...attachedFiles],
    }

    addChatMessage(userMsg)
    setChatInput('')
    setAttachedFiles([])
    setChatStreaming(true)

    // Add placeholder assistant message
    const assistantMsg: CoderChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    }
    addChatMessage(assistantMsg)

    if (agentState.mode === 'agent' || agentState.mode === 'composer') {
      startAgent(userContent)
      setChatStreaming(false)
      try {
        const summary = await runAgentLoop(userContent)
        updateLastChatMessage(summary)
      } catch (e: any) {
        updateLastChatMessage(`Agent Error: ${e.message}`)
      } finally {
        setChatStreaming(false)
      }
      return
    }

    try {
      const systemPrompt = buildSystemPrompt()

      // Read attached files for context
      let fileContext = ''
      if (attachedFiles.length > 0) {
        addAgentStep({
          id: crypto.randomUUID(),
          type: 'read',
          description: `Reading ${attachedFiles.length} attached files`,
          status: 'running',
          timestamp: Date.now(),
        })
        const readResults = await window.api.coderReadMultiple(attachedFiles)
        if (readResults.success && readResults.files) {
          for (const file of readResults.files) {
            if (!file.error) {
              fileContext += `\n\n--- ${file.path} ---\n${file.content.slice(0, 8000)}\n`
            }
          }
        }
      }

      // Read active file for context
      let activeFileContext = ''
      if (activeFile) {
        try {
          const readResult = await window.api.coderRead(activeFile)
          if (readResult.success && readResult.content) {
            activeFileContext = `\n\n--- Active file: ${activeFile} ---\n${readResult.content.slice(0, 4000)}\n`
          }
        } catch {
          // ignore
        }
      }

      // In composer mode, read all composer files
      let composerContext = ''
      if (agentState.mode === 'composer' && composerFiles.length > 0) {
        for (const f of composerFiles) {
          composerContext += `\n\n--- ${f.path} ---\n${f.content.slice(0, 4000)}\n`
        }
      }

      const fullPrompt = `${systemPrompt}\n\n${fileContext}\n${activeFileContext}\n${composerContext}\n\nUser: ${userContent}`

      // Use streaming API
      const response = await window.api.chatSimple({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        prompt: fullPrompt,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        openrouterBaseUrl: settings.openrouterBaseUrl,
      })

      if (abortRef.current) {
        setChatStreaming(false)
        completeAgent()
        return
      }

      if (response.success) {
        const content = response.result || ''

        // Parse AI actions
        const parsed = parseAIResponse(content)

        // Execute auto-actions
        await executeAutoActions(parsed)

        // Update the assistant message
        const finalMsg: CoderChatMessage = {
          ...assistantMsg,
          content,
          streaming: false,
          codeChanges: parsed.changes.length > 0 ? parsed.changes : undefined,
        }

        useCoderStore.setState((state) => {
          const msgs = [...state.chatMessages]
          const lastIdx = msgs.length - 1
          if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
            msgs[lastIdx] = finalMsg
          }
          return { chatMessages: msgs, chatStreaming: false }
        })

        // Complete agent
        if (agentState.mode === 'agent') {
          completeAgent()
        }
      } else {
        updateLastChatMessage(`Error: ${response.error}`)
        setChatStreaming(false)
        if (agentState.mode === 'agent') {
          completeAgent()
        }
      }
    } catch (e: any) {
      updateLastChatMessage(`Fatal: ${e.message}`)
      setChatStreaming(false)
      if (agentState.mode === 'agent') {
        completeAgent()
      }
    }
  }

  // Abort handler
  const handleAbort = () => {
    abortRef.current = true
    stopAgentLoop()
    stopAgent()
    setChatStreaming(false)
  }

  // Apply a pending change
  const applyChange = async (change: PendingChange) => {
    try {
      const result = await window.api.coderWrite(change.filePath, change.suggestedCode)
      if (result.success) {
        applyPendingChange(change.id)
        // Refresh file if open
        if (activeFile === change.filePath) {
          const readResult = await window.api.coderRead(change.filePath)
          if (readResult.success) {
            // Editor will reload via activeFile effect
          }
        }
        // Add to composer if in composer mode
        if (agentState.mode === 'composer') {
          openComposerFile(change.filePath, change.suggestedCode)
        }
      }
    } catch (e) {
      console.error('Apply change failed:', e)
    }
  }

  // Reject a pending change
  const rejectChange = (changeId: string) => {
    rejectPendingChange(changeId)
  }

  const mentionCandidates = showMentions ? getMentionCandidates().slice(0, 8) : []

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30 bg-surface-container shrink-0">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-[18px] text-secondary">smart_toy</span>
          <div className="flex flex-col">
            <span className="font-headline-md text-[13px] font-semibold text-on-surface">Nexus Coder</span>
            <span className="text-[10px] text-on-surface-variant/60">
              {agentState.mode === 'chat' && 'Chat mode — Ask anything'}
              {agentState.mode === 'agent' && 'Agent mode — AI works autonomously'}
              {agentState.mode === 'composer' && 'Composer mode — Multi-file editing'}
            </span>
          </div>
        </div>
        <div className="flex gap-xs items-center">
          <ModeSwitcher />
          <button
            onClick={clearChat}
            className="p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors"
            title="Clear chat"
          >
            <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
          </button>
          <button
            onClick={() => useCoderStore.getState().toggleChatPanel()}
            className="p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors"
            title="Close panel"
          >
            <span className="material-symbols-outlined text-[14px]">panel_open</span>
          </button>
        </div>
      </div>

      {/* Agent Status */}
      <AgentStatusPanel />

      {/* Relevant Files */}
      <RelevantFilesPanel />

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-md flex flex-col gap-lg">
        {chatMessages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-center p-md">
            <div>
              <span className="material-symbols-outlined text-[40px] text-on-surface-variant/20 mb-sm">chat</span>
              <p className="text-body-sm text-on-surface-variant/50">
                {agentState.mode === 'chat' && 'Ask me to help with code'}
                {agentState.mode === 'agent' && 'Describe a task and I\'ll work autonomously'}
                {agentState.mode === 'composer' && 'Describe a feature and I\'ll edit multiple files'}
              </p>
              <p className="text-[11px] text-on-surface-variant/30 mt-xs">
                Use @filename to attach files as context
              </p>
              <div className="flex flex-wrap gap-xs justify-center mt-md">
                {[
                  agentState.mode === 'chat' ? 'Explain this code' :
                  agentState.mode === 'agent' ? 'Implement auth system' : 'Create API routes',
                  agentState.mode === 'chat' ? 'Refactor to TypeScript' :
                  agentState.mode === 'agent' ? 'Add tests for all modules' : 'Add TypeScript types',
                  agentState.mode === 'chat' ? 'Add error handling' :
                  agentState.mode === 'agent' ? 'Fix all lint errors' : 'Implement error handling',
                  agentState.mode === 'chat' ? 'Write tests' :
                  agentState.mode === 'agent' ? 'Setup CI/CD' : 'Add unit tests',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => { setChatInput(s); inputRef.current?.focus() }}
                    className="px-sm py-[3px] bg-surface-container-high rounded-md text-[11px] text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {chatMessages.map((msg) => (
          <div key={msg.id} className={cn('flex flex-col gap-xs', msg.role === 'user' && 'items-end')}>
            {/* Message header */}
            <div className={cn(
              'flex items-center gap-xs text-[10px] uppercase tracking-wider font-medium',
              msg.role === 'assistant' ? 'text-secondary' :
              msg.role === 'system' ? 'text-warning' : 'text-on-surface-variant'
            )}>
              {msg.role === 'assistant' && <span className="material-symbols-outlined text-[12px]">smart_toy</span>}
              {msg.role === 'system' && <span className="material-symbols-outlined text-[12px]">terminal</span>}
              <span>{msg.role === 'assistant' ? 'NEXUS' : msg.role === 'system' ? 'SYSTEM' : 'YOU'}</span>
              {msg.role === 'user' && <span className="material-symbols-outlined text-[12px]">person</span>}
            </div>

            {/* Message content */}
            <div className={cn(
              'max-w-[95%]',
              msg.role === 'assistant'
                ? 'bg-surface-container rounded-r-lg rounded-bl-lg p-sm border-l-2 border-secondary'
                : msg.role === 'system'
                ? 'bg-warning/10 rounded-lg p-sm border border-warning/30 text-warning'
                : 'bg-surface-variant rounded-l-lg rounded-br-lg p-sm'
            )}>
              <ChatMessageContent content={msg.content} />

              {/* Attached files indicator */}
              {msg.attachedFiles && msg.attachedFiles.length > 0 && (
                <div className="flex flex-wrap gap-xs mt-sm">
                  {msg.attachedFiles.map((f) => (
                    <span key={f} className="text-[10px] px-xs py-[1px] bg-secondary/10 text-secondary rounded flex items-center gap-[2px]">
                      <span className="material-symbols-outlined text-[10px]">attach_file</span>
                      {f.split('/').pop()}
                    </span>
                  ))}
                </div>
              )}

              {/* Code changes */}
              {msg.codeChanges && msg.codeChanges.length > 0 && (
                <div className="mt-sm space-y-sm">
                  {msg.codeChanges.map((change) => (
                    <div
                      key={change.id}
                      className={cn(
                        'border rounded-md overflow-hidden',
                        change.status === 'applied' ? 'border-success/30 bg-success/5' :
                        change.status === 'rejected' ? 'border-error/30 bg-error/5 opacity-50' :
                        'border-secondary/30 bg-secondary/5'
                      )}
                    >
                      <div className="flex items-center justify-between px-sm py-[4px] bg-surface-container-high border-b border-inherit">
                        <span className="text-[11px] font-medium text-on-surface truncate">{change.filePath}</span>
                        <div className="flex gap-xs">
                          {change.status === 'pending' && (
                            <>
                              <button
                                onClick={() => applyChange(change as PendingChange)}
                                className="text-[10px] px-xs py-[1px] bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
                              >
                                Apply
                              </button>
                              <button
                                onClick={() => rejectChange(change.id)}
                                className="text-[10px] px-xs py-[1px] bg-error/20 text-error rounded hover:bg-error/30 transition-colors"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {change.status === 'applied' && (
                            <span className="text-[10px] text-success flex items-center gap-[2px]">
                              <span className="material-symbols-outlined text-[10px]">check</span>
                              Applied
                            </span>
                          )}
                          {change.status === 'rejected' && (
                            <span className="text-[10px] text-error">Rejected</span>
                          )}
                        </div>
                      </div>
                      <pre className="p-sm text-[11px] font-code-sm text-on-surface overflow-x-auto whitespace-pre-wrap">
                        {change.suggestedCode.slice(0, 500)}
                        {change.suggestedCode.length > 500 && '...'}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {chatStreaming && (
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-xs text-secondary text-[10px] uppercase tracking-wider font-medium">
              <span className="material-symbols-outlined text-[12px]">smart_toy</span>
              <span>NEXUS</span>
            </div>
            <div className="bg-surface-container rounded-r-lg rounded-bl-lg p-sm border-l-2 border-secondary text-on-surface-variant italic text-[13px]">
              <span className="inline-flex gap-[2px]">
                <span className="animate-bounce">●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
              </span>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Pending Changes Panel (collapsible) */}
      {pendingChanges.length > 0 && showChangesPanel && (
        <div className="border-t border-outline-variant/30 bg-surface-container shrink-0 max-h-[200px] overflow-y-auto">
          <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[14px] text-warning">pending_actions</span>
              <span className="text-[11px] font-medium text-on-surface">Pending Changes ({pendingChanges.filter(c => c.status === 'pending').length})</span>
            </div>
            <div className="flex gap-xs">
              <button
                onClick={applyAllPendingChanges}
                className="text-[10px] px-xs py-[2px] bg-success/20 text-success rounded hover:bg-success/30 transition-colors"
              >
                Apply All
              </button>
              <button
                onClick={rejectAllPendingChanges}
                className="text-[10px] px-xs py-[2px] bg-error/20 text-error rounded hover:bg-error/30 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => setShowChangesPanel(false)}
                className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-on-surface transition-colors"
              >
                close
              </button>
            </div>
          </div>
          <div className="p-sm space-y-xs">
            {pendingChanges.map((change) => (
              <div key={change.id} className={cn(
                'flex items-center justify-between px-sm py-[4px] rounded text-[11px]',
                change.status === 'pending' ? 'bg-surface-container-high' :
                change.status === 'applied' ? 'bg-success/10 text-success' :
                'bg-error/10 text-error opacity-50'
              )}>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[12px]">
                    {change.isNewFile ? 'note_add' : 'edit'}
                  </span>
                  <span className="truncate">{change.filePath.split('/').pop()}</span>
                  {change.isNewFile && <span className="text-[9px] px-[3px] bg-secondary/10 text-secondary rounded">new</span>}
                </div>
                <div className="flex gap-xs">
                  {change.status === 'pending' && (
                    <>
                      <button onClick={() => applyChange(change)} className="text-[10px] text-success hover:underline">Apply</button>
                      <button onClick={() => rejectChange(change.id)} className="text-[10px] text-error hover:underline">Reject</button>
                    </>
                  )}
                  {change.status === 'applied' && <span className="text-[10px]">Applied</span>}
                  {change.status === 'rejected' && <span className="text-[10px]">Rejected</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat Input */}
      <div className="p-sm bg-surface-container border-t border-outline-variant/30 shrink-0">
        {/* Attached files */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-xs mb-sm">
            {attachedFiles.map((f) => (
              <span
                key={f}
                className="text-[10px] px-xs py-[2px] bg-secondary/10 text-secondary rounded flex items-center gap-[2px] cursor-pointer hover:bg-secondary/20"
                onClick={() => setAttachedFiles((prev) => prev.filter((x) => x !== f))}
              >
                <span className="material-symbols-outlined text-[10px]">attach_file</span>
                {f.split('/').pop()}
                <span className="material-symbols-outlined text-[10px]">close</span>
              </span>
            ))}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={chatInput}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (!chatStreaming) handleSend()
              }
              if (e.key === 'Escape' && chatStreaming) {
                e.preventDefault()
                handleAbort()
              }
              if (showMentions) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setMentionIndex((i) => Math.min(i + 1, mentionCandidates.length - 1))
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setMentionIndex((i) => Math.max(i - 1, 0))
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault()
                  if (mentionCandidates[mentionIndex]) {
                    insertMention(mentionCandidates[mentionIndex])
                  }
                }
                if (e.key === 'Escape') {
                  setShowMentions(false)
                }
              }
            }}
            placeholder={
              agentState.mode === 'agent' ? 'Describe a task for the agent...' :
              agentState.mode === 'composer' ? 'Describe a feature to implement across files...' :
              'Ask Nexus... Use @ to attach files'
            }
            className="w-full bg-surface-dim border border-outline-variant/50 rounded-lg py-sm px-md text-[13px] text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-secondary focus:outline-none resize-none h-[60px]"
            spellCheck={false}
          />

          {/* Mention dropdown */}
          {showMentions && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-[4px] bg-surface-container border border-outline-variant/50 rounded-lg shadow-lg max-h-[200px] overflow-y-auto z-50">
              {mentionCandidates.map((file, i) => (
                <button
                  key={file}
                  onClick={() => insertMention(file)}
                  className={cn(
                    'w-full text-left px-md py-[6px] text-[12px] flex items-center gap-xs transition-colors',
                    i === mentionIndex ? 'bg-secondary/10 text-secondary' : 'text-on-surface hover:bg-surface-container-high'
                  )}
                >
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  <span className="truncate">{file}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-xs">
            <div className="flex items-center gap-xs">
              {activeFile && (
                <button
                  onClick={() => {
                    const relPath = activeFile.replace(rootPath || '', '').replace(/^[/\\]/, '')
                    setAttachedFiles((prev) => (prev.includes(relPath) ? prev : [...prev, relPath]))
                  }}
                  className="text-[10px] px-xs py-[2px] bg-surface-container-high text-on-surface-variant rounded flex items-center gap-[2px] hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[10px]">code</span>
                  + Context
                </button>
              )}
              {agentState.mode === 'agent' && (
                <label className="flex items-center gap-[2px] text-[10px] text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agentState.autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                    className="accent-secondary"
                  />
                  Auto-approve
                </label>
              )}
              {pendingChanges.length > 0 && !showChangesPanel && (
                <button
                  onClick={() => setShowChangesPanel(true)}
                  className="text-[10px] px-xs py-[2px] bg-warning/10 text-warning rounded flex items-center gap-[2px]"
                >
                  <span className="material-symbols-outlined text-[10px]">pending_actions</span>
                  {pendingChanges.filter(c => c.status === 'pending').length} changes
                </button>
              )}
            </div>
            <div className="flex items-center gap-xs">
              {chatStreaming && (
                <button
                  onClick={handleAbort}
                  className="text-[10px] px-xs py-[2px] bg-error/20 text-error rounded hover:bg-error/30 transition-colors flex items-center gap-[2px]"
                >
                  <span className="material-symbols-outlined text-[10px]">stop</span>
                  Stop
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!chatInput.trim() || chatStreaming}
                className="bg-secondary text-on-secondary p-1 rounded hover:bg-secondary/80 transition-colors active:scale-95 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Message Content Renderer ──────────────────────────────────────────────────

const ChatMessageContent: React.FC<{ content: string }> = ({ content }) => {
  // Remove action blocks from display (they're handled separately)
  let displayContent = content
    .replace(/```change:[^\n]+\n[\s\S]*?```/g, '')
    .replace(/```create:[^\n]+\n[\s\S]*?```/g, '')
    .replace(/```open:[^\n]+\n(?:reason:\s*)?[^`]*?```/g, '')
    .replace(/```terminal\n[\s\S]*?```/g, '')
    .replace(/```search:[^\n]+```/g, '')
    .replace(/open:[\w./\\-]+\.[\w]+/g, '')

  // Trim excessive whitespace
  displayContent = displayContent.replace(/\n{3,}/g, '\n\n').trim()

  // Split by code blocks
  const parts = displayContent.split(/(```[\s\S]*?```)/g)

  return (
    <div className="text-[13px] leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const inner = part.slice(3, -3)
          const firstNewline = inner.indexOf('\n')
          const lang = firstNewline > 0 ? inner.slice(0, firstNewline).trim() : ''
          const code = firstNewline > 0 ? inner.slice(firstNewline + 1) : inner

          return (
            <div key={i} className="my-sm rounded-lg border border-outline-variant/50 overflow-hidden bg-[#0d1117]/60">
              <div className="flex items-center justify-between px-md py-[4px] bg-surface-container-high border-b border-outline-variant/30">
                <span className="text-[10px] text-on-surface-variant uppercase">{lang || 'code'}</span>
                <CopyButton text={code} />
              </div>
              <pre className="p-md overflow-x-auto text-[12px] font-code-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                {code}
              </pre>
            </div>
          )
        }

        // Render markdown-like text
        const paragraphs = part.split(/\n\n+/)
        return (
          <div key={i}>
            {paragraphs.map((p, j) => {
              if (!p.trim()) return null
              // Inline code
              let html = p
                .replace(/`([^`]+)`/g, '<code class="bg-surface-container-high px-[3px] py-[1px] rounded text-secondary text-[11px] font-code-sm">$1</code>')
                .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '<em>$1</em>')
                .replace(/^- (.+)$/gm, '<li class="ml-md">$1</li>')
                .replace(/^\d+\. (.+)$/gm, '<li class="ml-md list-decimal">$1</li>')

              return (
                <p
                  key={j}
                  className="mb-sm last:mb-0 text-on-surface"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-[2px] text-[10px] text-on-surface-variant hover:text-on-surface transition-colors"
    >
      <span className="material-symbols-outlined text-[12px]">{copied ? 'check' : 'content_copy'}</span>
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
