import React, { useState } from 'react'
import { FolderOpen, Code, Sparkles, Keyboard, Zap, GitBranch, Edit3, Bot } from 'lucide-react'
import { useCoderStore } from '../store/useCoderStore'
import { cn } from '../utils/cn'

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">
    {children}
  </label>
)

export const CoderTab: React.FC = () => {
  const { isCoderMode, setCoderMode, rootPath, setWorkspaceRoot, agentState, setAgentMode } = useCoderStore()
  const [picking, setPicking] = useState(false)

  const handlePickWorkspace = async () => {
    setPicking(true)
    try {
      const picked = await window.api.coderPickWorkspace()
      if (picked.success && picked.data?.path) {
        setWorkspaceRoot(picked.data.path)
        await window.api.coderScan()
      }
    } catch (e) {
      console.error('Failed to pick workspace:', e)
    } finally {
      setPicking(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
            <Code size={18} />
          </div>
          <h3 className="font-semibold text-blue-100">Nexus Coder</h3>
        </div>
        <p className="text-[12px] text-blue-300/80 leading-relaxed">
          AI-powered code editor with inline editing, codebase search, and intelligent chat.
          Like Cursor & OpenCode, but built into Nexus AI.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
          <div>
            <p className="text-[13px] font-medium text-white/80">Nexus Coder Mode</p>
            <p className="text-[11px] text-white/30">AI IDE with inline editing & chat</p>
          </div>
          <button
            onClick={() => setCoderMode(!isCoderMode)}
            className={cn(
              'relative rounded-full transition-colors shrink-0',
              isCoderMode ? 'bg-accent' : 'bg-white/15'
            )}
            style={{ height: 22, width: 40 }}
            role="switch"
            aria-checked={isCoderMode}
          >
            <div
              className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all',
                isCoderMode ? 'left-[20px]' : 'left-[2px]'
              )}
            />
          </button>
        </div>

        <div className="space-y-2">
          <Label>Workspace Root</Label>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[13px] text-white/60 overflow-hidden">
              <FolderOpen size={14} className="shrink-0 text-white/30" />
              <span className="truncate">{rootPath || 'No workspace selected'}</span>
            </div>
            <button
              onClick={handlePickWorkspace}
              disabled={picking}
              className="px-3 py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-lg text-[12px] transition-colors disabled:opacity-50"
            >
              {picking ? '...' : 'Open Folder'}
            </button>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="space-y-2">
          <Label>AI Mode</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'chat', label: 'Chat', icon: Sparkles, desc: 'Ask questions' },
              { id: 'agent', label: 'Agent', icon: Bot, desc: 'Autonomous AI' },
              { id: 'composer', label: 'Composer', icon: Edit3, desc: 'Multi-file' },
            ].map((mode) => (
              <button
                key={mode.id}
                onClick={() => setAgentMode(mode.id as 'chat' | 'agent' | 'composer')}
                className={cn(
                  'flex flex-col items-center gap-1 p-3 rounded-xl border transition-all',
                  agentState.mode === mode.id
                    ? 'bg-secondary/20 border-secondary/40 text-secondary'
                    : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                )}
              >
                <mode.icon size={16} />
                <span className="text-[11px] font-medium">{mode.label}</span>
                <span className="text-[9px] opacity-60">{mode.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <Keyboard size={14} className="text-white/30" />
            <span className="font-medium">Keyboard Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-white/40">
            <div className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
              <span>Inline Edit</span>
              <span className="font-mono text-white/60">Ctrl+K</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
              <span>Save File</span>
              <span className="font-mono text-white/60">Ctrl+S</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
              <span>Accept Change</span>
              <span className="font-mono text-white/60">Ctrl+Enter</span>
            </div>
            <div className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
              <span>Reject Change</span>
              <span className="font-mono text-white/60">Esc</span>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-[12px] text-white/60">
            <Zap size={14} className="text-white/30" />
            <span className="font-medium">Cursor/OpenCode Features</span>
          </div>
          <div className="space-y-1 text-[11px] text-white/40">
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>AI Chat with @file mentions & context</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Agent Mode — AI works autonomously</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Composer Mode — multi-file editing</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Auto-open relevant files (OpenCode-style)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Inline code editing (Ctrl+K)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Codebase search across files</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Git integration & diff view</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-success" />
              <span>Apply / Reject AI code changes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
