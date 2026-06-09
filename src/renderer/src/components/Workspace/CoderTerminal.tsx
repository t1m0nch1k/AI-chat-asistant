
import React, { useState, useRef, useEffect } from 'react'
import { Terminal as TerminalIcon, Trash2 } from 'lucide-react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'system'
  content: string
  timestamp: number
}

export const CoderTerminal: React.FC = () => {
  const { rootPath } = useCoderStore()
  const [lines, setLines] = useState<TerminalLine[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  const executeCommand = async () => {
    if (!input.trim()) return
    
    const cmd = input.trim()
    setInput('')
    
    setLines(prev => [...prev, { 
      type: 'input', 
      content: `> ${cmd}`, 
      timestamp: Date.now() 
    }])

    try {
      const result = await window.api.coderTerminal(cmd)
      if (result.success) {
        setLines(prev => [...prev, { 
          type: 'output', 
          content: result.output || 'Command executed successfully (no output).', 
          timestamp: Date.now() 
        }])
      } else {
        setLines(prev => [...prev, { 
          type: 'error', 
          content: `❌ Error: ${result.error}`, 
          timestamp: Date.now() 
        }])
      }
    } catch (e: any) {
      setLines(prev => [...prev, { 
        type: 'error', 
        content: `❌ Exception: ${e.message}`, 
        timestamp: Date.now() 
      }])
    }
  }

  const clearTerminal = () => setLines([])

  if (!rootPath) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 bg-slate-950/20">
        <div className="text-xs italic">Select a workspace to enable terminal</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 border-t border-slate-800">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-400">
          <TerminalIcon size={12} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Terminal</span>
          <span className="text-[10px] opacity-50 font-mono">{rootPath}</span>
        </div>
        <button 
          onClick={clearTerminal}
          className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-500 hover:text-white"
          title="Clear Terminal"
        >
          <Trash2 size={12} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1 custom-scrollbar">
        {lines.length === 0 && (
          <div className="text-slate-600 italic text-center py-4">
            Ready for commands...
          </div>
        )}
        {lines.map((line, i) => (
          <div key={i} className={cn(
            "whitespace-pre-wrap break-all",
            line.type === 'input' && "text-blue-400 font-bold",
            line.type === 'error' && "text-red-400",
            line.type === 'system' && "text-slate-500 italic",
            line.type === 'output' && "text-slate-300"
          )}>
            {line.content}
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <div className="p-2 bg-slate-900/50 border-t border-slate-800 flex items-center gap-2">
        <span className="text-blue-500 font-mono text-xs px-1">$</span>
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && executeCommand()}
          placeholder="Run command..."
          className="flex-1 bg-transparent outline-none text-xs text-white font-mono"
        />
      </div>
    </div>
  )
}
