/**
 * AgentPanel — Computer Use Agent status panel.
 *
 * Features:
 * - Current goal display
 * - Step-by-step progress with status
 * - Emergency stop button (red, always visible)
 * - Action log (live feed of executed actions)
 * - Expandable error log
 * - Collapsible layout
 */

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, CheckCircle, XCircle, Loader, Square, ChevronDown, ChevronUp,
  AlertTriangle, Play, List, Eye, Terminal
} from 'lucide-react'
import { cn } from '../utils/cn'
import { AgentTask, AgentStep } from '../types'

interface AgentPanelProps {
  task: AgentTask | null
  onStop: () => void
}

export const AgentPanel: React.FC<AgentPanelProps> = ({ task, onStop }) => {
  const [collapsed, setCollapsed] = useState(false)
  const [showLog, setShowLog] = useState(true)
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [task?.steps])

  if (!task) return null

  const totalSteps = task.steps.length
  const doneSteps = task.steps.filter(s => s.status === 'done').length
  const failedSteps = task.steps.filter(s => s.status === 'failed').length
  const progress = totalSteps > 0 ? (doneSteps / totalSteps) * 100 : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-none border-b border-white/5 bg-white/3 overflow-hidden"
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white/[0.02]">
        <div className={cn(
          'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
          task.status === 'running' ? 'bg-accent/20' :
          task.status === 'done' ? 'bg-green-500/20' :
          task.status === 'failed' ? 'bg-red-500/20' :
          task.status === 'stopped' ? 'bg-yellow-500/20' :
          'bg-white/10'
        )}>
          {task.status === 'running' ? (
            <Loader size={13} className="text-accent animate-spin" />
          ) : task.status === 'done' ? (
            <CheckCircle size={13} className="text-green-400" />
          ) : task.status === 'failed' ? (
            <XCircle size={13} className="text-red-400" />
          ) : task.status === 'stopped' ? (
            <Square size={13} className="text-yellow-400" />
          ) : (
            <Bot size={13} className="text-white/40" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-medium text-white/80 truncate">
            {task.status === 'planning' ? '🤔 Planning...' :
             task.status === 'running' ? `🤖 ${task.goal}` :
             task.status === 'done' ? `✅ ${task.goal}` :
             task.status === 'failed' ? `❌ ${task.goal}` :
             task.status === 'stopped' ? `⏹️ ${task.goal}` :
             task.goal}
          </p>
          <p className="text-[10px] text-white/30 font-mono">
            {task.status === 'running'
              ? `Step ${Math.min(task.currentStep + 1, totalSteps)}/${totalSteps} · ${doneSteps} done${failedSteps > 0 ? ` · ${failedSteps} failed` : ''}`
              : task.status === 'planning' ? 'Analyzing screen & creating plan...'
              : task.status === 'done' ? `Completed in ${totalSteps} steps ${task.completedAt ? `(${Math.round((task.completedAt - task.startedAt) / 1000)}s)` : ''}`
              : task.status === 'failed' ? `${failedSteps} step${failedSteps > 1 ? 's' : ''} failed`
              : task.status === 'stopped' ? 'Stopped by user'
              : ''}
          </p>
        </div>

        <div className="flex items-center gap-1">
          {/* Emergency stop — always visible when running */}
          {task.status === 'running' && (
            <button
              onClick={onStop}
              title="Emergency Stop"
              className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-all animate-pulse"
            >
              <Square size={13} />
            </button>
          )}
          <button
            onClick={() => setShowLog(!showLog)}
            title={showLog ? 'Hide log' : 'Show log'}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            {showLog ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            <List size={12} />
          </button>
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <div className="h-0.5 bg-white/5">
        <motion.div
          className={cn(
            'h-full transition-colors',
            task.status === 'done' ? 'bg-green-500' :
            task.status === 'failed' ? 'bg-red-500' :
            task.status === 'stopped' ? 'bg-yellow-500' :
            'bg-accent'
          )}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* ── Collapsible content ──────────────────────────────────────────── */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            {/* Plan summary */}
            {task.planSummary && task.status !== 'planning' && (
              <div className="px-3 pt-2 pb-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Terminal size={10} className="text-white/30" />
                  <span className="text-[9px] uppercase tracking-wider text-white/30 font-semibold">Plan</span>
                </div>
                <div className="text-[10px] text-white/40 leading-relaxed pl-3 border-l border-white/10">
                  {task.planSummary.split('\n').map((line, i) => (
                    <span key={i} className="block">
                      <span className={cn(
                        'font-mono',
                        task.steps[i]?.status === 'done' ? 'text-green-400/60' :
                        task.steps[i]?.status === 'running' ? 'text-accent' :
                        task.steps[i]?.status === 'failed' ? 'text-red-400' :
                        'text-white/30'
                      )}>
                        {line}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Steps list */}
            {totalSteps > 0 && (
              <div className="px-3 py-1 max-h-48 overflow-y-auto space-y-0.5">
                {task.steps.map((step, i) => (
                  <StepRow key={step.id} step={step} index={i} isCurrent={i === task.currentStep && task.status === 'running'} />
                ))}
              </div>
            )}

            {/* Errors */}
            {task.errorLog.length > 0 && (
              <div className="px-3 pb-2 pt-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle size={10} className="text-red-400/60" />
                  <span className="text-[9px] uppercase tracking-wider text-red-400/60 font-semibold">
                    Errors ({task.errorLog.length})
                  </span>
                </div>
                <div className="space-y-0.5">
                  {task.errorLog.slice(-3).map((err, i) => (
                    <p key={i} className="text-[10px] text-red-400/50 truncate font-mono">
                      {err}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="h-1" />
            <div ref={logEndRef} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const StepRow: React.FC<{ step: AgentStep; index: number; isCurrent: boolean }> = ({ step, index, isCurrent }) => (
  <div className={cn(
    'flex items-start gap-2 text-[11px] rounded-lg px-2 py-1.5 transition-colors',
    isCurrent ? 'bg-accent/10' : 'hover:bg-white/3'
  )}>
    <div className="shrink-0 mt-0.5">
      {step.status === 'done' ? (
        <CheckCircle size={11} className="text-green-400" />
      ) : step.status === 'failed' ? (
        <XCircle size={11} className="text-red-400" />
      ) : step.status === 'skipped' ? (
        <AlertTriangle size={11} className="text-yellow-400" />
      ) : step.status === 'running' ? (
        <Loader size={11} className="text-accent animate-spin" />
      ) : (
        <div className="w-2.5 h-2.5 rounded-full border border-white/20 mt-0.5" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn(
        'truncate',
        step.status === 'done' ? 'text-white/50' :
        step.status === 'running' ? 'text-white/90 font-medium' :
        step.status === 'failed' ? 'text-red-400' :
        step.status === 'skipped' ? 'text-yellow-400/60' :
        'text-white/40'
      )}>
        {step.description}
      </p>
      {step.result && step.status !== 'pending' && (
        <p className={cn(
          'text-[10px] truncate mt-0.5 flex items-center gap-1',
          step.status === 'failed' ? 'text-red-400/60' : 'text-white/25'
        )}>
          {step.status === 'done' && <CheckCircle size={8} className="shrink-0 text-green-400/60" />}
          {step.status === 'failed' && <XCircle size={8} className="shrink-0 text-red-400/60" />}
          {step.status === 'skipped' && <AlertTriangle size={8} className="shrink-0 text-yellow-400/60" />}
          {step.result.slice(0, 80)}{step.result.length > 80 ? '...' : ''}
        </p>
      )}
      {step.error && (
        <p className="text-[10px] text-red-400/50 truncate mt-0.5 font-mono">
          ⚠ {step.error}
        </p>
      )}
      {step.attempts > 1 && step.status === 'done' && (
        <p className="text-[9px] text-yellow-400/40 mt-0.5">
          ⚡ {step.attempts} attempt{step.attempts > 1 ? 's' : ''}
        </p>
      )}
    </div>
  </div>
)
