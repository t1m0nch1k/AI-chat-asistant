/**
 * System Tools — управление браузером, приложениями, мышью, клавиатурой.
 *
 * Мышь/клавиатура: нативный C# через WriteFile в stdin постоянного процесса.
 * Это даёт задержку ~5мс вместо ~500мс от запуска powershell.exe каждый раз.
 */

import { ipcMain, shell } from 'electron'
import { exec, spawn, ChildProcess } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'

const execAsync = promisify(exec)

// ── Постоянный C# процесс для быстрого ввода ─────────────────────────────────

let inputProcess: ChildProcess | null = null
let inputProcessReady = false
const pendingCallbacks = new Map<string, (result: string) => void>()

const INPUT_SCRIPT = `
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Drawing;
using System.Windows.Forms;

class InputServer {
    [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] static extern void mouse_event(uint f, int dx, int dy, int d, IntPtr e);
    [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] i, int s);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int k);
    [DllImport("user32.dll")] static extern bool GetCursorPos(out POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);

    const uint MOUSEEVENTF_MOVE        = 0x0001;
    const uint MOUSEEVENTF_LEFTDOWN    = 0x0002;
    const uint MOUSEEVENTF_LEFTUP      = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN   = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP     = 0x0010;
    const uint MOUSEEVENTF_MIDDLEDOWN  = 0x0020;
    const uint MOUSEEVENTF_MIDDLEUP    = 0x0040;
    const uint MOUSEEVENTF_WHEEL       = 0x0800;
    const uint MOUSEEVENTF_ABSOLUTE    = 0x8000;

    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT { public int dx, dy, mouseData; public uint dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Explicit)]
    struct INPUT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(4)] public MOUSEINPUT mi;
        [FieldOffset(4)] public KEYBDINPUT ki;
    }

    static void MoveTo(int x, int y) {
        SetCursorPos(x, y);
    }

    static void MoveSmoothly(int x, int y, int steps) {
        POINT cur; GetCursorPos(out cur);
        for (int i = 1; i <= steps; i++) {
            int nx = cur.X + (x - cur.X) * i / steps;
            int ny = cur.Y + (y - cur.Y) * i / steps;
            SetCursorPos(nx, ny);
            Thread.Sleep(8);
        }
    }

    static void Click(string btn, bool dbl) {
        uint down, up;
        if (btn == "right")  { down = MOUSEEVENTF_RIGHTDOWN;  up = MOUSEEVENTF_RIGHTUP; }
        else if (btn == "middle") { down = MOUSEEVENTF_MIDDLEDOWN; up = MOUSEEVENTF_MIDDLEUP; }
        else                 { down = MOUSEEVENTF_LEFTDOWN;   up = MOUSEEVENTF_LEFTUP; }
        mouse_event(down, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(30);
        mouse_event(up, 0, 0, 0, IntPtr.Zero);
        if (dbl) {
            Thread.Sleep(80);
            mouse_event(down, 0, 0, 0, IntPtr.Zero);
            Thread.Sleep(30);
            mouse_event(up, 0, 0, 0, IntPtr.Zero);
        }
    }

    static void Drag(int x1, int y1, int x2, int y2) {
        SetCursorPos(x1, y1);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, IntPtr.Zero);
        Thread.Sleep(50);
        MoveSmoothly(x2, y2, 20);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, IntPtr.Zero);
    }

    static void Scroll(int delta) {
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, delta, IntPtr.Zero);
    }

    static void TypeText(string text) {
        foreach (char c in text) {
            SendKeys.SendWait(EscapeChar(c));
            Thread.Sleep(5);
        }
    }

    static string EscapeChar(char c) {
        string s = c.ToString();
        if ("{}[]()^+%~".Contains(s)) return "{" + s + "}";
        return s;
    }

    static string GetPos() {
        POINT p; GetCursorPos(out p);
        return p.X + "," + p.Y;
    }

    static void Main() {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding  = System.Text.Encoding.UTF8;
        Console.WriteLine("READY");
        Console.Out.Flush();

        string line;
        while ((line = Console.ReadLine()) != null) {
            try {
                var parts = line.Split('|');
                string id  = parts[0];
                string cmd = parts[1];
                string arg = parts.Length > 2 ? parts[2] : "";

                string result = "OK";
                switch (cmd) {
                    case "move": {
                        var xy = arg.Split(',');
                        MoveTo(int.Parse(xy[0]), int.Parse(xy[1]));
                        break;
                    }
                    case "move_smooth": {
                        var p = arg.Split(',');
                        MoveSmoothly(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]));
                        break;
                    }
                    case "click": {
                        var p = arg.Split(',');
                        if (p.Length >= 2 && p[0] != "" && p[1] != "") {
                            MoveTo(int.Parse(p[0]), int.Parse(p[1]));
                            Thread.Sleep(80);
                        }
                        string btn = p.Length > 2 ? p[2] : "left";
                        bool dbl   = p.Length > 3 && p[3] == "true";
                        Click(btn, dbl);
                        break;
                    }
                    case "drag": {
                        var p = arg.Split(',');
                        Drag(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]));
                        break;
                    }
                    case "scroll": {
                        Scroll(int.Parse(arg));
                        break;
                    }
                    case "type": {
                        var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(arg));
                        TypeText(decoded);
                        break;
                    }
                    case "pos": {
                        result = GetPos();
                        break;
                    }
                    default:
                        result = "ERR:unknown:" + cmd;
                        break;
                }
                Console.WriteLine(id + "|" + result);
                Console.Out.Flush();
            } catch (Exception ex) {
                var p2 = line.Split('|');
                Console.WriteLine((p2.Length > 0 ? p2[0] : "?") + "|ERR:" + ex.Message.Replace('\n',' '));
                Console.Out.Flush();
            }
        }
    }
}
`

// ── Запуск/получение C# процесса ─────────────────────────────────────────────

async function getInputProcess(): Promise<ChildProcess> {
  if (inputProcess && inputProcessReady) return inputProcess

  // Пишем C# скрипт во временный файл
  const scriptPath = join(tmpdir(), 'ai-input-server.cs')
  const exePath = join(tmpdir(), 'ai-input-server.exe')
  writeFileSync(scriptPath, INPUT_SCRIPT, 'utf8')

  // Компилируем через csc (встроен в Windows)
  if (!existsSync(exePath)) {
    const cscPaths = [
      'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
      'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
    ]
    let compiled = false
    for (const csc of cscPaths) {
      if (existsSync(csc)) {
        try {
          await execAsync(
            `"${csc}" /nologo /out:"${exePath}" /r:System.Windows.Forms.dll /r:System.Drawing.dll "${scriptPath}"`,
            { timeout: 15000, windowsHide: true }
          )
          compiled = true
          break
        } catch {}
      }
    }
    if (!compiled) {
      throw new Error('Cannot compile input server: .NET Framework not found')
    }
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(exePath, [], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let buffer = ''
    proc.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed === 'READY') {
          inputProcessReady = true
          resolve(proc)
          continue
        }

        // id|result
        const idx = trimmed.indexOf('|')
        if (idx !== -1) {
          const id = trimmed.slice(0, idx)
          const result = trimmed.slice(idx + 1)
          const cb = pendingCallbacks.get(id)
          if (cb) {
            pendingCallbacks.delete(id)
            cb(result)
          }
        }
      }
    })

    proc.on('error', (err) => {
      inputProcess = null
      inputProcessReady = false
      reject(err)
    })

    proc.on('close', () => {
      inputProcess = null
      inputProcessReady = false
    })

    inputProcess = proc

    setTimeout(() => {
      if (!inputProcessReady) reject(new Error('Input server startup timeout'))
    }, 10000)
  })
}

// ── Отправить команду в C# процесс ───────────────────────────────────────────

async function sendInputCmd(cmd: string, arg = ''): Promise<string> {
  const proc = await getInputProcess()
  const id = Math.random().toString(36).slice(2)

  return new Promise((resolve, reject) => {
    pendingCallbacks.set(id, resolve)
    const line = `${id}|${cmd}|${arg}\n`
    proc.stdin?.write(line, 'utf8', (err) => {
      if (err) {
        pendingCallbacks.delete(id)
        reject(err)
      }
    })
    // Таймаут 5 секунд
    setTimeout(() => {
      if (pendingCallbacks.has(id)) {
        pendingCallbacks.delete(id)
        reject(new Error(`Input command timeout: ${cmd}`))
      }
    }, 5000)
  })
}

// ── Fallback через PowerShell (если C# не скомпилировался) ───────────────────

async function ps(script: string, timeout = 10000): Promise<{ stdout: string; stderr: string }> {
  const scriptPath = join(tmpdir(), `ps-${Date.now()}.ps1`)
  writeFileSync(scriptPath, script, 'utf8')
  try {
    return await execAsync(
      `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { timeout, windowsHide: true }
    )
  } finally {
    try { unlinkSync(scriptPath) } catch {}
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupSystemToolHandlers(): void {

  // ── Открыть URL ───────────────────────────────────────────────────────────

  ipcMain.handle('sys:open-url', async (_, { url }: { url: string }) => {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`
      shell.openExternal(fullUrl).catch(() => {})
      return { success: true, url: fullUrl }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Запустить приложение ──────────────────────────────────────────────────

  ipcMain.handle('sys:launch-app', async (_, { app, args }: { app: string; args?: string }) => {
    try {
      if (app.startsWith('http://') || app.startsWith('https://')) {
        shell.openExternal(app).catch(() => {})
        return { success: true }
      }

      const desktopPath = join(homedir(), 'Desktop')
      const lnkPath = join(desktopPath, `${app}.lnk`)
      const exePath = join(desktopPath, `${app}.exe`)

      if (existsSync(lnkPath)) { await shell.openPath(lnkPath); return { success: true } }
      if (existsSync(exePath)) { await shell.openPath(exePath); return { success: true } }

      const argsStr = args ? ` '${args}'` : ''
      await execAsync(
        `powershell.exe -NoProfile -NonInteractive -Command "Start-Process '${app}'${argsStr}"`,
        { timeout: 10000, windowsHide: true }
      )
      return { success: true }
    } catch (err: any) {
      try { await shell.openPath(app); return { success: true } } catch {}
      return { success: false, error: err.message }
    }
  })

  // ── Получить позицию курсора ──────────────────────────────────────────────

  ipcMain.handle('sys:get-cursor-pos', async () => {
    try {
      const result = await sendInputCmd('pos')
      const [x, y] = result.split(',').map(Number)
      return { success: true, x, y }
    } catch {
      // Fallback
      try {
        const { stdout } = await ps(`
          Add-Type -AssemblyName System.Windows.Forms
          $p = [System.Windows.Forms.Cursor]::Position
          Write-Output "$($p.X),$($p.Y)"
        `)
        const [x, y] = stdout.trim().split(',').map(Number)
        return { success: true, x, y }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  })

  // ── Переместить курсор (мгновенно) ───────────────────────────────────────

  ipcMain.handle('sys:move-cursor', async (_, { x, y }: { x: number; y: number }) => {
    try {
      await sendInputCmd('move', `${x},${y}`)
      return { success: true, x, y }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Плавное перемещение курсора ───────────────────────────────────────────

  ipcMain.handle('sys:move-cursor-smooth', async (_, { x, y, steps = 15 }: { x: number; y: number; steps?: number }) => {
    try {
      await sendInputCmd('move_smooth', `${x},${y},${steps}`)
      return { success: true, x, y }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Клик мышью ────────────────────────────────────────────────────────────

  ipcMain.handle('sys:mouse-click', async (_, {
    x, y, button = 'left', double = false
  }: { x?: number; y?: number; button?: 'left' | 'right' | 'middle'; double?: boolean }) => {
    try {
      const xStr = x !== undefined ? String(x) : ''
      const yStr = y !== undefined ? String(y) : ''
      await sendInputCmd('click', `${xStr},${yStr},${button},${double}`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Drag & Drop ───────────────────────────────────────────────────────────

  ipcMain.handle('sys:drag', async (_, {
    x1, y1, x2, y2
  }: { x1: number; y1: number; x2: number; y2: number }) => {
    try {
      await sendInputCmd('drag', `${x1},${y1},${x2},${y2}`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Скролл ────────────────────────────────────────────────────────────────

  ipcMain.handle('sys:scroll', async (_, { direction, amount = 3 }: { direction: 'up' | 'down'; amount?: number }) => {
    try {
      const delta = direction === 'up' ? 120 * amount : -120 * amount
      await sendInputCmd('scroll', String(delta))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Напечатать текст (base64 для безопасной передачи) ────────────────────

  ipcMain.handle('sys:type-text', async (_, { text }: { text: string }) => {
    try {
      const b64 = Buffer.from(text, 'utf8').toString('base64')
      await sendInputCmd('type', b64)
      return { success: true }
    } catch (err: any) {
      // Fallback через PowerShell
      try {
        const escaped = text.replace(/'/g, "''").replace(/[{}[\]()^+%~]/g, '{$&}')
        await ps(`
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.SendKeys]::SendWait('${escaped}')
        `)
        return { success: true }
      } catch (e2: any) {
        return { success: false, error: e2.message }
      }
    }
  })

  // ── Нажать клавишу ────────────────────────────────────────────────────────

  ipcMain.handle('sys:press-key', async (_, { key }: { key: string }) => {
    try {
      const k = key.toLowerCase().trim()

      if (k === 'win+d') {
        await execAsync(
          `powershell.exe -NoProfile -NonInteractive -Command "(New-Object -ComObject Shell.Application).MinimizeAll()"`,
          { timeout: 5000, windowsHide: true }
        )
        return { success: true }
      }

      const winMap: Record<string, string> = {
        'win+e': `Start-Process explorer.exe`,
        'win+r': `$wsh = New-Object -ComObject WScript.Shell; $wsh.Run('rundll32 shell32.dll,#61')`,
        'win+l': `rundll32.exe user32.dll,LockWorkStation`,
        'win+s': `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('^{ESC}'); Start-Sleep -Milliseconds 300; $wsh.SendKeys('s')`,
        'win+i': `Start-Process ms-settings:`,
        'win+a': `$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('^{ESC}'); Start-Sleep -Milliseconds 300; $wsh.SendKeys('a')`,
      }
      if (winMap[k]) {
        await execAsync(
          `powershell.exe -NoProfile -NonInteractive -Command "${winMap[k]}"`,
          { timeout: 5000, windowsHide: true }
        )
        return { success: true }
      }

      const keyMap: Record<string, string> = {
        'enter': '{ENTER}', 'tab': '{TAB}', 'escape': '{ESC}', 'esc': '{ESC}',
        'backspace': '{BACKSPACE}', 'delete': '{DELETE}', 'del': '{DELETE}',
        'space': ' ',
        'up': '{UP}', 'down': '{DOWN}', 'left': '{LEFT}', 'right': '{RIGHT}',
        'home': '{HOME}', 'end': '{END}', 'pageup': '{PGUP}', 'pagedown': '{PGDN}',
        'f1': '{F1}', 'f2': '{F2}', 'f3': '{F3}', 'f4': '{F4}', 'f5': '{F5}',
        'f6': '{F6}', 'f7': '{F7}', 'f8': '{F8}', 'f9': '{F9}', 'f10': '{F10}',
        'f11': '{F11}', 'f12': '{F12}',
        'ctrl+c': '^c', 'ctrl+v': '^v', 'ctrl+a': '^a', 'ctrl+z': '^z', 'ctrl+y': '^y',
        'ctrl+s': '^s', 'ctrl+t': '^t', 'ctrl+w': '^w', 'ctrl+r': '^r',
        'ctrl+f': '^f', 'ctrl+n': '^n', 'ctrl+p': '^p', 'ctrl+x': '^x',
        'ctrl+shift+t': '^+t', 'ctrl+shift+n': '^+n',
        'alt+f4': '%{F4}', 'alt+tab': '%{TAB}', 'alt+f': '%f',
        'printscreen': '{PRTSC}',
      }
      const sendKey = keyMap[k] || `{${key.toUpperCase()}}`
      await ps(`
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')
      `)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Скриншот ──────────────────────────────────────────────────────────────

  ipcMain.handle('sys:screenshot', async (_, { savePath }: { savePath?: string }) => {
    try {
      const outPath = savePath || join(homedir(), 'Desktop', `screenshot_${Date.now()}.png`)
      await ps(`
        Add-Type -AssemblyName System.Windows.Forms
        Add-Type -AssemblyName System.Drawing
        $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
        $bmp.Save('${outPath.replace(/\\/g, '/')}')
        $g.Dispose(); $bmp.Dispose()
      `)
      return { success: true, path: outPath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Громкость ─────────────────────────────────────────────────────────────

  ipcMain.handle('sys:set-volume', async (_, { level }: { level: number }) => {
    try {
      const vol = Math.max(0, Math.min(100, Math.round(level)))
      await ps(`
        $vol = [Math]::Round(${vol} / 100 * 65535)
        Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public class Audio { [DllImport("winmm.dll")] public static extern int waveOutSetVolume(System.IntPtr h, uint v); }'
        [Audio]::waveOutSetVolume([System.IntPtr]::Zero, ($vol -bor ($vol -shl 16)))
      `)
      return { success: true, level: vol }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('sys:mute', async () => {
    try {
      await ps(`$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys([char]173)`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Процессы ──────────────────────────────────────────────────────────────

  ipcMain.handle('sys:get-processes', async () => {
    try {
      const { stdout } = await ps(`
        Get-Process | Where-Object {$_.MainWindowTitle -ne ''} |
        Select-Object Name, Id, MainWindowTitle, CPU |
        ConvertTo-Json -Compress
      `)
      const processes = JSON.parse(stdout.trim() || '[]')
      return { success: true, processes: Array.isArray(processes) ? processes : [processes] }
    } catch (err: any) {
      return { success: false, error: err.message, processes: [] }
    }
  })

  ipcMain.handle('sys:close-app', async (_, { name }: { name: string }) => {
    try {
      await ps(`Stop-Process -Name '${name}' -Force -ErrorAction SilentlyContinue`)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Дата/время ────────────────────────────────────────────────────────────

  ipcMain.handle('sys:get-datetime', async () => {
    const now = new Date()
    return {
      success: true,
      datetime: now.toLocaleString('ru-RU'),
      date: now.toLocaleDateString('ru-RU'),
      time: now.toLocaleTimeString('ru-RU'),
      timestamp: now.getTime()
    }
  })

  // ── Блокировка экрана ─────────────────────────────────────────────────────

  ipcMain.handle('sys:lock-screen', async () => {
    try {
      await execAsync('rundll32.exe user32.dll,LockWorkStation', { windowsHide: true })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
