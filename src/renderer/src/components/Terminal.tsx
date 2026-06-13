/**
 * Terminal — встроенный терминал с живым выводом.
 * Поддерживает PowerShell и CMD, стриминг вывода, история команд.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal as TerminalIcon, X, ChevronRight, Square, Copy, Check, Trash2 } from 'lucide-react'
import { cn } from '../utils/cn'

interface TerminalLine {
  id: string
  type: 'input' | 'stdout' | 'stderr' | 'info' | 'exit'
  text: string
  timestamp: number
}

interface TerminalProps {
  onClose?: () => void
  className?: string
}

export const Terminal: React.FC<TerminalProps> = ({ onClose, className }) => {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: '0', type: 'info', text: 'AI Assistant Terminal — PowerShell & CMD', timestamp: Date.now() }
  ])
  const [input, setValue] = useState('')
  const [shell, setShell] = useState<'powershell' | 'cmd'>('powershell')
  const [cwd, setCwd] = useState('C:\\Users')
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const [copied, setCopied] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const currentProcessId = useRef<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Загружаем cwd при монтировании
  useEffect(() => {
    window.api?.getUserInfo?.().then((info) => {
      setCwd(info.homedir)
    }).catch(() => {})
  }, [])

  // Автоскролл
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  // Фокус на input
  useEffect(() => {
    inputRef.current?.focus()
  }, [isRunning])

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
      if (currentProcessId.current) {
        window.api?.killProcess?.(currentProcessId.current).catch(() => {})
      }
    }
  }, [])

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    setLines(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      text,
      timestamp: Date.now()
    }])
  }, [])

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || isRunning) return

    const trimmed = cmd.trim()

    // Встроенные команды
    if (trimmed === 'clear' || trimmed === 'cls') {
      setLines([{ id: crypto.randomUUID(), type: 'info', text: 'Terminal cleared', timestamp: Date.now() }])
      return
    }
    if (trimmed.startsWith('cd ')) {
      const newDir = trimmed.slice(3).trim()
      addLine('input', `${cwd}> ${trimmed}`)
      setCwd(newDir)
      addLine('info', `Changed to: ${newDir}`)
      return
    }

    // Добавляем в историю
    setHistory(prev => [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 100))
    setHistoryIdx(-1)

    addLine('input', `${cwd}> ${trimmed}`)
    setIsRunning(true)

    const processId = crypto.randomUUID()
    currentProcessId.current = processId

    // Подписываемся на вывод
    const unsub = window.api.onCmdOutput(({ processId: pid, type, data }) => {
      if (pid !== processId) return

      if (type === 'stdout' && typeof data === 'string' && data) {
        // Разбиваем по строкам для красивого отображения
        const lines = data.split(/\r?\n/)
        lines.forEach(line => {
          if (line) addLine('stdout', line)
        })
      } else if (type === 'stderr' && typeof data === 'string' && data) {
        const lines = data.split(/\r?\n/)
        lines.forEach(line => {
          if (line) addLine('stderr', line)
        })
      } else if (type === 'exit') {
        const code = data as number
        if (code !== 0) {
          addLine('exit', `[Exit code: ${code}]`)
        }
        setIsRunning(false)
        currentProcessId.current = null
        cleanupRef.current?.()
        cleanupRef.current = null
      }
    })

    cleanupRef.current = unsub

    try {
      await window.api.runCommandStream(trimmed, processId, {
        cwd,
        shell,
        timeout: 120000
      })
    } catch (e: any) {
      addLine('stderr', `Error: ${e.message}`)
      setIsRunning(false)
      currentProcessId.current = null
    }
  }, [cwd, shell, isRunning, addLine])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCommand(input)
      setValue('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const newIdx = Math.min(historyIdx + 1, history.length - 1)
      setHistoryIdx(newIdx)
      if (history[newIdx]) setValue(history[newIdx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      const newIdx = Math.max(historyIdx - 1, -1)
      setHistoryIdx(newIdx)
      setValue(newIdx === -1 ? '' : history[newIdx])
    } else if (e.key === 'c' && e.ctrlKey) {
      if (isRunning && currentProcessId.current) {
        window.api.killProcess(currentProcessId.current)
        addLine('info', '^C')
        setIsRunning(false)
        currentProcessId.current = null
      }
    }
  }

  const copyAll = async () => {
    const text = lines.map(l => l.text).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const clearTerminal = () => {
    setLines([{ id: crypto.randomUUID(), type: 'info', text: 'Terminal cleared', timestamp: Date.now() }])
  }

  return (
    <div className={cn(
      'flex flex-col bg-[#0d0d0d] rounded-xl border border-white/10 overflow-hidden font-mono text-[12px]',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/8">
        <div className="flex items-center gap-2">
          <TerminalIcon size={13} className="text-green-400" />
          <span className="text-white/60 text-[11px]">Terminal</span>

          {/* Shell selector */}
          <div className="flex items-center gap-1 ml-2">
            {(['powershell', 'cmd'] as const).map(s => (
              <button
                key={s}
                onClick={() => setShell(s)}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] transition-colors',
                  shell === s
                    ? 'bg-accent/30 text-accent'
                    : 'text-white/30 hover:text-white/60'
                )}
              >
                {s === 'powershell' ? 'PS' : 'CMD'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button onClick={copyAll} title="Copy all" className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors">
            {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          </button>
          <button onClick={clearTerminal} title="Clear" className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white transition-colors">
            <Trash2 size={11} />
          </button>
          {onClose && (
            <button onClick={onClose} title="Close" className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Output */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-0.5 min-h-[200px] max-h-[400px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map(line => (
          <TerminalLine key={line.id} line={line} />
        ))}

        {/* Running indicator */}
        {isRunning && (
          <div className="flex items-center gap-1.5 text-yellow-400/70">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ▋
            </motion.span>
            <span className="text-[10px]">running... (Ctrl+C to stop)</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/8 bg-white/3">
        <span className="text-green-400/70 shrink-0 text-[11px] truncate max-w-[120px]" title={cwd}>
          {cwd.split('\\').pop() || cwd}
        </span>
        <ChevronRight size={11} className="text-white/30 shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? 'Running...' : 'Enter command...'}
          className="flex-1 bg-transparent outline-none text-white/90 placeholder:text-white/20 disabled:opacity-50 text-[12px]"
          spellCheck={false}
          autoComplete="off"
        />
        {isRunning && (
          <button
            onClick={() => {
              if (currentProcessId.current) {
                window.api.killProcess(currentProcessId.current)
                addLine('info', '^C — stopped')
                setIsRunning(false)
                currentProcessId.current = null
              }
            }}
            className="p-1 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors shrink-0"
            title="Stop (Ctrl+C)"
          >
            <Square size={11} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Terminal Line ─────────────────────────────────────────────────────────────

const TerminalLine: React.FC<{ line: TerminalLine }> = ({ line }) => {
  const colors: Record<TerminalLine['type'], string> = {
    input: 'text-cyan-300',
    stdout: 'text-white/80',
    stderr: 'text-red-400',
    info: 'text-white/30 italic',
    exit: 'text-yellow-500/70'
  }

  return (
    <div className={cn('whitespace-pre-wrap break-all leading-relaxed', colors[line.type])}>
      {line.text}
    </div>
  )
}


