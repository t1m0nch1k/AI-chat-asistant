import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export function createTray(mainWindow: BrowserWindow, toggleWindow: () => void, onQuit: () => void): Tray {
  // Load icon — use a bundled PNG/ICO
  let icon: Electron.NativeImage
  try {
    const iconPath = is.dev
      ? join(process.cwd(), 'resources', 'icon.png')
      : join(process.resourcesPath, 'resources', 'icon.png')
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error('empty')
    icon = icon.resize({ width: 16, height: 16 })
  } catch {
    // Fallback: create a simple colored icon programmatically
    icon = createFallbackIcon()
  }

  const tray = new Tray(icon)
  tray.setToolTip('AI Assistant  •  Alt+Shift+G')

  const buildMenu = () =>
    Menu.buildFromTemplate([
      {
        label: '🤖  AI Assistant',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open Chat',
        accelerator: 'Alt+Shift+G',
        click: () => {
          mainWindow.show()
          mainWindow.focus()
        }
      },
      {
        label: 'Open as Window',
        click: () => {
          mainWindow.webContents.send('window-mode-changed', true)
          // Trigger window mode via IPC
          mainWindow.setSkipTaskbar(false)
          mainWindow.setSize(900, 700, true)
          const { workArea } = require('electron').screen.getPrimaryDisplay()
          mainWindow.setPosition(
            Math.round(workArea.x + (workArea.width - 900) / 2),
            Math.round(workArea.y + (workArea.height - 700) / 2),
            true
          )
          mainWindow.show()
          mainWindow.focus()
        }
      },
      {
        label: 'Settings',
        click: () => {
          mainWindow.webContents.send('navigate', 'settings')
          mainWindow.show()
          mainWindow.focus()
        }
      },
      { type: 'separator' },
      {
        label: 'New Chat',
        click: () => {
          mainWindow.webContents.send('tray:new-chat')
          mainWindow.show()
          mainWindow.focus()
        }
      },
      { type: 'separator' },
      {
        label: 'Quit AI Assistant',
        click: () => {
          onQuit()
        }
      }
    ])

  tray.setContextMenu(buildMenu())

  // Single click = toggle window
  tray.on('click', () => toggleWindow())

  // Double click = always show
  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  return tray
}

// ── Fallback Icon (16×16 blue square) ────────────────────────────────────────

function createFallbackIcon(): Electron.NativeImage {
  const SIZE = 16
  // Build a minimal 16x16 PNG buffer (Windows 11 blue square)
  const png = buildMinimalPNG(SIZE, SIZE, 0, 120, 212)
  return nativeImage.createFromBuffer(png)
}

function buildMinimalPNG(w: number, h: number, r: number, g: number, b: number): Buffer {
  // Minimal PNG encoder for a solid-color image
  const zlib = require('zlib')

  const IHDR = buildChunk('IHDR', Buffer.from([
    0, 0, 0, w,   // width
    0, 0, 0, h,   // height
    8,            // bit depth
    2,            // color type: RGB
    0, 0, 0       // compression, filter, interlace
  ]))

  // Build raw image data: each row = filter byte (0) + RGB pixels
  const rowSize = 1 + w * 3
  const raw = Buffer.alloc(h * rowSize)
  for (let y = 0; y < h; y++) {
    raw[y * rowSize] = 0 // filter type: None
    for (let x = 0; x < w; x++) {
      const offset = y * rowSize + 1 + x * 3
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
    }
  }

  const compressed = zlib.deflateSync(raw)
  const IDAT = buildChunk('IDAT', compressed)
  const IEND = buildChunk('IEND', Buffer.alloc(0))

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([signature, IHDR, IDAT, IEND])
}

function buildChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  // CRC32 implementation (no zlib.crc32 in Node.js)
  const crc = crc32(Buffer.concat([typeBuffer, data]))
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc >>> 0, 0)

  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

function crc32(buf: Buffer): number {
  const table = makeCRCTable()
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function makeCRCTable(): Uint32Array {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c
  }
  return table
}
