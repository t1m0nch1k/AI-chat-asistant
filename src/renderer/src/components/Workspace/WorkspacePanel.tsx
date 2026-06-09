
import React from 'react'
import { FileExplorer } from './FileExplorer'
import { CodeEditor } from './CodeEditor'
import { CoderChat } from './CoderChat'
import { CoderTerminal } from './CoderTerminal'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'
import { X } from 'lucide-react'

export const WorkspacePanel: React.FC = () => {
  const { isCoderMode, setCoderMode, clearWorkspace } = useCoderStore()

  if (!isCoderMode) return null

  const handleExit = () => {
    setCoderMode(false)
    clearWorkspace()
  }

  return (
    <div className="fixed inset-0 z-50 flex pointer-events-none">
      {/* Glassmorphic Overlay */}
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-xl pointer-events-auto" />
      
      {/* Exit Button */}
      <button 
        onClick={handleExit}
        className="absolute top-6 right-6 z-[60] p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700 rounded-full transition-all pointer-events-auto shadow-lg group"
        title="Exit Coder Mode"
      >
        <X size={20} className="group-hover:scale-110 transition-transform" />
      </button>

      {/* Workspace Container */}
      <div className="relative w-full h-full flex p-4 gap-4 pointer-events-auto">
        {/* Left Side: Explorer */}
        <div className="w-72 h-full bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-2xl">
          <FileExplorer />
        </div>

        {/* Right Side: Editor & Terminal */}
        <div className="flex-1 h-full flex flex-col gap-4">
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Editor */}
            <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-2xl">
              <CodeEditor />
            </div>

            {/* Chat */}
            <div className="w-80 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-2xl">
              <CoderChat />
            </div>
          </div>

          {/* Terminal (Bottom) */}
          <div className="h-64 bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-2xl">
            <CoderTerminal />
          </div>
        </div>
      </div>
    </div>
  )
}
