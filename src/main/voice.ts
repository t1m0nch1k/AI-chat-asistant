/**
 * Voice handlers — TTS через Windows SAPI (PowerShell).
 * STT реализован на стороне renderer через Web Speech API.
 */

import { ipcMain } from 'electron'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Активный процесс TTS (для прерывания)
let ttsProcess: ReturnType<typeof spawn> | null = null

export function setupVoiceHandlers(): void {

  // ── TTS: озвучить текст через Windows SAPI ────────────────────────────────

  ipcMain.handle('voice:speak', async (_, { text, rate, volume }: {
    text: string
    rate?: number   // -10 to 10, default 0
    volume?: number // 0 to 100, default 100
  }) => {
    try {
      // Останавливаем предыдущее воспроизведение
      if (ttsProcess) {
        ttsProcess.kill()
        ttsProcess = null
      }

      // Экранируем текст для PowerShell
      const escaped = text
        .replace(/'/g, "''")
        .replace(/"/g, '`"')
        .slice(0, 2000) // Ограничиваем длину

      const rateVal = rate ?? 0
      const volVal = volume ?? 100

      const script = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.Rate = ${rateVal}
        $synth.Volume = ${volVal}
        $synth.Speak('${escaped}')
        $synth.Dispose()
      `

      ttsProcess = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true
      })

      return new Promise<{ success: boolean }>((resolve) => {
        ttsProcess!.on('close', (code) => {
          ttsProcess = null
          resolve({ success: code === 0 })
        })
        ttsProcess!.on('error', () => {
          ttsProcess = null
          resolve({ success: false })
        })
      })
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── TTS: остановить воспроизведение ──────────────────────────────────────

  ipcMain.handle('voice:stop-speak', () => {
    if (ttsProcess) {
      ttsProcess.kill()
      ttsProcess = null
    }
    // Дополнительно убиваем все powershell процессы с SAPI
    exec('taskkill /F /IM powershell.exe /FI "WINDOWTITLE eq *Speech*"', () => {})
    return { success: true }
  })

  // ── Получить список голосов Windows ──────────────────────────────────────

  ipcMain.handle('voice:get-voices', async () => {
    try {
      const script = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $voices = $synth.GetInstalledVoices() | ForEach-Object {
          $info = $_.VoiceInfo
          [PSCustomObject]@{
            name = $info.Name
            culture = $info.Culture.Name
            gender = $info.Gender.ToString()
          }
        }
        $synth.Dispose()
        $voices | ConvertTo-Json
      `
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -NonInteractive -Command "${script.replace(/\n/g, ' ')}"`,
        { timeout: 5000 }
      )
      const voices = JSON.parse(stdout.trim() || '[]')
      return { success: true, voices: Array.isArray(voices) ? voices : [voices] }
    } catch {
      return { success: true, voices: [] }
    }
  })

  // ── Получить список доступных микрофонов ──────────────────────────────────

  ipcMain.handle('voice:get-microphones', async () => {
    try {
      const script = `
        Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.FriendlyName -like '*Microphone*' -or $_.FriendlyName -like '*Микрофон*' } | ForEach-Object {
          [PSCustomObject]@{
            name = $_.FriendlyName
            id = $_.InstanceId
          }
        } | ConvertTo-Json
      `
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -NonInteractive -Command "${script.replace(/\n/g, ' ')}"`,
        { timeout: 5000 }
      )
      const mics = JSON.parse(stdout.trim() || '[]')
      return { success: true, microphones: Array.isArray(mics) ? mics : [mics] }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Установить голос ──────────────────────────────────────────────────────

  ipcMain.handle('voice:speak-with-voice', async (_, { text, voiceName, rate, volume }: {
    text: string
    voiceName: string
    rate?: number
    volume?: number
  }) => {
    try {
      if (ttsProcess) {
        ttsProcess.kill()
        ttsProcess = null
      }

      const escaped = text.replace(/'/g, "''").slice(0, 2000)
      const rateVal = rate ?? 0
      const volVal = volume ?? 100

      const script = `
        Add-Type -AssemblyName System.Speech
        $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
        $synth.SelectVoice('${voiceName}')
        $synth.Rate = ${rateVal}
        $synth.Volume = ${volVal}
        $synth.Speak('${escaped}')
        $synth.Dispose()
      `

      ttsProcess = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        windowsHide: true
      })

      return new Promise<{ success: boolean }>((resolve) => {
        ttsProcess!.on('close', (code) => {
          ttsProcess = null
          resolve({ success: code === 0 })
        })
        ttsProcess!.on('error', () => {
          ttsProcess = null
          resolve({ success: false })
        })
      })
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
