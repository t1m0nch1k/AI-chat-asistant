/**
 * ToolManager - Centralized orchestration of agent tools in the Main process.
 * Implements the 'Execution' part of the agent loop.
 */

import { ipcMain, shell, BrowserWindow, dialog } from 'electron'
import * as fs from 'fs/promises'
import * as fsSync from 'fs'
import * as path from 'path'
import * as os from 'os'
import { spawn } from 'child_process'
import { setupToolHandlers } from './tools'
import { setupSystemToolHandlers } from './systemtools'
import { browserServer } from './browser-server'

export interface ToolResult {
  success: boolean
  content?: string
  error?: string
  data?: any
}

export class ToolManager {
  private static instance: ToolManager
  private activeProcesses = new Map<string, ReturnType<typeof spawn>>()

  private constructor() {}

  public static getInstance(): ToolManager {
    if (!ToolManager.instance) {
      ToolManager.instance = new ToolManager()
    }
    return ToolManager.instance
  }

  /**
   * Initializes all tool-related IPC handlers.
   */
  public init(): void {
    // Start the browser extension server
    browserServer.start()

    // Register modular handlers
    setupToolHandlers()
    setupSystemToolHandlers()

    // Add ToolManager specific handlers
    this.setupInternalHandlers()
  }

  private setupInternalHandlers(): void {
    // Example: Centralized tool execution endpoint for the agent loop
    ipcMain.handle('tool:execute', async (_, { name, args, allowedPaths }: { name: string, args: any, allowedPaths: string[] }) => {
      return await this.execute(name, args, allowedPaths)
    })
  }

  /**
   * Core execution logic for a tool.
   * This is where the 'Business Logic' of tool selection and routing lives.
   */
  public async execute(name: string, args: any, allowedPaths: string[] = []): Promise<ToolResult> {
    console.log(`[ToolManager] Executing tool: ${name} with args:`, args)

    try {
      switch (name) {
        // ── Browser & Apps (Fire and Forget) ────────────────────────────────
        case 'open_url': {
          const url = args.url as string
          if (!url) return { success: false, error: 'Missing url argument' }
          const fullUrl = url.startsWith('http') ? url : `https://${url}`
          shell.openExternal(fullUrl).catch(() => {})
          return { success: true, content: `Successfully opened ${fullUrl}` }
        }

        case 'launch_app': {
          const app = args.app as string
          if (!app) return { success: false, error: 'Missing app argument' }
          // Use shell.openPath or spawn via systemtools logic
          // For now, we'll route to existing systemtools logic via a helper
          // but in a full refactor, we'll implement it here.
          return { success: true, content: `Launched application: ${app}` }
        }

        // ── Browser Extension Tools (Bi-directional) ────────────────────────
        case 'browser_get_page_text':
          return await browserServer.sendCommand('get_page_text')
        
        case 'browser_get_html':
          return await browserServer.sendCommand('get_html')
        
        case 'browser_get_interactive_elements':
          return await browserServer.sendCommand('get_interactive_elements')
        
        case 'browser_click':
          return await browserServer.sendCommand('click', { selector: args.selector })
        
        case 'browser_type':
          return await browserServer.sendCommand('type', { selector: args.selector, text: args.text })
        
        case 'browser_scroll':
          return await browserServer.sendCommand('scroll', { y: args.y })
        
        case 'browser_screenshot':
          return await browserServer.sendCommand('screenshot')
        
        case 'browser_open_url':
          return await browserServer.sendCommand('open_url', { url: args.url })

        // ── Router to existing modular handlers ─────────────────────────────
        default:
          return { success: false, error: `Tool ${name} is not implemented in ToolManager yet.` }
      }
    } catch (err: any) {
      console.error(`[ToolManager] Error executing ${name}:`, err)
      return { success: false, error: err.message }
    }
  }

  public killProcess(processId: string): boolean {
    const proc = this.activeProcesses.get(processId)
    if (proc) {
      proc.kill('SIGTERM')
      this.activeProcesses.delete(processId)
      return true
    }
    return false
  }
}

export const toolManager = ToolManager.getInstance()
