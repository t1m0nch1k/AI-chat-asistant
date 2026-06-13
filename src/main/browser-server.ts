import { WebSocketServer, WebSocket } from 'ws'
import { ToolResult } from './tool-manager'
import { toolManager } from './tool-manager'

/**
 * BrowserExtensionServer manages the WebSocket connection to the Firefox extension.
 * It acts as a bridge between the Agent's ToolManager and the Browser's Content Scripts.
 */
export class BrowserExtensionServer {
  private wss: WebSocketServer | null = null
  private activeSocket: WebSocket | null = null
  private port = 8000

  public start(): void {
    this.wss = new WebSocketServer({ port: this.port })
    console.log(`[BrowserServer] WebSocket server started on ws://localhost:${this.port}`)

    this.wss.on('connection', (ws) => {
      console.log('[BrowserServer] Extension connected')
      this.activeSocket = ws

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString())
          console.log('[BrowserServer] Received from extension:', data)

          if (data.type === 'response') {
            // This is a response to a command sent by the AI
            // We handle this via a request-response pattern in ToolManager if needed,
            // but for now, we just log it.
            console.log(`[BrowserServer] Action response for ${data.requestId}:`, data.result)
          }
        } catch (e) {
          console.error('[BrowserServer] Error parsing extension message:', e)
        }
      })

      ws.on('close', () => {
        console.log('[BrowserServer] Extension disconnected')
        this.activeSocket = null
      })
    })
  }

  /**
   * Sends a command to the browser extension.
   */
  public async sendCommand(action: string, params: any = {}): Promise<ToolResult> {
    if (!this.activeSocket) {
      return { success: false, error: 'Browser extension is not connected' }
    }

    return new Promise((resolve) => {
      const requestId = Math.random().toString(36).substring(7)
      
      // Create a temporary listener for the response
      const messageHandler = (message: any) => {
        const data = JSON.parse(message.toString())
        if (data.type === 'response' && data.requestId === requestId) {
          this.activeSocket?.removeListener('message', messageHandler)
          resolve({
            success: data.result.success ?? false,
            content: data.result.content || '',
            error: data.result.error || null,
            data: data.result.data || null
          })
        }
      }

      this.activeSocket.on('message', messageHandler)

      const payload = {
        requestId,
        action,
        ...params
      }

      console.log(`[BrowserServer] Sending command: ${action}`, payload)
      this.activeSocket.send(JSON.stringify(payload))

      // Timeout after 15 seconds
      setTimeout(() => {
        this.activeSocket?.removeListener('message', messageHandler)
        resolve({ success: false, error: 'Timeout waiting for response from browser' })
      }, 15000)
    })
  }

  public stop(): void {
    if (this.wss) {
      this.wss.close()
      this.wss = null
    }
  }
}

export const browserServer = new BrowserExtensionServer()
