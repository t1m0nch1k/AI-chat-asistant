
import React, { useState } from 'react'
import { Folder, File, ChevronRight, ChevronDown, RefreshCw, FolderOpen } from 'lucide-react'
import { useCoderStore } from '../../store/useCoderStore'
import { CoderFileNode } from '../../types'
import { cn } from '../../utils/cn'

interface FileNodeProps {
  node: CoderFileNode
  depth: number
}

const FileNode: React.FC<FileNodeProps> = ({ node, depth }) => {
  const { openFile, activeFile } = useCoderStore()
  const [isOpen, setIsOpen] = useState(false)

  const isSelected = activeFile === node.path

  if (node.isDirectory) {
    return (
      <div className="select-none">
        <div 
          className={cn(
            "flex items-center py-1 px-2 cursor-pointer hover:bg-slate-800/50 transition-colors text-sm",
            isSelected && "bg-slate-800/80 text-blue-400"
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="mr-1">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <Folder size={16} className="mr-2 text-blue-400 fill-blue-400/20" />
          <span className="truncate">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <FileNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className={cn(
        "flex items-center py-1 px-2 cursor-pointer hover:bg-slate-800/50 transition-colors text-sm",
        isSelected && "bg-slate-800/80 text-blue-400"
      )}
      style={{ paddingLeft: `${depth * 12 + 24}px` }}
      onClick={() => openFile(node.path)}
    >
      <File size={16} className="mr-2 text-slate-400" />
      <span className="truncate">{node.name}</span>
    </div>
  )
}

export const FileExplorer: React.FC = () => {
  const { tree, rootPath, isScanning, setScanning } = useCoderStore()

  const handleScan = async () => {
    setScanning(true)
    try {
      const result = await window.api.coderScan(true)
      if (result.success && result.data) {
        useCoderStore.setState({ tree: result.data.tree })
      }
    } catch (e) {
      console.error('Scan failed', e)
    } finally {
      setScanning(false)
    }
  }

  const handlePickWorkspace = async () => {
    const result = await window.api.coderPickWorkspace()
    if (result.success && result.data) {
      useCoderStore.setState({ rootPath: result.data.path })
      await handleScan()
    }
  }

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center gap-4">
        <FolderOpen size={48} className="text-slate-600" />
        <div className="text-sm text-slate-400">No workspace selected</div>
        <button 
          onClick={handlePickWorkspace}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs transition-all"
        >
          Open Folder
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-slate-950/40 backdrop-blur-xl">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Explorer</span>
        <button 
          onClick={handleScan} 
          disabled={isScanning}
          className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(isScanning && "animate-spin")} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
        {tree.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-500">
            Project is empty or not scanned
          </div>
        ) : (
          tree.map((node) => (
            <FileNode key={node.path} node={node} depth={0} />
          ))
        )}
      </div>
    </div>
  )
}
