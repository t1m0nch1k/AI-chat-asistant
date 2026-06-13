import React from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

export const ComposerPanel: React.FC = () => {
  const {
    composerFiles,
    composerActiveFile,
    setComposerActiveFile,
    closeComposerFile,
    applyComposerChanges,
    rejectComposerChanges,
  } = useCoderStore()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30 bg-surface-container shrink-0">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-[16px] text-secondary">edit_note</span>
          <span className="text-[12px] font-semibold text-on-surface">Composer</span>
        </div>
        <div className="flex gap-xs">
          <button
            onClick={applyComposerChanges}
            disabled={composerFiles.length === 0}
            className="text-[10px] px-xs py-[2px] bg-success/20 text-success rounded hover:bg-success/30 transition-colors disabled:opacity-30"
            title="Apply all changes"
          >
            Accept
          </button>
          <button
            onClick={rejectComposerChanges}
            disabled={composerFiles.length === 0}
            className="text-[10px] px-xs py-[2px] bg-error/20 text-error rounded hover:bg-error/30 transition-colors disabled:opacity-30"
            title="Reject all changes"
          >
            Reject
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {composerFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-md text-center gap-md">
            <span className="material-symbols-outlined text-[40px] text-on-surface-variant/30">edit_note</span>
            <div>
              <p className="text-body-sm text-on-surface-variant/50">No composer files</p>
              <p className="text-[11px] text-on-surface-variant/30 mt-xs">
                Switch to Composer mode in chat to edit multiple files
              </p>
            </div>
          </div>
        ) : (
          <div className="p-sm space-y-xs">
            {composerFiles.map((file) => (
              <div
                key={file.path}
                className={cn(
                  'flex items-center gap-xs px-sm py-[6px] rounded cursor-pointer transition-colors',
                  file.isActive
                    ? 'bg-secondary/10 text-secondary border-l-2 border-secondary'
                    : 'hover:bg-surface-container-high text-on-surface-variant'
                )}
                onClick={() => setComposerActiveFile(file.path)}
              >
                <span className="material-symbols-outlined text-[14px] shrink-0">
                  {file.isModified ? 'edit_note' : 'description'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-medium truncate">
                    {file.path.split('/').pop()}
                  </div>
                  <div className="text-[10px] truncate opacity-60">
                    {file.path}
                  </div>
                </div>
                {file.isModified && (
                  <span className="w-[6px] h-[6px] rounded-full bg-warning shrink-0" />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeComposerFile(file.path)
                  }}
                  className="material-symbols-outlined text-[14px] opacity-0 hover:opacity-100 transition-opacity text-on-surface-variant hover:text-error"
                >
                  close
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
