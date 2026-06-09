
import React, { useEffect, useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

interface Tab {
  path: string
  name: string
}

export const CodeEditor: React.FC = () => {
  const { openFiles, activeFile, closeFile, setActiveFile } = useCoderStore()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeFile) {
      loadFileContent(activeFile)
    } else {
      setContent('')
    }
  }, [activeFile])

  const loadFileContent = async (path: string) => {
    setLoading(true)
    try {
      const result = await window.api.coderRead(path)
      if (result.success) {
        setContent(result.content)
      } else {
        setContent(`Error reading file: ${result.error}`)
      }
    } catch (e) {
      setContent(`Exception reading file: ${e}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!activeFile) return
    setSaving(true)
    try {
      const result = await window.api.coderWrite(activeFile, content)
      if (!result.success) {
        alert(`Failed to save file: ${result.error}`)
      }
    } catch (e: any) {
      alert(`Error saving file: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const getFileName = (path: string) => {
    return path.split('/').pop() || path
  }

  if (!activeFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600 bg-slate-950/20">
        <div className="text-sm italic">Select a file to start coding</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs Header */}
      <div className="flex items-center justify-between overflow-x-auto bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 scrollbar-hide">
        <div className="flex items-center">
          {openFiles.map((path) => (
            <div 
              key={path}
              onClick={() => setActiveFile(path)}
              className={cn(
                "flex items-center px-3 py-2 cursor-pointer text-xs border-r border-slate-800 transition-all min-w-[120px] max-w-[200px]",
                activeFile === path 
                  ? "bg-slate-950 text-blue-400 border-t-2 border-t-blue-500" 
                  : "text-slate-400 hover:bg-slate-800/50"
              )}
            >
              <span className="truncate flex-1">{getFileName(path)}</span>
              <X 
                size={12} 
                className="ml-2 hover:text-white transition-colors" 
                onClick={(e) => {
                  e.stopPropagation()
                  closeFile(path)
                }}
              />
            </div>
          ))}
        </div>
        <div className="px-3">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden relative bg-slate-950">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10 backdrop-blur-sm">
            <div className="text-xs text-slate-400 animate-pulse">Loading file...</div>
          </div>
        )}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-full p-4 bg-transparent text-slate-300 font-mono text-xs resize-none outline-none focus:ring-0 custom-scrollbar"
          spellCheck={false}
        />
      </div>
    </div>
  )
}
