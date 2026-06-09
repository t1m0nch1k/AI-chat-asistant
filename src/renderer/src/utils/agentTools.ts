/**
 * Agent tool definitions and system prompt builder.
 */

export interface AgentToolCall {
  name: string
  args: Record<string, unknown>
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

export const AGENT_TOOLS = [
  // Screen Analysis (Vision)
  {
    name: 'analyze_screen',
    description: 'Take a screenshot and analyze it with AI vision. Use to understand what is currently on screen.',
    parameters: {
      prompt: 'string — what to look for or analyze (e.g. "describe what is on screen", "find the search button")',
      region: 'object (optional) — {x, y, width, height} to capture specific area'
    }
  },
  {
    name: 'find_element',
    description: 'Find a UI element on screen and get its coordinates. Use before clicking unknown elements.',
    parameters: {
      description: 'string — describe the element to find (e.g. "YouTube search bar", "Play button", "Close button")'
    }
  },
  // Web Search
  {
    name: 'search_web',
    description: 'Search the internet using DuckDuckGo. Returns titles, URLs and snippets.',
    parameters: { query: 'string — search query' }
  },
  {
    name: 'search_youtube',
    description: 'Search YouTube for videos. Returns video titles and URLs.',
    parameters: { query: 'string — search query' }
  },
  {
    name: 'fetch_page',
    description: 'Read the text content of a webpage by URL',
    parameters: { url: 'string — full URL of the page to read' }
  },
  // File System
  {
    name: 'create_file',
    description: 'Create or overwrite a file with given content',
    parameters: { path: 'string — absolute file path', content: 'string — file content' }
  },
  {
    name: 'read_file',
    description: 'Read the content of a file',
    parameters: { path: 'string — absolute file path' }
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory',
    parameters: { path: 'string — absolute directory path' }
  },
  {
    name: 'search_files',
    description: 'Search for files matching a pattern in a directory',
    parameters: { path: 'string — root directory', pattern: 'string — filename pattern' }
  },
  {
    name: 'run_command',
    description: 'Run a PowerShell or CMD command and return output. Full shell access.',
    parameters: {
      command: 'string — command to execute',
      shell: 'string (optional) — "powershell" (default) or "cmd"',
      cwd: 'string (optional) — working directory'
    }
  },
  // Browser & Web
  {
    name: 'open_url',
    description: 'Open a URL in the default browser. Use for YouTube, Google, any website.',
    parameters: { url: 'string — full URL or domain (e.g. youtube.com, https://google.com)' }
  },
  // Apps
  {
    name: 'launch_app',
    description: 'Launch an application by name or path (e.g. notepad, calc, chrome)',
    parameters: { app: 'string — app name or path', args: 'string (optional) — arguments' }
  },
  {
    name: 'close_app',
    description: 'Close a running application by process name',
    parameters: { name: 'string — process name (e.g. notepad, chrome)' }
  },
  // Mouse
  {
    name: 'move_cursor',
    description: 'Move the mouse cursor instantly to absolute screen coordinates',
    parameters: { x: 'number — X coordinate', y: 'number — Y coordinate' }
  },
  {
    name: 'move_cursor_smooth',
    description: 'Move the mouse cursor smoothly (animated) to coordinates. Use for drag preparation.',
    parameters: { x: 'number — X coordinate', y: 'number — Y coordinate', steps: 'number (optional) — smoothness steps, default 15' }
  },
  {
    name: 'drag',
    description: 'Click and drag from one point to another (drag & drop)',
    parameters: { x1: 'number — start X', y1: 'number — start Y', x2: 'number — end X', y2: 'number — end Y' }
  },
  {
    name: 'mouse_click',
    description: 'Click the mouse at current or specified position',
    parameters: {
      x: 'number (optional) — X coordinate',
      y: 'number (optional) — Y coordinate',
      button: 'string (optional) — left|right|middle, default left',
      double: 'boolean (optional) — double click'
    }
  },
  {
    name: 'scroll',
    description: 'Scroll the mouse wheel up or down',
    parameters: { direction: 'string — up|down', amount: 'number (optional) — scroll steps, default 3' }
  },
  // Keyboard
  {
    name: 'type_text',
    description: 'Type text using the keyboard (simulates keystrokes)',
    parameters: { text: 'string — text to type' }
  },
  {
    name: 'press_key',
    description: 'Press a keyboard key or shortcut',
    parameters: { key: 'string — key name: enter, tab, escape, ctrl+c, ctrl+v, f5, etc.' }
  },
  // System
  {
    name: 'screenshot',
    description: 'Take a screenshot of the entire screen and save it',
    parameters: { savePath: 'string (optional) — where to save, defaults to Desktop' }
  },
  {
    name: 'get_datetime',
    description: 'Get the current date and time',
    parameters: {}
  },
  {
    name: 'set_volume',
    description: 'Set system volume level',
    parameters: { level: 'number — 0 to 100' }
  },
  {
    name: 'mute',
    description: 'Toggle mute/unmute system audio',
    parameters: { mute: 'boolean' }
  },
  {
    name: 'lock_screen',
    description: 'Lock the Windows screen',
    parameters: {}
  },
  {
    name: 'get_processes',
    description: 'Get list of running applications with windows',
    parameters: {}
  },
  // Scheduler
  {
    name: 'set_alarm',
    description: 'Set an alarm at a specific time. Use for "поставь будильник", "разбуди меня".',
    parameters: {
      title: 'string — alarm name (e.g. "Подъём", "Встреча")',
      time: 'string — time in HH:MM format (e.g. "08:00", "14:30")',
      date: 'string (optional) — date YYYY-MM-DD, default today/tomorrow',
      message: 'string (optional) — additional message',
      repeat: 'string (optional) — "none" | "daily" | "weekly"'
    }
  },
  {
    name: 'set_timer',
    description: 'Start a countdown timer. Use for "поставь таймер на 10 минут", "засеки время".',
    parameters: {
      title: 'string — timer name',
      duration_seconds: 'number — total seconds (e.g. 600 for 10 minutes)',
      message: 'string (optional) — message when timer fires',
      autostart: 'boolean (optional) — start immediately, default true'
    }
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder at a specific time. Use for "напомни мне", "не дай забыть".',
    parameters: {
      title: 'string — what to remind',
      time: 'string — HH:MM',
      date: 'string (optional) — YYYY-MM-DD, default today',
      message: 'string (optional)',
      repeat: 'string (optional) — "none" | "daily" | "weekly"'
    }
  },
  {
    name: 'create_event',
    description: 'Create a calendar event. Use for "запланируй встречу", "добавь событие".',
    parameters: {
      title: 'string — event name',
      date: 'string — YYYY-MM-DD',
      time: 'string — HH:MM',
      message: 'string (optional) — event description'
    }
  },
  {
    name: 'list_schedule',
    description: 'Show all upcoming alarms, timers, reminders and events.',
    parameters: {}
  }
]

// ── System Prompt Builder ─────────────────────────────────────────────────────

export function buildAgentSystemPrompt(
  basePrompt: string,
  userPaths?: { desktop: string; documents: string; homedir: string },
  knowledge?: Array<{ key: string; value: string; category: string; description?: string; id: string }>
): string {
  const desktop = userPaths?.desktop || 'C:\\Users\\User\\Desktop'
  const documents = userPaths?.documents || 'C:\\Users\\User\\Documents'
  const homedir = userPaths?.homedir || 'C:\\Users\\User'

  const toolsList = AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}`).join('\n')

  // Форматируем базу знаний для промпта
  let knowledgeSection = ''
  if (knowledge && knowledge.length > 0) {
    const byCategory: Record<string, typeof knowledge> = {}
    for (const e of knowledge) {
      if (!byCategory[e.category]) byCategory[e.category] = []
      byCategory[e.category].push(e)
    }
    knowledgeSection = '\nPERSONAL KNOWLEDGE (learned from user — use this first):\n'
    for (const [cat, items] of Object.entries(byCategory)) {
      for (const item of items) {
        knowledgeSection += `  [${item.category}] "${item.key}" → ${item.value}`
        if (item.description) knowledgeSection += ` (${item.description})`
        knowledgeSection += '\n'
      }
    }
    knowledgeSection += '\n'
  }

  return `${basePrompt}

You are an AI Agent controlling a Windows computer. You understand Russian and English equally well.

To perform an action, output a tool call block EXACTLY like this:
\`\`\`tool_call
{"name": "tool_name", "args": {"param": "value"}}
\`\`\`

RULES:
- Always write a short explanation BEFORE the tool_call block
- Use ONLY the \`\`\`tool_call\`\`\` format
- One tool call per response
- After tool result, continue naturally

AVAILABLE TOOLS:
${toolsList}

USER PATHS (use exact paths, never %USERNAME%):
- Desktop: ${desktop}
- Documents: ${documents}
- Home: ${homedir}

KNOWN RUSSIAN/CIS WEBSITES (use these URLs directly):
- госуслуги / gosuslugi → https://gosuslugi.ru
- вконтакте / вк / vk → https://vk.com
- одноклассники / ok → https://ok.ru
- яндекс / yandex → https://yandex.ru
- яндекс почта / yandex mail → https://mail.yandex.ru
- яндекс карты / yandex maps → https://maps.yandex.ru
- яндекс музыка / yandex music → https://music.yandex.ru
- яндекс диск / yandex disk → https://disk.yandex.ru
- яндекс маркет / yandex market → https://market.yandex.ru
- mail.ru / майл → https://mail.ru
- авито / avito → https://avito.ru
- озон / ozon → https://ozon.ru
- вайлдберриз / wildberries / wb → https://wildberries.ru
- сбербанк / сбер / sberbank → https://sberbank.ru
- тинькофф / тбанк / tinkoff → https://tinkoff.ru
- альфабанк / alfa → https://alfabank.ru
- мегафон / megafon → https://megafon.ru
- мтс / mts → https://mts.ru
- билайн / beeline → https://beeline.ru
- кинопоиск / kinopoisk → https://kinopoisk.ru
- ivi → https://ivi.ru
- rutube → https://rutube.ru
- 2гис / 2gis → https://2gis.ru
- хабр / habr / хабрахабр → https://habr.com
- пикабу / pikabu → https://pikabu.ru
- реддит / reddit → https://reddit.com
- твиттер / twitter / x → https://x.com
- инстаграм / instagram → https://instagram.com
- фейсбук / facebook → https://facebook.com
- телеграм / telegram → https://web.telegram.org
- ютуб / youtube → https://youtube.com
- гугл / google → https://google.com
- гитхаб / github → https://github.com
- нетфликс / netflix → https://netflix.com
- спотифай / spotify → https://spotify.com
- амазон / amazon → https://amazon.com
- алиэкспресс / aliexpress → https://aliexpress.ru
- ламода / lamoda → https://lamoda.ru
- самокат / samokat → https://samokat.ru
- яндекс еда / yandex food → https://eda.yandex.ru
- delivery club / деливери → https://delivery-club.ru
- циан / cian → https://cian.ru
- домклик / domclick → https://domclick.ru

URL RESOLUTION STRATEGY:
1. If you know the URL from the list above — use open_url directly
2. If the site name is in Russian but NOT in the list — translate it to find the URL, then use open_url
3. If you're unsure of the URL — use search_web first to find it, then open_url with the result
4. Never make up URLs — if unsure, search first

EXAMPLES:
User: "открой госуслуги"
Response: Открываю Госуслуги.
\`\`\`tool_call
{"name": "open_url", "args": {"url": "https://gosuslugi.ru"}}
\`\`\`

User: "открой ютуб"
Response: Открываю YouTube.
\`\`\`tool_call
{"name": "open_url", "args": {"url": "https://youtube.com"}}
\`\`\`

User: "открой блокнот"
Response: Запускаю Блокнот.
\`\`\`tool_call
{"name": "launch_app", "args": {"app": "notepad"}}
\`\`\`

User: "кликни по кнопке пуск"
Response: Нахожу кнопку Пуск и кликаю.
\`\`\`tool_call
{"name": "find_element", "args": {"description": "Windows Start button"}}
\`\`\`

User: "перетащи файл"
Response: Перетаскиваю файл.
\`\`\`tool_call
{"name": "drag", "args": {"x1": 100, "y1": 200, "x2": 500, "y2": 300}}
\`\`\`

User: "найди сайт рецептов борща"
Response: Ищу сайт с рецептами борща.
\`\`\`tool_call
{"name": "search_web", "args": {"query": "рецепт борща сайт"}}
\`\`\`

User: "покажи список файлов на рабочем столе"
Response: Смотрю файлы на рабочем столе.
\`\`\`tool_call
{"name": "run_command", "args": {"command": "Get-ChildItem '${desktop}' | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize", "shell": "powershell"}}
\`\`\`

User: "какая версия python установлена"
Response: Проверяю версию Python.
\`\`\`tool_call
{"name": "run_command", "args": {"command": "python --version", "shell": "cmd"}}
\`\`\`

User: "создай папку projects на рабочем столе"
Response: Создаю папку Projects на рабочем столе.
\`\`\`tool_call
{"name": "run_command", "args": {"command": "New-Item -ItemType Directory -Path '${desktop}\\Projects' -Force", "shell": "powershell"}}
\`\`\`

MOUSE USAGE RULES:
- To click a known UI element: use find_element first → get coordinates → mouse_click
- To click at known coordinates: use mouse_click directly with x,y
- For drag & drop: use drag tool (handles smooth movement + hold + release automatically)
- For smooth cursor movement (visual): use move_cursor_smooth
- For instant teleport: use move_cursor
- Always use find_element before clicking buttons/links you haven't seen coordinates for

SHELL USAGE RULES:
- Use powershell for: file operations, system info, .NET, WMI queries
- Use cmd for: simple commands, batch-style operations, legacy tools
- Always use full absolute paths in commands
- For long-running commands add timeout consideration
- PowerShell examples: Get-Process, Get-ChildItem, New-Item, Copy-Item, Remove-Item, Get-Content, Set-Content, Invoke-WebRequest
- CMD examples: dir, copy, del, mkdir, ipconfig, ping, tasklist, netstat

NEVER access Windows, System32, AppData directories.
`
}

// ── Tool Call Parser ──────────────────────────────────────────────────────────

export function parseToolCalls(response: string): AgentToolCall[] {
  const calls: AgentToolCall[] = []

  // Формат 1: все блоки ```tool_call { ... } ``` или ```tool { ... } ```
  const fencedMatches = response.matchAll(/```(?:tool_call|tool)\s*([\s\S]*?)```/g)
  for (const match of fencedMatches) {
    const result = tryParseJSON(match[1].trim())
    if (result) calls.push(result)
  }

  if (calls.length > 0) return calls

  // Формат 2: незакрытый последний блок ```tool_call { ... (стриминг оборвался)
  const partialFenced = response.match(/```(?:tool_call|tool)\s*(\{[\s\S]*)$/)
  if (partialFenced) {
    const result = tryParseJSONPartial(partialFenced[1])
    if (result) calls.push(result)
  }

  if (calls.length > 0) return calls

  // Формат 3: все голые JSON объекты {"name": "...", "args": {...}}
  const jsonMatches = response.matchAll(/\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*"args"\s*:\s*(\{[^{}]*\})[^{}]*\}/g)
  for (const m of jsonMatches) {
    try {
      const parsed = JSON.parse(m[0])
      if (parsed.name && parsed.args !== undefined) {
        calls.push({ name: parsed.name, args: parsed.args })
      }
    } catch {}
  }

  if (calls.length > 0) return calls

  // Формат 4: голый незакрытый JSON {"name": "...", "args": {... (оборвался)
  const partialJson = response.match(/\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"args"\s*:\s*(\{[\s\S]*)$/)
  if (partialJson) {
    const result = tryParseJSONPartial(`{"name": "${partialJson[1]}", "args": ${partialJson[2]}`)
    if (result) calls.push(result)
  }

  return calls
}

function tryParseJSON(json: string): AgentToolCall | null {
  try {
    const parsed = JSON.parse(json)
    if (parsed.name && typeof parsed.name === 'string') {
      return { name: parsed.name, args: parsed.args || {} }
    }
  } catch {}
  return null
}

function tryParseJSONPartial(json: string): AgentToolCall | null {
  try {
    // Закрываем незакрытые скобки
    const opens = (json.match(/\{/g) || []).length
    const closes = (json.match(/\}/g) || []).length
    const closed = json + '}'.repeat(Math.max(0, opens - closes))
    const parsed = JSON.parse(closed)
    if (parsed.name && typeof parsed.name === 'string') {
      // Не запускаем если args пустые — JSON был неполным
      if (!parsed.args || Object.keys(parsed.args).length === 0) return null
      return { name: parsed.name, args: parsed.args }
    }
  } catch {}
  return null
}
