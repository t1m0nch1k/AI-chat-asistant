/**
 * Screen Analysis — скриншот + анализ через multimodal LLM.
 *
 * Провайдеры Vision:
 *  - Qwen2.5-VL (DashScope) — основной, бесплатный tier
 *  - GPT-4o (OpenAI)
 *  - Claude 3.5 (Anthropic)
 *  - Gemini 1.5 (Google)
 */

import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readFileSync, unlinkSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

// ── Screenshot ────────────────────────────────────────────────────────────────

// Возвращает base64 PNG + реальные размеры захвата (в физических пикселях).
async function takeScreenshot(region?: { x: number; y: number; width: number; height: number }): Promise<{ base64: string; width: number; height: number }> {
  showOverlay()
  try {
    const outPath = join(tmpdir(), `ai-screenshot-${Date.now()}.png`)
    const psPath = outPath.replace(/\\/g, '/')
    const dimPath = join(tmpdir(), `ai-ss-dim-${Date.now()}.txt`).replace(/\\/g, '/')

    // SetProcessDPIAware() — критично: без него на масштабе 125/150% скриншот
    // захватывается в логических пикселях и не совпадает с координатами кликов.
    const dpiHeader = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $sig = '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
      $t = Add-Type -MemberDefinition $sig -Name DPI -Namespace Win32 -PassThru
      try { $t::SetProcessDPIAware() | Out-Null } catch {}
    `

    const script = region ? `
      ${dpiHeader}
      $bmp = New-Object System.Drawing.Bitmap(${region.width}, ${region.height})
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen(${region.x}, ${region.y}, 0, 0, (New-Object System.Drawing.Size(${region.width}, ${region.height})))
      $bmp.Save('${psPath}')
      "$($bmp.Width),$($bmp.Height)" | Out-File -FilePath '${dimPath}' -Encoding ascii
      $g.Dispose(); $bmp.Dispose()
    ` : `
      ${dpiHeader}
      # Виртуальный экран — покрывает все мониторы
      $vs = [System.Windows.Forms.SystemInformation]::VirtualScreen
      $bmp = New-Object System.Drawing.Bitmap($vs.Width, $vs.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($vs.X, $vs.Y, 0, 0, (New-Object System.Drawing.Size($vs.Width, $vs.Height)))
      $bmp.Save('${psPath}')
      "$($bmp.Width),$($bmp.Height)" | Out-File -FilePath '${dimPath}' -Encoding ascii
      $g.Dispose(); $bmp.Dispose()
    `

    const scriptPath = join(tmpdir(), `ai-ss-${Date.now()}.ps1`)
    writeFileSync(scriptPath, script, 'utf8')
    try {
      await execAsync(
        `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`,
        { timeout: 15000, windowsHide: true }
      )
    } finally {
      try { unlinkSync(scriptPath) } catch {}
    }

    if (!existsSync(outPath)) throw new Error('Screenshot file was not created')
    const base64 = readFileSync(outPath).toString('base64')

    // Читаем реальные размеры захвата
    let width = region?.width ?? 0
    let height = region?.height ?? 0
    try {
      const dimRaw = readFileSync(dimPath.replace(/\//g, '\\'), 'utf8').trim()
      const [w, h] = dimRaw.split(',').map(Number)
      if (w && h) { width = w; height = h }
    } catch {}
    try { unlinkSync(outPath) } catch {}
    try { unlinkSync(dimPath.replace(/\//g, '\\')) } catch {}

    return { base64, width, height }
  } finally {
    hideOverlay()
  }
}

// ── Vision Providers ──────────────────────────────────────────────────────────

// Универсальный OpenAI-compatible vision (OpenAI, Qwen, DeepSeek-VL, etc.)
async function analyzeOpenAICompat(
  base64Image: string,
  prompt: string,
  apiKey: string,
  model: string,
  baseURL: string,
  extraHeaders?: Record<string, string>
): Promise<string> {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      ...extraHeaders
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: 'high'
            }
          },
          { type: 'text', text: prompt }
        ]
      }]
    }),
    signal: AbortSignal.timeout(45000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Vision API error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.choices?.[0]?.message?.content ?? ''
}

async function analyzeWithClaude(
  base64Image: string,
  prompt: string,
  apiKey: string,
  model = 'claude-3-5-sonnet-20241022'
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Image } },
          { type: 'text', text: prompt }
        ]
      }]
    }),
    signal: AbortSignal.timeout(45000)
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Claude Vision error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.content?.[0]?.text ?? ''
}

async function analyzeWithGemini(
  base64Image: string,
  prompt: string,
  apiKey: string,
  model = 'gemini-1.5-flash'
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/png', data: base64Image } },
          { text: prompt }
        ]}],
        generationConfig: { maxOutputTokens: 1500 }
      }),
      signal: AbortSignal.timeout(45000)
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini Vision error ${response.status}: ${err}`)
  }

  const data = await response.json() as any
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ── Ollama Vision (локальный) ─────────────────────────────────────────────────

const OLLAMA_VISION_MODELS = ['llava', 'moondream', 'minicpm-v', 'bakllava', 'qwen2-vl', 'qwen2.5vl', 'qwen3-vl']

async function analyzeWithOllama(
  base64Image: string,
  prompt: string,
  baseUrl: string,
  model: string
): Promise<string> {
  let models: string[] = []

  // Сначала проверяем что Ollama запущена и получаем список моделей
  try {
    const check = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
    if (!check.ok) throw new Error('not running')

    const tags = await check.json() as any
    models = (tags.models || []).map((m: any) => m.name as string)
    const modelBase = model.split(':')[0]
    const hasModel = models.some(m => m.startsWith(modelBase))
    if (!hasModel) {
      throw new Error(`Model "${model}" not found in Ollama. Run: ollama pull ${model}\nAvailable: ${models.slice(0, 5).join(', ')}`)
    }
  } catch (e: any) {
    if (e.message.includes('not found') || e.message.includes('ollama pull')) throw e
    throw new Error(`Ollama is not running at ${baseUrl}. Start it with: ollama serve`)
  }

  // Пробуем заданную модель, при ошибке vision — fallback на другую vision-модель
  const triedModels = new Set<string>()

  const tryModel = async (m: string): Promise<string> => {
    triedModels.add(m)
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Ollama ожидает массив images (а не одиночное поле image)
      body: JSON.stringify({ model: m, prompt, images: [base64Image], stream: false }),
      signal: AbortSignal.timeout(120000)
    })

    if (!response.ok) {
      const err = await response.text()
      if (err.includes('does not support image input')) {
        throw new Error(`Model "${m}" does not support images`)
      }
      throw new Error(`Ollama Vision error ${response.status}: ${err}`)
    }

    const data = await response.json() as any
    if (data.error) {
      if (data.error.includes('does not support image input')) {
        throw new Error(`Model "${m}" does not support images`)
      }
      throw new Error(`Ollama Vision error: ${data.error}`)
    }
    return data.response ?? ''
  }

  // Auto-fallback: если модель не поддерживает изображения, пробуем другую vision-модель
  const fallbackCandidates = models.filter(m =>
    OLLAMA_VISION_MODELS.some(vm => m.startsWith(vm))
  )

  for (const candidate of [model, ...fallbackCandidates]) {
    if (triedModels.has(candidate)) continue
    try {
      return await tryModel(candidate)
    } catch (e: any) {
      if (!e.message.includes('does not support images')) throw e
      // Продолжаем со следующей кандидатом
    }
  }

  throw new Error(
    `Model "${model}" does not support vision. Install a vision model:\n` +
    `  ollama pull llava\n  ollama pull moondream`
  )
}

// ── Provider Router ───────────────────────────────────────────────────────────

type VisionProvider = 'qwen' | 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'deepseek' | 'groq' | 'ollama' | 'nvidia' | 'huggingface'

export async function analyzeScreen(
  base64Image: string,
  prompt: string,
  provider: VisionProvider,
  apiKey: string,
  model?: string,
  ollamaBaseUrl?: string
): Promise<string> {
  switch (provider) {
    case 'qwen':
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'qwen-vl-max',
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
      )

    case 'openai':
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'gpt-4o',
        'https://api.openai.com/v1'
      )

    case 'deepseek':
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'deepseek-vl2',
        'https://api.deepseek.com/v1'
      )

    case 'openrouter':
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'qwen/qwen2.5-vl-72b-instruct',
        'https://openrouter.ai/api/v1',
        { 'HTTP-Referer': 'https://ai-assistant.app', 'X-Title': 'AI Assistant' }
      )

    case 'nvidia':
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'nvidia/llama-3.1-nemotron-70b-instruct',
        'https://integrate.api.nvidia.com/v1'
      )

    case 'huggingface':
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'meta-llama/Llama-3.2-11B-Vision-Instruct',
        'https://api-inference.huggingface.co/v1'
      )

    case 'ollama':
      return analyzeWithOllama(
        base64Image, prompt,
        ollamaBaseUrl || 'http://localhost:11434',
        model || 'llava'
      )

    case 'anthropic':
      return analyzeWithClaude(base64Image, prompt, apiKey, model)

    case 'gemini':
      return analyzeWithGemini(base64Image, prompt, apiKey, model)

    default:
      return analyzeOpenAICompat(
        base64Image, prompt, apiKey,
        model || 'qwen-vl-max',
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
      )
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

export function setupScreenAnalysisHandlers(): void {

  ipcMain.handle('screen:screenshot', async (_, { region }: { region?: any }) => {
    try {
      const { base64, width, height } = await takeScreenshot(region)
      return { success: true, base64, width, height, dataUrl: `data:image/png;base64,${base64}` }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('screen:analyze', async (_, {
    prompt, provider, apiKey, model, region, ollamaBaseUrl
  }: {
    prompt: string
    provider: VisionProvider
    apiKey: string
    model?: string
    region?: any
    ollamaBaseUrl?: string
  }) => {
    try {
      const { base64, width, height } = await takeScreenshot(region)
      const result = await analyzeScreen(base64, prompt, provider, apiKey, model, ollamaBaseUrl)
      return { success: true, result, base64, width, height }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('screen:find-element', async (_, {
    description, apiKey, provider = 'qwen', model, ollamaBaseUrl
  }: {
    description: string
    apiKey: string
    provider?: VisionProvider
    model?: string
    ollamaBaseUrl?: string
  }) => {
    try {
      const { base64, width, height } = await takeScreenshot()

      const prompt = `Look at this screenshot carefully. The screen resolution is ${width}x${height} pixels.
Find the UI element: "${description}".
Return coordinates as ABSOLUTE pixel values within the ${width}x${height} image (x from 0 to ${width}, y from 0 to ${height}).
Return ONLY valid JSON, no other text:
{"x": number, "y": number, "found": true, "description": "brief description of what you found"}
or if not found:
{"found": false, "description": "reason why not found"}`

      const result = await analyzeScreen(base64, prompt, provider as VisionProvider, apiKey, model, ollamaBaseUrl)

      const jsonMatch = result.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          return { success: true, width, height, ...parsed }
        } catch {}
      }

      return { success: false, found: false, error: 'Could not parse coordinates from response' }
    } catch (err: any) {
      return { success: false, found: false, error: err.message }
    }
  })

  // ── Analyze screen returning structured element list ────────────────────────

  ipcMain.handle('screen:analyze-structured', async (_, {
    apiKey, provider = 'qwen', model, region, ollamaBaseUrl
  }: {
    apiKey: string
    provider?: VisionProvider
    model?: string
    region?: any
    ollamaBaseUrl?: string
  }) => {
    try {
      const { base64, width, height } = await takeScreenshot(region)

      const prompt = `You are a computer vision system analyzing a Windows desktop screenshot.
The screen resolution is ${width}x${height} pixels. All coordinates MUST be absolute pixels within this image.
Return a JSON object listing ALL visible UI elements and text.

{
  "elements": [
    {"type": "button|input|menu|link|icon|text|image|dialog|tab|checkbox|radio|dropdown", "text": "visible text", "x": center_x, "y": center_y, "width": approximate_width, "height": approximate_height}
  ],
  "textBlocks": [
    {"text": "text content", "x": x, "y": y}
  ],
  "description": "brief 1-2 sentence summary of what is on screen",
  "resolution": {"width": ${width}, "height": ${height}}
}

IMPORTANT: Return ONLY valid JSON, no other text. Be thorough in listing elements.`

      const result = await analyzeScreen(base64, prompt, provider as VisionProvider, apiKey, model, ollamaBaseUrl)

      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          // Гарантируем наличие реального разрешения
          if (!parsed.resolution) parsed.resolution = { width, height }
          return { success: true, analysis: parsed, width, height }
        } catch {}
      }

      return { success: true, analysis: { elements: [], description: result, resolution: { width, height } }, width, height }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
