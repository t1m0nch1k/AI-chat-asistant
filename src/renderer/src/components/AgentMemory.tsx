/**
 * AgentMemory — panel showing agent action history, error log, and session memory.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, AlertTriangle, History, Trash2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { cn } from '../utils/cn'
import { AgentMemoryEntry } from '../types'

export const AgentMemory: React.FC = () => {
  const [memory, setMemory] = useState<AgentMemoryEntry[]>([])
  const [errors, setErrors] = useState<AgentMemoryEntry[]>([])
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'errors'>('all')

  const loadMemory = useCallback(async () => {
    if (!window.api?.agentMemory) return
    try {
      const all = await window.api.agentMemory('all')
      const errs = await window.api.agentMemory('errors')
      if (all) setMemory(Array.isArray(all) ? all : [])
      if (errs) setErrors(Array.isArray(errs) ? errs : [])
    } catch {}
  }, [])

  useEffect(() => {
    loadMemory()
  }, [loadMemory])

  const clearMemory = async () => {
    if (!window.api?.agentClearMemory) return
    await window.api.agentClearMemory()
    setMemory([])
    setErrors([])
  }

  const items = activeTab === 'errors' ? errors : memory

  return (
    <div className="border-t border-white/5">
      <div
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <Brain size={11} />
          <span>Agent Memory ({memory.length})</span>
          {errors.length > 0 && (
            <span className="text-red-400/60 text-[10px]">· {errors.length} errors</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); loadMemory() }}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Refresh"
          >
            <RefreshCw size={10} />
          </button>
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex gap-1 px-3 pb-1">
              <button
                onClick={() => setActiveTab('all')}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full transition-colors',
                  activeTab === 'all' ? 'bg-accent/20 text-accent' : 'text-white/30 hover:text-white/50'
                )}
              >
                <History size={10} className="inline mr-1" />
                All
              </button>
              <button
                onClick={() => setActiveTab('errors')}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full transition-colors',
                  activeTab === 'errors' ? 'bg-red-500/20 text-red-400' : 'text-white/30 hover:text-white/50'
                )}
              >
                <AlertTriangle size={10} className="inline mr-1" />
                Errors ({errors.length})
              </button>
            </div>

            <div className="px-2 pb-2 space-y-0.5 max-h-48 overflow-y-auto">
              {items.length === 0 && (
                <p className="text-[10px] text-white/20 text-center py-4">No entries yet</p>
              )}
              {items.slice(0, 50).map((entry, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-start gap-1.5 px-2 py-1 rounded-lg transition-colors',
                    entry.type === 'error' ? 'bg-red-500/5' :
                    entry.type === 'action' ? 'bg-white/3' :
                    'bg-white/1'
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {entry.type === 'error' ? (
                      <AlertTriangle size={10} className="text-red-400" />
                    ) : (
                      <History size={10} className="text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[10px] truncate',
                      entry.type === 'error' ? 'text-red-400/70' : 'text-white/50'
                    )}>
                      {entry.content}
                    </p>
                  </div>
                </div>
              ))}

              {items.length > 0 && (
                <button
                  onClick={clearMemory}
                  className="w-full flex items-center justify-center gap-1 py-1 text-[10px] text-white/20 hover:text-red-400 transition-colors rounded"
                >
                  <Trash2 size={10} />
                  Clear memory
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
