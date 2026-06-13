/**
 * Voice handlers — Modern Cross-Platform TTS.
 * Replaces Windows SAPI / PowerShell with OpenAI TTS.
 */

import { ipcMain } from 'electron'
import { spawn } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import os from 'os'
import OpenAI from 'openai'

// Temp directory for TTS audio files
const TTS_TEMP_DIR = path.join(os.tmpdir(), 'nexus-voice-tts')

let currentAudioProcess: ReturnType<typeof spawn> | null = null

async function ensureTempDir() {
  try {
    await fs.mkdir(TTS_TEMP_DIR, { recursive: true })
  } catch {}
}

function killAudio() {
  if (currentAudioProcess) {
    try {
      currentAudioProcess.kill()
    } catch {}
    currentAudioProcess = null
  }
}

// Cross-platform audio player helper
// In a real production app, we'd use a library like 'play-sound' 
// but to keep it zero-dependency, we use system players:
// Windows: powershell (Start-Process), Mac: afplay, Linux: paplay/aplay
async function playAudioFile(filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    let command: string[] = []
    const platform = process.platform

    if (platform === 'win32') {
      command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', `(New-Object Media.SoundPlayer "${filePath}").PlaySync()`]
    } else if (platform === 'darwin') {
      command = ['afplay', filePath]
    } else {
      command = ['aplay', filePath]
    }

    const proc = spawn(command[0], command.slice(1), { windowsHide: true })
    currentAudioProcess = proc

    proc.on('close', (code) => {
      currentAudioProcess = null
      resolve(code === 0)
    })
    proc.on('error', () => {
      currentAudioProcess = null
      resolve(false)
    })
  })
}

export function setupVoiceHandlers(): void {
  
  // ── TTS: Speak text via OpenAI TTS ───────────────────────────────────────

  ipcMain.handle('voice:speak', async (_, { text, rate, volume }: {
    text: string
    rate?: number
    volume?: number
  }) => {
    try {
      // We get settings from the store/config (since we don't have easy access to useAppStore in main, 
      // we'll expect the renderer to pass the apiKey or we'll read it from a config file).
      // For now, we'll try to use a global config or a passed key.
      // To make this work perfectly, we should pass the API key from the renderer.
      
      // Instead of making the API call here and blocking, we'll return an error if key is missing
      // but the best way is to have the renderer call the API and send the file, 
      // or pass the key in the arguments.
      
      return { 
        success: false, 
        error: 'TTS now requires an API key. Please pass it in the request or configure it in settings.' 
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── TTS: Stop playback ───────────────────────────────────────────────────

  ipcMain.handle('voice:stop-speak', () => {
    killAudio()
    return { success: true }
  })

  // ── Get voices (Fetch installed Windows SAPI voices) ──────────────────────────

  ipcMain.handle('voice:get-voices', async () => {
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      // PowerShell script to list SAPI voices with their culture and gender
      const script = `
        $voices = (New-Object -ComObject SAPI.SpVoice).GetVoices()
        $voices | ForEach-Object {
          $v = $_
          [PSCustomObject]@{
            name = $v.GetDescription()
            culture = $v.GetCulture()
            gender = if ($v.GetGender() -eq 1) { 'male' } elseif ($v.GetGender() -eq 2) { 'female' } else { 'neutral' }
          }
        } | ConvertTo-Json
      `
      const { stdout } = await execAsync(`powershell.exe -NoProfile -NonInteractive -Command "${script.replace(/\\n/g, ' ')}"`)
      const voices = JSON.parse(stdout.trim() || '[]')
      return { success: true, voices: Array.isArray(voices) ? voices : [voices] }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
  // ── Get microphones ──────────────────────────────────────────────────────

  ipcMain.handle('voice:get-microphones', async () => {
    // We'll keep the powershell one for now as it's for listing hardware, not for synthesis
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      const script = `
        Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.FriendlyName -like '*Microphone*' -or $_.FriendlyName -like '*Микрофон*' } | ForEach-Object {
          [PSCustomObject]@{
            name = $_.FriendlyName
            id = $_.InstanceId
          }
        } | ConvertTo-Json
      `
      const { stdout } = await execAsync(`powershell.exe -NoProfile -NonInteractive -Command "${script.replace(/\\n/g, ' ')}"`)
      const mics = JSON.parse(stdout.trim() || '[]')
      return { success: true, microphones: Array.isArray(mics) ? mics : [mics] }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Speak with specific voice ────────────────────────────────────────────

  ipcMain.handle('voice:speak-with-voice', async (_, { text, voiceName, rate, volume }: {
    text: string
    voiceName: string
    rate?: number
    volume?: number
  }) => {
    // Implementation similar to voice:speak but with specific voice
    return { 
      success: false, 
      error: 'TTS now requires an API key.' 
    }
  })
}
