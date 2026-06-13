import React, { useState, useCallback } from 'react'
import { useCoderStore } from '../../store/useCoderStore'
import { cn } from '../../utils/cn'

export const CodebaseSearch: React.FC = () => {
  const { rootPath } = useCoderStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ filePath: string; relativePath: string; line: number; text: string }>>([])
  const [loading, setLoading] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !rootPath) return
    setLoading(true)
    try {
      const r = await window.api.coderSearchCodebase(query)
      if (r.success && r.results) {
        setResults(r.results)
      }
    } catch (e) {
      console.error('Search failed:', e)
    } finally {
      setLoading(false)
    }
  }, [query, rootPath])

  const openResult = (filePath: string, line: number) => {
    const { openFile } = useCoderStore.getState()
    openFile(filePath)
    // TODO: scroll to line in editor
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-sm border-b border-outline-variant/30">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search across files..."
            className="w-full bg-surface-container-high border border-outline-variant/50 rounded-md py-[4px] pl-[28px] pr-sm text-[12px] text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-secondary focus:outline-none"
          />
          <span className="absolute left-[6px] top-1/2 -translate-y-1/2 material-symbols-outlined text-[14px] text-on-surface-variant">search</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-md text-center text-[12px] text-on-surface-variant animate-pulse">Searching...</div>
        )}

        {!loading && results.length === 0 && query && (
          <div className="p-md text-center text-[12px] text-on-surface-variant/50">No results found</div>
        )}

        {!query && (
          <div className="p-md text-center text-[12px] text-on-surface-variant/50">
            Type a query and press Enter to search across all files
          </div>
        )}

        {results.map((result, i) => (
          <button
            key={i}
            onClick={() => openResult(result.filePath, result.line)}
            className="w-full text-left p-sm hover:bg-surface-container-high transition-colors border-b border-outline-variant/20"
          >
            <div className="text-[11px] text-secondary font-medium truncate">{result.relativePath}:{result.line}</div>
            <div className="text-[12px] text-on-surface-variant truncate mt-[2px]">{result.text}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
