import React, { useEffect, useState } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

export const GitPanel: React.FC = () => {
  const { rootPath, gitStatus, setGitStatus } = useCoderStore()
  const [loading, setLoading] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [committing, setCommitting] = useState(false)

  const loadGitStatus = async () => {
    if (!rootPath) return
    setLoading(true)
    try {
      const r = await window.api.coderGitStatus()
      if (r.success && r.status) {
        setGitStatus(r.status)
      }
    } catch (e) {
      console.error('Git status failed:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGitStatus()
    const interval = setInterval(loadGitStatus, 30000)
    return () => clearInterval(interval)
  }, [rootPath])

  const handleCommit = async () => {
    if (!commitMessage.trim() || !gitStatus?.isRepo) return
    setCommitting(true)
    try {
      const r = await window.api.coderGitCommit(commitMessage)
      if (r.success) {
        setCommitMessage('')
        loadGitStatus()
      }
    } catch (e) {
      console.error('Commit failed:', e)
    } finally {
      setCommitting(false)
    }
  }

  if (!rootPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-md text-center">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30 mb-sm">folder_off</span>
        <p className="text-[12px] text-on-surface-variant/50">Open a workspace to see Git status</p>
      </div>
    )
  }

  if (!gitStatus?.isRepo) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-md text-center">
        <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30 mb-sm">source_control</span>
        <p className="text-[12px] text-on-surface-variant/50">No Git repository found</p>
        <p className="text-[11px] text-on-surface-variant/30 mt-xs">Initialize a repo to track changes</p>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    modified: 'text-warning',
    added: 'text-success',
    deleted: 'text-error',
    untracked: 'text-on-surface-variant',
    renamed: 'text-secondary',
    conflict: 'text-error',
  }

  const statusIcons: Record<string, string> = {
    modified: 'edit',
    added: 'add',
    deleted: 'delete',
    untracked: 'new_releases',
    renamed: 'sync_alt',
    conflict: 'warning',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Branch info */}
      <div className="p-sm border-b border-outline-variant/30">
        <div className="flex items-center gap-xs">
          <span className="material-symbols-outlined text-[14px] text-secondary">fork_right</span>
          <span className="text-[12px] font-medium text-on-surface">{gitStatus.branch}</span>
          {gitStatus.ahead > 0 && (
            <span className="text-[10px] px-xs py-[1px] bg-success/10 text-success rounded">↑{gitStatus.ahead}</span>
          )}
          {gitStatus.behind > 0 && (
            <span className="text-[10px] px-xs py-[1px] bg-warning/10 text-warning rounded">↓{gitStatus.behind}</span>
          )}
        </div>
      </div>

      {/* Commit input */}
      <div className="p-sm border-b border-outline-variant/30">
        <div className="flex gap-xs">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCommit()}
            placeholder="Commit message..."
            className="flex-1 bg-surface-container-high border border-outline-variant/50 rounded-md py-[4px] px-sm text-[12px] text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-secondary focus:outline-none"
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim() || committing}
            className="px-sm py-[4px] bg-secondary text-on-secondary rounded-md text-[11px] font-medium hover:bg-secondary/80 transition-colors disabled:opacity-30"
          >
            {committing ? '...' : 'Commit'}
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading && gitStatus.files.length === 0 && (
          <div className="p-md text-center text-[12px] text-on-surface-variant animate-pulse">Loading...</div>
        )}

        {gitStatus.files.length === 0 && (
          <div className="p-md text-center text-[12px] text-on-surface-variant/50">No changes</div>
        )}

        {gitStatus.files.map((file, i) => (
          <div
            key={i}
            className="flex items-center gap-xs px-sm py-[4px] hover:bg-surface-container-high transition-colors"
          >
            <span className={cn('material-symbols-outlined text-[14px]', statusColors[file.status])}>
              {statusIcons[file.status] || 'circle'}
            </span>
            <span className="text-[11px] text-on-surface truncate flex-1">{file.path}</span>
            {file.staged && (
              <span className="text-[9px] px-[3px] py-[1px] bg-secondary/10 text-secondary rounded">staged</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
