
import { BrowserWindow, screen } from 'electron'

let overlayWindow: BrowserWindow | null = null

export function showOverlay(): void {
  if (overlayWindow) return

  const { width, height } = screen.getPrimaryDisplay().workArea

  overlayWindow = new BrowserWindow({
    width: screen.getPrimaryDisplay().bounds.width,
    height: screen.getPrimaryDisplay().bounds.height,
    x: screen.getPrimaryDisplay().bounds.x,
    y: screen.getPrimaryDisplay().bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  overlayWindow.setIgnoreMouseEvents(true)

  // Simple HTML for the blue border
  overlayWindow.loadURL(`data:text/html,
    <html>
      <style>
        body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
        .border {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border: 8px solid rgba(0, 120, 215, 0.8);
          box-shadow: inset 0 0 15px rgba(0, 120, 215, 0.5), 0 0 15px rgba(0, 120, 215, 0.5);
          pointer-events: none;
          z-index: 9999;
        }
      </style>
      <body><div class="border"></div></body>
    </html>
  `)
}

export function hideOverlay(): void {
  if (overlayWindow) {
    overlayWindow.close()
    overlayWindow = null
  }
}
