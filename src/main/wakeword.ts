/**
 * Wake Word & Background Voice Recognition
 *
 * Использует Windows Speech Recognition (.NET System.Speech)
 * Работает в фоне как отдельный PowerShell процесс.
 *
 * Pipeline:
 *   Microphone → Windows SR → Wake Word Detection → Command Mode → IPC → AI
 */

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFileSync } from 'fs'

// ── State ─────────────────────────────────────────────────────────────────────

let srProcess: ChildProcess | null = null
let isListening = false
let currentWakeWords: string[] = ['ассистент', 'assistant', 'джарвис', 'jarvis']
let mainWindowRef: BrowserWindow | null = null

// ── PowerShell Script ─────────────────────────────────────────────────────────

function buildSRScript(wakeWords: string[], microphoneName?: string): string {
  const wakeWordList = wakeWords.map(w => `"${w}"`).join(', ')

  return `
Add-Type -AssemblyName System.Speech

$recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine
${microphoneName ? `$recognizer.SetInputToDefaultAudioDevice() # Using default as fallback for ${microphoneName}` : `$recognizer.SetInputToDefaultAudioDevice()`}

# Режим: ожидание wake word или команда
$mode = "wake"  # "wake" или "command"
$wakeWords = @(${wakeWordList})

# Грамматика для wake words (точное распознавание)
$wakeChoices = New-Object System.Speech.Recognition.Choices
foreach ($w in $wakeWords) {
    $wakeChoices.Add($w)
}
$wakeBuilder = New-Object System.Speech.Recognition.GrammarBuilder
$wakeBuilder.Append($wakeChoices)
$wakeGrammar = New-Object System.Speech.Recognition.Grammar($wakeBuilder)
$wakeGrammar.Name = "WakeGrammar"

# Грамматика для команд (свободная речь)
$dictation = New-Object System.Speech.Recognition.DictationGrammar
$dictation.Name = "DictationGrammar"

# Загружаем wake grammar
$recognizer.LoadGrammar($wakeGrammar)

$recognizer.BabbleTimeout = [TimeSpan]::FromSeconds(0)
$recognizer.InitialSilenceTimeout = [TimeSpan]::FromSeconds(5)
$recognizer.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(500)

Write-Output "STATUS:READY"
[Console]::Out.Flush()

while ($true) {
    try {
        $result = $recognizer.Recognize([TimeSpan]::FromSeconds(10))

        if ($result -ne $null -and $result.Confidence -gt 0.4) {
            $text = $result.Text.ToLower().Trim()

            if ($mode -eq "wake") {
                # Проверяем wake word
                $isWake = $false
                foreach ($w in $wakeWords) {
                    if ($text -like "*$w*") {
                        $isWake = $true
                        break
                    }
                }

                if ($isWake) {
                    Write-Output "WAKE_DETECTED:$text"
                    [Console]::Out.Flush()

                    # Переключаемся в режим команды
                    $mode = "command"
                    $recognizer.UnloadAllGrammars()
                    $recognizer.LoadGrammar($dictation)

                    Write-Output "STATUS:LISTENING"
                    [Console]::Out.Flush()
                }
            } elseif ($mode -eq "command") {
                # Получили команду
                Write-Output "COMMAND:$text"
                [Console]::Out.Flush()

                # Возвращаемся в режим ожидания wake word
                $mode = "wake"
                $recognizer.UnloadAllGrammars()
                $recognizer.LoadGrammar($wakeGrammar)

                Write-Output "STATUS:WAITING"
                [Console]::Out.Flush()
            }
        }
    } catch [System.OperationCanceledException] {
        break
    } catch {
        # Timeout или ошибка — продолжаем
        if ($mode -eq "command") {
            # Таймаут в режиме команды — возвращаемся к wake word
            $mode = "wake"
            $recognizer.UnloadAllGrammars()
            $recognizer.LoadGrammar($wakeGrammar)
            Write-Output "STATUS:WAITING"
            [Console]::Out.Flush()
        }
    }
}

$recognizer.Dispose()
Write-Output "STATUS:STOPPED"
`
}

// ── Start/Stop ────────────────────────────────────────────────────────────────

function startSR(wakeWords: string[], mainWindow: BrowserWindow, microphoneName?: string): void {
  if (srProcess) stopSR()

  mainWindowRef = mainWindow
  currentWakeWords = wakeWords.length > 0 ? wakeWords : ['ассистент', 'assistant']

  const script = buildSRScript(currentWakeWords, microphoneName)

  // Записываем скрипт во временный файл (избегаем проблем с кавычками)
  const scriptPath = join(tmpdir(), 'ai-assistant-sr.ps1')
  writeFileSync(scriptPath, script, 'utf8')

  srProcess = spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath
  ], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  isListening = true

  // Обрабатываем вывод
  srProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(l => l.trim())
    for (const line of lines) {
      handleSROutput(line.trim())
    }
  })

  srProcess.stderr?.on('data', (data: Buffer) => {
    console.error('[SR Error]', data.toString())
  })

  srProcess.on('close', (code) => {
    console.log(`[SR] Process exited with code ${code}`)
    isListening = false
    srProcess = null
    // Уведомляем renderer только если окно ещё живо
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      try {
        mainWindowRef.webContents.send('voice:sr-status', { status: 'stopped' })
      } catch {}
    }
  })

  srProcess.on('error', (err) => {
    console.error('[SR] Failed to start:', err)
    isListening = false
    srProcess = null
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      try {
        mainWindowRef.webContents.send('voice:sr-status', { status: 'error', error: err.message })
      } catch {}
    }
  })
}

function stopSR(): void {
  if (srProcess) {
    srProcess.kill()
    srProcess = null
  }
  isListening = false
}

function handleSROutput(line: string): void {
  if (!mainWindowRef) return

  // Guard: проверяем что окно не уничтожено перед отправкой IPC
  if (mainWindowRef.isDestroyed()) {
    mainWindowRef = null
    return
  }

  try {
    if (line.startsWith('STATUS:')) {
      const status = line.replace('STATUS:', '').toLowerCase()
      mainWindowRef.webContents.send('voice:sr-status', { status })
      console.log('[SR Status]', status)
    } else if (line.startsWith('WAKE_DETECTED:')) {
      const text = line.replace('WAKE_DETECTED:', '')
      mainWindowRef.webContents.send('voice:wake-detected', { text })
      console.log('[SR Wake]', text)
      // Показываем окно при обнаружении wake word
      if (!mainWindowRef.isDestroyed() && !mainWindowRef.isVisible()) {
        mainWindowRef.show()
        mainWindowRef.focus()
      }
    } else if (line.startsWith('COMMAND:')) {
      const command = line.replace('COMMAND:', '').trim()
      if (command) {
        mainWindowRef.webContents.send('voice:command', { command })
        console.log('[SR Command]', command)
      }
    }
  } catch (err) {
    // Окно могло быть уничтожено между проверкой и отправкой
    console.warn('[SR] Failed to send IPC (window destroyed?):', err)
    mainWindowRef = null
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupWakeWordHandlers(mainWindow: BrowserWindow): void {
  mainWindowRef = mainWindow

  ipcMain.handle('voice:start-background', (_, { wakeWords, microphoneName }: { wakeWords: string[]; microphoneName?: string }) => {
    try {
      startSR(wakeWords, mainWindow, microphoneName)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('voice:stop-background', () => {
    stopSR()
    return { success: true }
  })

  ipcMain.handle('voice:is-listening', () => ({
    isListening,
    wakeWords: currentWakeWords
  }))

  ipcMain.handle('voice:update-wake-words', (_, { wakeWords }: { wakeWords: string[] }) => {
    currentWakeWords = wakeWords
    if (isListening) {
      // Перезапускаем с новыми wake words
      startSR(wakeWords, mainWindow)
    }
    return { success: true }
  })
}

export { stopSR }
