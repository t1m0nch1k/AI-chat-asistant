import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system'
  content: string
  timestamp: number
}

export const CoderTerminal: React.FC = () => {
  const { rootPath } = useCoderStore()
  const [activeTab, setActiveTab] = useState<'terminal' | 'problems' | 'output'>('terminal')
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'system', content: 'Nexus Terminal — PowerShell', timestamp: Date.now() },
    { type: 'system', content: 'Type commands to interact with your workspace', timestamp: Date.now() },
  ])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const executeCommand = async () => {
    if (!input.trim() || !rootPath) return
    const cmd = input.trim()
    setInput('')
    setHistory((prev) => [...prev, cmd])
    setHistoryIndex(-1)

    setLines((prev) => [...prev, { type: 'input', content: cmd, timestamp: Date.now() }])

    try {
      const result = await window.api.coderTerminal(cmd)
      if (result.success) {
        if (result.stdout) {
          setLines((prev) => [...prev, { type: 'output', content: result.stdout!, timestamp: Date.now() }])
        }
        if (result.stderr) {
          setLines((prev) => [...prev, { type: 'error', content: result.stderr!, timestamp: Date.now() }])
        }
      } else {
        setLines((prev) => [...prev, { type: 'error', content: `Error: ${result.error}${result.stderr ? '\n' + result.stderr : ''}`, timestamp: Date.now() }])
      }
    } catch (e: any) {
      setLines((prev) => [...prev, { type: 'error', content: `Exception: ${e.message}`, timestamp: Date.now() }])
    }
  }

  const clearTerminal = () => setLines([])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand()
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setInput(history[newIndex])
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= history.length) {
          setHistoryIndex(-1)
          setInput('')
        } else {
          setHistoryIndex(newIndex)
          setInput(history[newIndex])
        }
      }
    }
  }

  if (!rootPath) {
    return (
      <div className="h-[180px] border-t border-outline-variant/30 flex items-center justify-center bg-[#0c0c0c] text-on-surface-variant/50 shrink-0">
        <div className="text-[12px] italic">Select a workspace to enable terminal</div>
      </div>
    )
  }

  const projectName = rootPath.split(/[/\\]/).pop() || 'project'

  return (
    <div className="h-[180px] border-t border-outline-variant/30 flex flex-col bg-[#0c0c0c] shrink-0">
      {/* Terminal Tabs */}
      <div className="flex items-center justify-between px-md py-[4px] border-b border-outline-variant/20 bg-[#0c0c0c]">
        <div className="flex gap-md font-label-caps text-[10px] uppercase tracking-wider">
          <TabButton label="Terminal" active={activeTab === 'terminal'} onClick={() => setActiveTab('terminal')} />
          <TabButton label="Output" active={activeTab === 'output'} onClick={() => setActiveTab('output')} />
          <TabButton label="Problems" active={activeTab === 'problems'} onClick={() => setActiveTab('problems')} />
        </div>
        <div className="flex gap-sm text-on-surface-variant">
          <button onClick={clearTerminal} className="material-symbols-outlined text-[14px] cursor-pointer hover:text-on-surface transition-colors" title="Clear">delete</button>
          <button onClick={() => inputRef.current?.focus()} className="material-symbols-outlined text-[14px] cursor-pointer hover:text-on-surface transition-colors" title="Focus">terminal</button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-auto p-sm font-code-sm text-[12px] text-[#cccccc] select-text">
        {activeTab === 'terminal' && (
          <>
            {lines.map((line, i) => (
              <div key={i} className={cn(
                'whitespace-pre-wrap break-all leading-[18px]',
                line.type === 'input' && 'text-[#4fc1ff]',
                line.type === 'error' && 'text-[#f48771]',
                line.type === 'system' && 'text-[#858585] italic',
                line.type === 'output' && 'text-[#cccccc]',
              )}>
                {line.type === 'input' ? (
                  <div className="flex gap-sm">
                    <span className="text-[#c586c0] shrink-0 select-none">{projectName} &gt;</span>
                    <span>{line.content}</span>
                  </div>
                ) : (
                  line.content
                )}
              </div>
            ))}
            <div className="flex gap-sm mt-xs">
              <span className="text-[#c586c0] shrink-0 select-none">{projectName} &gt;</span>
              <div className="flex items-center gap-1 flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command..."
                  className="bg-transparent outline-none text-[12px] text-[#cccccc] flex-1 font-code-sm"
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className="animate-pulse text-[10px] text-[#4fc1ff]">▋</span>
              </div>
            </div>
            <div ref={scrollRef} />
          </>
        )}
        {activeTab === 'problems' && (
          <div className="text-[#858585] italic text-[12px] text-center py-md">No problems detected</div>
        )}
        {activeTab === 'output' && (
          <div className="text-[#858585] italic text-[12px] text-center py-md">Build output will appear here</div>
        )}
      </div>
    </div>
  )
}

const TabButton: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'uppercase tracking-wider pb-[2px] transition-colors cursor-pointer text-[10px]',
      active ? 'text-[#4fc1ff] border-b border-[#4fc1ff]' : 'text-[#858585] hover:text-[#cccccc]',
    )}
  >
    {label}
  </button>
)
