
import { create } from 'zustand'
import { CoderFileNode, CoderWorkspaceState } from '../types'

interface CoderStore extends CoderWorkspaceState {
  isCoderMode: boolean
  
  // Actions
  setCoderMode: (enabled: boolean) => void
  setWorkspaceRoot: (path: string | null) => void
  setTree: (tree: CoderFileNode[]) => void
  setScanning: (scanning: boolean) => void
  openFile: (path: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string | null) => void
  clearWorkspace: () => void
}

export const useCoderStore = create<CoderStore>((set) => ({
  // State
  rootPath: null,
  tree: [],
  openFiles: [],
  activeFile: null,
  isScanning: false,
  isCoderMode: false,

  // Actions
  setCoderMode: (enabled) => set({ isCoderMode: enabled }),
  
  setWorkspaceRoot: (rootPath) => set({ rootPath }),
  
  setTree: (tree) => set({ tree }),
  
  setScanning: (isScanning) => set({ isScanning }),
  
  openFile: (path) => set((state) => ({
    openFiles: state.openFiles.includes(path) 
      ? state.openFiles 
      : [...state.openFiles, path],
    activeFile: path
  })),
  
  closeFile: (path) => set((state) => {
    const newOpenFiles = state.openFiles.filter(f => f !== path)
    let newActiveFile = state.activeFile
    
    if (state.activeFile === path) {
      newActiveFile = newOpenFiles.length > 0 
        ? newOpenFiles[newOpenFiles.length - 1] 
        : null
    }
    
    return {
      openFiles: newOpenFiles,
      activeFile: newActiveFile
    }
  }),
  
  setActiveFile: (activeFile) => set({ activeFile }),
  
  clearWorkspace: () => set({
    rootPath: null,
    tree: [],
    openFiles: [],
    activeFile: null,
    isScanning: false
  })
}))
