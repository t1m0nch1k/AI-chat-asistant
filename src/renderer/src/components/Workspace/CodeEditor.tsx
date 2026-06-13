import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

// Simple syntax highlighting colors (inline styles for performance)
const SYNTAX_COLORS: Record<string, Record<string, string>> = {
  ts: {
    keyword: '#c586c0',
    string: '#ce9178',
    comment: '#6a9955',
    number: '#b5cea8',
    function: '#dcdcaa',
    type: '#4ec9b0',
    operator: '#d4d4d4',
    punctuation: '#d4d4d4',
  },
  js: {
    keyword: '#c586c0',
    string: '#ce9178',
    comment: '#6a9955',
    number: '#b5cea8',
    function: '#dcdcaa',
    operator: '#d4d4d4',
    punctuation: '#d4d4d4',
  },
  py: {
    keyword: '#c586c0',
    string: '#ce9178',
    comment: '#6a9955',
    number: '#b5cea8',
    function: '#dcdcaa',
    operator: '#d4d4d4',
    punctuation: '#d4d4d4',
  },
  css: {
    property: '#9cdcfe',
    value: '#ce9178',
    selector: '#d7ba7d',
    comment: '#6a9955',
    punctuation: '#d4d4d4',
  },
  html: {
    tag: '#569cd6',
    attr: '#9cdcfe',
    string: '#ce9178',
    comment: '#6a9955',
    punctuation: '#d4d4d4',
  },
}

// Simple regex-based tokenizer
function tokenizeLine(line: string, lang: string): Array<{ text: string; type: string }> {
  const colors = SYNTAX_COLORS[lang] || SYNTAX_COLORS.ts
  const tokens: Array<{ text: string; type: string }> = []

  if (lang === 'ts' || lang === 'js' || lang === 'py') {
    const patterns = [
      { regex: /\/\/.*$/, type: 'comment' },
      { regex: /\/\*[\s\S]*?\*\//, type: 'comment' },
      { regex: /"(?:[^"\\]|\\.)*"/, type: 'string' },
      { regex: /'(?:[^'\\]|\\.)*'/, type: 'string' },
      { regex: /`(?:[^`\\]|\\.)*`/, type: 'string' },
      { regex: /\b(?:const|let|var|function|class|interface|type|enum|import|export|from|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|new|this|super|extends|implements|async|await|yield|typeof|instanceof|in|of|as|is|with|debugger|void|delete|true|false|null|undefined)\b/, type: 'keyword' },
      { regex: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/, type: 'number' },
      { regex: /\b[A-Z][a-zA-Z0-9_]*\b/, type: 'type' },
      { regex: /\b[a-zA-Z_][a-zA-Z0-9_]*\s*(?=\()/, type: 'function' },
      { regex: /[+\-*/%=<>!&|^~?:]+/, type: 'operator' },
      { regex: /[{}\[\](),.;]/, type: 'punctuation' },
    ]

    let remaining = line
    while (remaining.length > 0) {
      let matched = false
      for (const p of patterns) {
        const m = remaining.match(p.regex)
        if (m && m.index === 0) {
          tokens.push({ text: m[0], type: p.type })
          remaining = remaining.slice(m[0].length)
          matched = true
          break
        }
      }
      if (!matched) {
        tokens.push({ text: remaining[0], type: 'text' })
        remaining = remaining.slice(1)
      }
    }
  } else {
    tokens.push({ text: line, type: 'text' })
  }

  return tokens
}

function getLangFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'ts', tsx: 'ts', js: 'js', jsx: 'js',
    py: 'py', css: 'css', scss: 'css', html: 'html', htm: 'html',
    json: 'json', md: 'md', yaml: 'yaml', yml: 'yaml',
    java: 'java', go: 'go', rs: 'rust', cpp: 'cpp', c: 'c',
    php: 'php', rb: 'ruby', swift: 'swift', kt: 'kotlin',
  }
  return map[ext] || 'text'
}

export const CodeEditor: React.FC = () => {
  const {
    openFiles,
    activeFile,
    closeFile,
    setActiveFile,
    inlineEdit,
    setSelectedCode,
    startInlineEdit,
    // Cursor/OpenCode: Composer
    composerFiles,
    composerActiveFile,
    closeComposerFile,
    setComposerActiveFile,
    updateComposerFile,
    showComposerPanel,
    agentState,
  } = useCoderStore()

  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState('text')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorCol, setCursorCol] = useState(1)

  // Determine if we're in composer mode
  const isComposerMode = agentState.mode === 'composer' && showComposerPanel

  // Get active files based on mode
  const displayFiles = isComposerMode ? composerFiles.map(f => f.path) : openFiles
  const displayActiveFile = isComposerMode ? composerActiveFile : activeFile

  useEffect(() => {
    if (displayActiveFile) {
      loadFileContent(displayActiveFile)
      setLang(getLangFromPath(displayActiveFile))
    } else {
      setContent('')
      setOriginalContent('')
    }
  }, [displayActiveFile, isComposerMode])

  // Apply inline edit when status changes to 'applied'
  useEffect(() => {
    if (inlineEdit?.status === 'applied' && inlineEdit.suggestedCode) {
      const lines = content.split('\n')
      const startIdx = inlineEdit.startLine - 1
      const endIdx = inlineEdit.endLine
      const newLines = [
        ...lines.slice(0, startIdx),
        ...inlineEdit.suggestedCode.split('\n'),
        ...lines.slice(endIdx)
      ]
      const newContent = newLines.join('\n')
      setContent(newContent)
      handleSave(displayActiveFile!, newContent)
      // Reset inline edit
      useCoderStore.setState({ inlineEdit: null, selectedCode: null })
    }
  }, [inlineEdit?.status])

  const loadFileContent = async (path: string) => {
    setLoading(true)
    try {
      // In composer mode, load from composer store
      if (isComposerMode) {
        const composerFile = composerFiles.find(f => f.path === path)
        if (composerFile) {
          setContent(composerFile.content)
          setOriginalContent(composerFile.originalContent)
          setLoading(false)
          return
        }
      }

      const result = await window.api.coderRead(path)
      if (result.success && result.content !== undefined) {
        setContent(result.content)
        setOriginalContent(result.content)
      } else {
        setContent(`Error: ${result.error}`)
        setOriginalContent('')
      }
    } catch (e) {
      setContent(`Exception: ${e}`)
      setOriginalContent('')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (path: string, newContent: string) => {
    try {
      if (isComposerMode) {
        // In composer mode, update composer store instead of writing to disk
        updateComposerFile(path, newContent)
        setOriginalContent(newContent)
        return
      }

      const result = await window.api.coderWrite(path, newContent)
      if (!result.success) {
        console.error('Failed to save:', result.error)
      } else {
        setOriginalContent(newContent)
      }
    } catch (e: any) {
      console.error('Save error:', e.message)
    }
  }

  const getFileName = (path: string) => path.split(/[/\\]/).pop() || path
  const isModified = content !== originalContent

  const lineCount = content.split('\n').length
  const lines = content.split('\n')

  // Handle Ctrl+K for inline editing
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea || !displayActiveFile) return

      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      if (start === end) return // No selection

      const selectedText = content.slice(start, end)
      const beforeText = content.slice(0, start)
      const startLine = beforeText.split('\n').length
      const selectedLines = selectedText.split('\n')
      const endLine = startLine + selectedLines.length - 1

      setSelectedCode({ text: selectedText, startLine, endLine })
      startInlineEdit({ text: selectedText, startLine, endLine })
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (displayActiveFile) handleSave(displayActiveFile, content)
    }
  }, [content, displayActiveFile, setSelectedCode, startInlineEdit, isComposerMode])

  const handleSelectionChange = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const beforeText = content.slice(0, start)
    const lines = beforeText.split('\n')
    setCursorLine(lines.length)
    setCursorCol(lines[lines.length - 1].length + 1)
  }, [content])

  // Render diff view when inline edit is suggested
  const renderDiffView = () => {
    if (!inlineEdit || !inlineEdit.suggestedCode || inlineEdit.status !== 'suggested') return null

    const originalLines = inlineEdit.originalCode.split('\n')
    const suggestedLines = inlineEdit.suggestedCode.split('\n')
    const maxLines = Math.max(originalLines.length, suggestedLines.length)

    return (
      <div className="absolute inset-0 bg-surface/95 z-20 flex flex-col">
        <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant/30 bg-surface-container">
          <span className="text-[12px] font-medium text-secondary">AI Suggested Changes</span>
          <div className="flex gap-xs">
            <button
              onClick={() => useCoderStore.getState().applyInlineEdit()}
              className="px-sm py-[2px] bg-success/20 text-success rounded text-[11px] hover:bg-success/30 transition-colors"
            >
              Accept (Ctrl+Enter)
            </button>
            <button
              onClick={() => useCoderStore.getState().rejectInlineEdit()}
              className="px-sm py-[2px] bg-error/20 text-error rounded text-[11px] hover:bg-error/30 transition-colors"
            >
              Reject (Esc)
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-md font-code-sm text-code-sm">
          {Array.from({ length: maxLines }, (_, i) => {
            const orig = originalLines[i] || ''
            const sugg = suggestedLines[i] || ''
            const isChanged = orig !== sugg
            return (
              <div key={i} className="flex">
                <div className={cn(
                  'w-full py-[1px] px-sm',
                  isChanged ? 'bg-warning/10' : ''
                )}>
                  {isChanged ? (
                    <>
                      <div className="text-error/60 line-through">{orig || ' '}</div>
                      <div className="text-success">{sugg || ' '}</div>
                    </>
                  ) : (
                    <div className="text-on-surface-variant/50">{orig || ' '}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Composer mode badge
  const ComposerBadge = () => {
    if (!isComposerMode) return null
    return (
      <div className="absolute top-2 right-2 z-10 px-sm py-[2px] bg-secondary/20 text-secondary rounded text-[10px] font-medium border border-secondary/30">
        <span className="material-symbols-outlined text-[10px] inline-block align-middle mr-[2px]">edit_note</span>
        Composer Mode
      </div>
    )
  }

  if (!displayActiveFile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-on-surface-variant/50">
        <div className="text-center">
          <span className="material-symbols-outlined text-[48px] mb-md text-on-surface-variant/20">code</span>
          <p className="text-body-sm italic">
            {isComposerMode ? 'Select a composer file' : 'Select a file to start coding'}
          </p>
          <p className="text-[11px] text-on-surface-variant/30 mt-xs">Ctrl+K to edit selected code with AI</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <ComposerBadge />

      {/* Editor Tabs */}
      <div className="flex items-center bg-surface-container border-b border-outline-variant/30 h-[36px] overflow-x-auto no-scrollbar">
        {displayFiles.map((path) => {
          const isActive = path === displayActiveFile
          const isFileModified = isActive && isModified
          // Check if composer file is modified
          const composerFile = composerFiles.find(f => f.path === path)
          const showModified = isComposerMode
            ? (composerFile?.isModified ?? false)
            : isFileModified

          return (
            <div
              key={path}
              onClick={() => isComposerMode ? setComposerActiveFile(path) : setActiveFile(path)}
              className={cn(
                'flex items-center gap-sm px-md py-sm cursor-pointer transition-all duration-150 min-w-[120px] max-w-[200px] border-r border-outline-variant/30 group select-none',
                isActive ? 'bg-surface text-secondary border-t-2 border-t-secondary' : 'text-on-surface-variant hover:bg-surface-container-highest',
              )}
            >
              <span className={cn(
                'w-[6px] h-[6px] rounded-full shrink-0',
                showModified ? 'bg-warning' : 'bg-transparent'
              )} />
              <span className="font-body-sm text-body-sm truncate">{getFileName(path)}</span>
              <span
                className="material-symbols-outlined text-[12px] ml-auto opacity-0 group-hover:opacity-100 hover:bg-surface-variant rounded transition-all cursor-pointer shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  isComposerMode ? closeComposerFile(path) : closeFile(path)
                }}
              >
                close
              </span>
            </div>
          )
        })}
      </div>

      {/* Code Editor */}
      <div className="flex-1 overflow-hidden bg-surface relative flex">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/80 z-10 backdrop-blur-sm">
            <div className="text-body-sm text-on-surface-variant animate-pulse">Loading...</div>
          </div>
        )}

        {/* Line Numbers */}
        <div className="w-[56px] bg-surface-container-lowest text-on-surface-variant/40 text-right pr-sm py-md select-none font-code-sm shrink-0 overflow-hidden">
          {lines.map((_, i) => (
            <div key={i} className={cn(
              'leading-[22px]',
              i + 1 === cursorLine ? 'text-on-surface-variant/80' : ''
            )}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (isComposerMode && displayActiveFile) {
              updateComposerFile(displayActiveFile, e.target.value)
            }
          }}
          onKeyDown={handleKeyDown}
          onSelect={handleSelectionChange}
          onClick={handleSelectionChange}
          className="flex-1 bg-transparent text-on-surface font-code-sm text-code-sm resize-none outline-none p-md pl-sm custom-scrollbar leading-[22px] whitespace-pre tab-4"
          spellCheck={false}
          style={{ tabSize: 2 }}
        />

        {/* Diff Overlay */}
        {renderDiffView()}
      </div>

      {/* Status Bar */}
      <div className="h-[24px] bg-surface-container border-t border-outline-variant/30 flex items-center px-md text-[11px] text-on-surface-variant/60 select-none">
        <div className="flex items-center gap-md">
          <span>{getFileName(displayActiveFile)}</span>
          <span>{lang.toUpperCase()}</span>
          <span>Ln {cursorLine}, Col {cursorCol}</span>
          {isModified && <span className="text-warning">● Modified</span>}
          {isComposerMode && <span className="text-secondary">Composer</span>}
        </div>
        <div className="ml-auto flex items-center gap-md">
          <span>UTF-8</span>
          <span>CRLF</span>
          <span>{content.length} chars</span>
        </div>
      </div>
    </div>
  )
}
