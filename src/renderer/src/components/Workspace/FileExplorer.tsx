import React, { useState, useCallback } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { CoderFileNode } from '../../types'
import { cn } from '../../utils/cn'

const fileIcon = (name: string): { icon: string; color: string } => {
  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : ''
  const map: Record<string, { icon: string; color: string }> = {
    py: { icon: 'code', color: '#ffca28' },
    ts: { icon: 'code', color: '#3178c6' },
    tsx: { icon: 'code', color: '#3178c6' },
    js: { icon: 'code', color: '#f7df1e' },
    jsx: { icon: 'code', color: '#61dafb' },
    css: { icon: 'css', color: '#26a69a' },
    scss: { icon: 'css', color: '#cf649a' },
    html: { icon: 'code', color: '#e34c26' },
    json: { icon: 'data_object', color: '#66bb6a' },
    xml: { icon: 'data_object', color: '#66bb6a' },
    md: { icon: 'article', color: '#bdbdbd' },
    txt: { icon: 'description', color: '#29b6f6' },
    yml: { icon: 'settings', color: '#ff7043' },
    yaml: { icon: 'settings', color: '#ff7043' },
    toml: { icon: 'settings', color: '#ff7043' },
    env: { icon: 'settings', color: '#ff7043' },
    gitignore: { icon: 'settings', color: '#ff7043' },
    dockerfile: { icon: 'settings', color: '#2496ed' },
    cfg: { icon: 'settings', color: '#ff7043' },
    ini: { icon: 'settings', color: '#ff7043' },
    sh: { icon: 'terminal', color: '#89ddff' },
    bat: { icon: 'terminal', color: '#89ddff' },
    ps1: { icon: 'terminal', color: '#89ddff' },
    rs: { icon: 'code', color: '#dea584' },
    go: { icon: 'code', color: '#00add8' },
    java: { icon: 'code', color: '#b07219' },
    cpp: { icon: 'code', color: '#f34b7d' },
    c: { icon: 'code', color: '#555555' },
    h: { icon: 'code', color: '#555555' },
    php: { icon: 'code', color: '#4f5d95' },
    rb: { icon: 'code', color: '#701516' },
    swift: { icon: 'code', color: '#ffac45' },
    kt: { icon: 'code', color: '#a97bff' },
  }
  if (name === '.gitignore') return { icon: 'settings', color: '#ff7043' }
  if (name === 'Dockerfile' || name.startsWith('Dockerfile.')) return { icon: 'settings', color: '#2496ed' }
  if (name === 'README.md') return { icon: 'article', color: '#bdbdbd' }
  if (name === 'package.json') return { icon: 'data_object', color: '#66bb6a' }
  if (name === 'tsconfig.json') return { icon: 'data_object', color: '#3178c6' }
  return map[ext || ''] || { icon: 'description', color: '#9e9e9e' }
}

const FileNode: React.FC<{ node: CoderFileNode; depth: number }> = ({ node, depth }) => {
  const { openFile, activeFile, gitStatus } = useCoderStore()
  const [isOpen, setIsOpen] = useState(depth === 0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const isSelected = activeFile === node.path

  // Git status for this file
  const gitFileStatus = gitStatus?.files.find((f) => node.relativePath.includes(f.path) || f.path.includes(node.relativePath))
  const gitColor = gitFileStatus
    ? gitFileStatus.status === 'modified' ? '#ffca28'
      : gitFileStatus.status === 'added' ? '#4caf50'
      : gitFileStatus.status === 'deleted' ? '#f44336'
      : gitFileStatus.status === 'untracked' ? '#9e9e9e'
      : undefined
    : undefined

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const closeContextMenu = () => setContextMenu(null)

  if (node.isDirectory) {
    return (
      <div className="select-none">
        <div
          className="flex items-center gap-xs px-md py-[4px] hover:bg-surface-container-high cursor-pointer text-on-surface transition-colors duration-150"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
          onContextMenu={handleContextMenu}
        >
          <span
            className="material-symbols-outlined text-[14px] text-on-surface-variant transition-transform duration-150"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            chevron_right
          </span>
          <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--twc-primary, #4d8eff)' }}>
            {isOpen ? 'folder_open' : 'folder'}
          </span>
          <span className="font-body-sm text-body-sm truncate">{node.name}</span>
          {gitColor && (
            <span className="w-[6px] h-[6px] rounded-full ml-auto shrink-0" style={{ backgroundColor: gitColor }} />
          )}
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <FileNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
        {contextMenu && (
          <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} path={node.path} isDirectory />
        )}
      </div>
    )
  }

  const { icon, color } = fileIcon(node.name)

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center gap-xs px-md py-[4px] cursor-pointer transition-colors duration-150 relative group',
          isSelected ? 'bg-secondary-container/10 text-secondary' : 'hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface',
        )}
        style={{ paddingLeft: `${depth * 16 + 32}px` }}
        onClick={() => openFile(node.path)}
        onContextMenu={handleContextMenu}
      >
        {isSelected && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-secondary" />}
        <span className="material-symbols-outlined text-[14px] shrink-0" style={{ color }}>{icon}</span>
        <span className="font-body-sm text-body-sm truncate flex-1">{node.name}</span>
        {gitColor && (
          <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ backgroundColor: gitColor }} />
        )}
      </div>
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={closeContextMenu} path={node.path} isDirectory={false} />
      )}
    </div>
  )
}

const ContextMenu: React.FC<{
  x: number
  y: number
  onClose: () => void
  path: string
  isDirectory: boolean
}> = ({ x, y, onClose, path, isDirectory }) => {
  const { rootPath, openFile } = useCoderStore()

  const items = [
    !isDirectory && { label: 'Open', icon: 'open_in_new', action: () => openFile(path) },
    { label: 'Copy Path', icon: 'content_copy', action: async () => {
      await navigator.clipboard.writeText(path)
      onClose()
    }},
    !isDirectory && { label: 'Copy Relative Path', icon: 'content_copy', action: async () => {
      const rel = path.replace(rootPath || '', '').replace(/^[/\\]/, '')
      await navigator.clipboard.writeText(rel)
      onClose()
    }},
    { label: 'Delete', icon: 'delete', action: () => {
      // TODO: implement delete
      onClose()
    }},
  ].filter(Boolean) as Array<{ label: string; icon: string; action: () => void }>

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-surface-container border border-outline-variant/50 rounded-lg shadow-xl py-xs min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full text-left flex items-center gap-sm px-md py-[6px] text-[12px] text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}

export const FileExplorer: React.FC = () => {
  const { tree, rootPath, isScanning, gitStatus, setGitStatus } = useCoderStore()

  const handleScan = async () => {
    useCoderStore.setState({ isScanning: true })
    try {
      const result = await window.api.coderScan(true)
      if (result.success && result.data) {
        useCoderStore.setState({ tree: result.data.tree })
      }
    } catch (e) {
      console.error('Scan failed', e)
    } finally {
      useCoderStore.setState({ isScanning: false })
    }
  }

  const handleNewFile = async () => {
    const name = prompt('Enter file name:')
    if (!name || !rootPath) return
    const filePath = `${rootPath}\\${name}`
    const r = await window.api.coderWrite(filePath, '')
    if (r.success) {
      handleScan()
    } else {
      alert(`Failed: ${r.error}`)
    }
  }

  const handleNewFolder = async () => {
    const name = prompt('Enter folder name:')
    if (!name || !rootPath) return
    const folderPath = `${rootPath}\\${name}`
    try {
      await window.api.createFile?.(folderPath, '', [rootPath])
      handleScan()
    } catch (e) {
      console.error('New folder failed:', e)
    }
  }

  // Refresh git status periodically
  const refreshGit = async () => {
    if (!rootPath) return
    try {
      const r = await window.api.coderGitStatus()
      if (r.success && r.status) {
        setGitStatus(r.status)
      }
    } catch (e) {
      // Not a git repo or error — ignore
    }
  }

  React.useEffect(() => {
    refreshGit()
    const interval = setInterval(refreshGit, 10000)
    return () => clearInterval(interval)
  }, [rootPath])

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-md text-center gap-md">
        <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">folder_open</span>
        <p className="text-body-sm text-on-surface-variant/50">No workspace selected</p>
        <button
          onClick={async () => {
            const r = await window.api.coderPickWorkspace()
            if (r.success && r.data?.path) {
              useCoderStore.setState({ rootPath: r.data.path })
              handleScan()
            }
          }}
          className="px-md py-sm bg-secondary/20 text-secondary rounded-lg text-[12px] hover:bg-secondary/30 transition-colors"
        >
          Open Folder
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-md py-sm font-label-caps text-label-caps text-on-surface-variant flex justify-between items-center shrink-0">
        <span className="truncate">{rootPath.split(/[/\\]/).pop() || 'Workspace'}</span>
        <div className="flex gap-xs">
          <span
            className="material-symbols-outlined text-[14px] cursor-pointer hover:text-on-surface transition-colors"
            onClick={handleNewFile}
            title="New file"
          >
            note_add
          </span>
          <span
            className="material-symbols-outlined text-[14px] cursor-pointer hover:text-on-surface transition-colors"
            onClick={handleNewFolder}
            title="New folder"
          >
            create_new_folder
          </span>
          <span
            className={cn(
              'material-symbols-outlined text-[14px] cursor-pointer hover:text-on-surface transition-colors',
              isScanning && 'animate-spin text-secondary'
            )}
            onClick={handleScan}
            title="Refresh"
          >
            {isScanning ? 'sync' : 'refresh'}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto font-body-sm text-body-sm">
        {tree.length === 0 ? (
          <div className="px-md py-lg text-center text-body-sm text-on-surface-variant/50">
            {isScanning ? 'Scanning...' : 'Empty project or not scanned'}
          </div>
        ) : (
          tree.map((node) => <FileNode key={node.path} node={node} depth={0} />)
        )}
      </div>
    </div>
  )
}
