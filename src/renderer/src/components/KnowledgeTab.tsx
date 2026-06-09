import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Search, X, Save } from 'lucide-react'
import { cn } from '../utils/cn'

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-wider mb-1">
    {children}
  </label>
)

export const KnowledgeTab: React.FC = () => {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newEntry, setNewEntry] = useState({ key: '', value: '', category: 'general' })
  const [isAdding, setIsAdding] = useState(false)

  const loadKnowledge = async () => {
    setLoading(true)
    try {
      const res = await window.api.knowledgeGetAll()
      setEntries(res.entries || [])
    } catch (e) {
      console.error('Failed to load knowledge:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadKnowledge()
  }, [])

  const handleSave = async () => {
    if (!newEntry.key.trim() || !newEntry.value.trim()) return
    try {
      const res = await window.api.knowledgeSave(newEntry)
      if (res.success) {
        setEntries([...entries, { ...newEntry, id: crypto.randomUUID() }]) // simplified ID
        setNewEntry({ key: '', value: '', category: 'general' })
        setIsAdding(false)
      }
    } catch (e) {
      console.error('Failed to save knowledge:', e)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await window.api.knowledgeDelete(id)
      if (res.success) {
        setEntries(entries.filter(e => e.id !== id))
      }
    } catch (e) {
      console.error('Failed to delete knowledge:', e)
    }
  }

  const filtered = entries.filter(e => 
    e.key.toLowerCase().includes(search.toLowerCase()) || 
    e.value.toLowerCase().includes(search.toLowerCase()) ||
    e.category.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Personal Knowledge Base</Label>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent text-[11px] transition-colors"
        >
          <Plus size={12} /> Add Entry
        </button>
      </div>

      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search knowledge..."
          className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[13px] outline-none focus:border-accent/50"
        />
      </div>

      {isAdding && (
        <div className="p-3 rounded-xl bg-white/5 border border-accent/30 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40">Key / Fact</label>
              <input
                type="text"
                value={newEntry.key}
                onChange={e => setNewEntry({...newEntry, key: e.target.value})}
                placeholder="e.g. Favorite Color"
                className="w-full bg-white/10 border border-white/10 rounded-lg py-1.5 px-2 text-[12px] outline-none focus:border-accent/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40">Category</label>
              <input
                type="text"
                value={newEntry.category}
                onChange={e => setNewEntry({...newEntry, category: e.target.value})}
                placeholder="e.g. preferences"
                className="w-full bg-white/10 border border-white/10 rounded-lg py-1.5 px-2 text-[12px] outline-none focus:border-accent/50"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40">Value / Detail</label>
            <textarea
              value={newEntry.value}
              onChange={e => setNewEntry({...newEntry, value: e.target.value})}
              placeholder="e.g. The user prefers dark blue"
              className="w-full bg-white/10 border border-white/10 rounded-lg py-1.5 px-2 text-[12px] outline-none focus:border-accent/50 resize-none"
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg text-[11px] text-white/40 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/80 text-white text-[11px] transition-colors"
            >
              <Save size={12} /> Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center py-8 text-white/20 text-[12px]">Loading knowledge...</p>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-white/20 text-[12px] italic">No entries found.</p>
          ) : (
            filtered.map((e, i) => (
              <div key={e.id || i} className="group flex items-start justify-between gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/20 text-accent uppercase">
                      {e.category}
                    </span>
                    <span className="text-[13px] font-medium text-white/90 truncate">{e.key}</span>
                  </div>
                  <p className="text-[12px] text-white/60 break-words">{e.value}</p>
                </div>
                <button 
                  onClick={() => handleDelete(e.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
