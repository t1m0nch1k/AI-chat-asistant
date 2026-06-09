import React, { useState } from 'react'
import { FolderOpen, Plus, Trash2, Code } from 'lucide-react'
import { useCoderStore } from '../store/useCoderStore'
import { cn } from '../utils/cn'

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">
    {children}
  </label>
)

export const CoderTab: React.FC = () => {
  const { isCoderMode, setCoderMode, rootPath, setWorkspaceRoot } = useCoderStore()
  const [picking, setPicking] = useState(false)

  const handlePickWorkspace = async () => {
    setPicking(true)
    try {
      const picked = await window.api.pickDirectory()
      if (picked) {
        setWorkspaceRoot(picked)
        // Trigger initial scan
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
          <h3 className="font-semibold text-blue-100">Coder Mode</h3>
        </div>
        <p className="text-[12px] text-blue-300/80 leading-relaxed">
          Enable a specialized environment for software engineering. This activates the 
          code editor, file explorer, and deep codebase analysis tools.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
          <div>
            <p className="text-[13px] font-medium text-white/80">Active Coder Session</p>
            <p className="text-[11px] text-white/30">Toggle the IDE workspace overlay</p>
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
              {picking ? '...' : 'Change'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
