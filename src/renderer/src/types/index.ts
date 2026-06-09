// ============================================================
// Core Types for AI Chat Assistant
// ============================================================

export type Provider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'deepseek'
  | 'mistral'
  | 'groq'
  | 'openrouter'
  | 'qwen'
  | 'nvidia'
  | 'huggingface'

export type Theme = 'light' | 'dark' | 'system'

export interface Persona {
  id: string
  name: string
  description: string
  systemPrompt: string
  recommendedVoice: string
  recommendedRate: number
  recommendedVolume: number
  icon: string
}

export const PERSONAS: Record<string, Persona> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Concise, formal and highly efficient.',
    systemPrompt: 'You are a professional AI assistant. Your responses are concise, formal, and focused on efficiency. Avoid fluff and emojis unless necessary for clarity.',
    recommendedVoice: '',
    recommendedRate: 0,
    recommendedVolume: 100,
    icon: '💼'
  },
  jarvis: {
    id: 'jarvis',
    name: 'Jarvis',
    description: 'Sophisticated, British, and proactively helpful.',
    systemPrompt: 'You are JARVIS, a sophisticated AI butler. You are polite, highly intelligent, and have a dry British wit. You address the user as "Sir" or "Ma\'am" and strive to be one step ahead of their needs.',
    recommendedVoice: '', 
    recommendedRate: 1,
    recommendedVolume: 100,
    icon: '🦾'
  },
  friendly: {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm, encouraging, and uses emojis.',
    systemPrompt: 'You are a warm and friendly AI companion. You use a supportive tone, emojis, and encouraging language to make the user feel comfortable and happy.',
    recommendedVoice: '', 
    recommendedRate: 0,
    recommendedVolume: 100,
    icon: '😊'
  },
  sarcastic: {
    id: 'sarcastic',
    name: 'Sarcastic',
    description: 'Blunt, ironic, but still gets the job done.',
    systemPrompt: 'You are a sarcastic AI. You find human requests slightly amusing and often respond with irony or a bit of attitude, but you still provide the correct and helpful information in the end.',
    recommendedVoice: '',
    recommendedRate: -1,
    recommendedVolume: 100,
    icon: '🙄'
  },
  academic: {
    id: 'academic',
    name: 'Academic',
    description: 'Rigorous, detailed, and citation-oriented.',
    systemPrompt: 'You are an academic expert. Your responses are detailed, structured, and grounded in evidence. You provide deep analysis and maintain a scholarly tone.',
    recommendedVoice: '',
    recommendedRate: 0,
    recommendedVolume: 100,
    icon: '🎓'
  }
}

export interface Settings {
  // Provider
  provider: Provider
  apiKey: string
  model: string
  ollamaBaseUrl: string
  openrouterBaseUrl: string

  // Generation
  personaId: string
  systemPrompt: string
  temperature: number
  maxTokens: number

  // UI
  language: 'en' | 'ru'
  theme: Theme
  fontSize: 'sm' | 'md' | 'lg'
  sendOnEnter: boolean

  // System
  autoStart: boolean
  minimizeToTray: boolean
  globalHotkey: string
  showNotifications: boolean

  // Proxy
  proxyEnabled: boolean
  proxyUrl: string

  // Agent
  agentEnabled: boolean
  allowedPaths: string[]
  requireConfirmation: boolean

  // Voice
  backgroundVoiceEnabled: boolean
  wakeWords: string[]
  ttsRate: number
  ttsVolume: number
  ttsVoice: string  // Имя голоса Windows SAPI, '' = по умолчанию
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  /** Tool calls made by the assistant */
  toolCalls?: ToolCall[]
  /** Result of a tool execution */
  toolResult?: ToolResult
  /** Whether this message is still streaming */
  streaming?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  lastUpdated: number
  pinned?: boolean
}

// ============================================================
// Agent / Tool Types
// ============================================================

export type ToolName =
  | 'create_file'
  | 'read_file'
  | 'edit_file'
  | 'delete_file'
  | 'list_directory'
  | 'run_command'
  | 'search_files'
  | 'move_file'

export interface ToolCall {
  id: string
  name: ToolName
  args: Record<string, unknown>
  status: 'pending' | 'approved' | 'denied' | 'done' | 'error'
  result?: string
}

export interface ToolResult {
  toolCallId: string
  success: boolean
  output: string
  error?: string
}

export interface ToolDefinition {
  name: ToolName
  description: string
  parameters: Record<string, unknown>
  requiresConfirmation: boolean
  riskLevel: 'low' | 'medium' | 'high'
}

// ============================================================
// IPC / API Bridge Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: number
}

// ============================================================
// Coder Mode Types
// ============================================================

export interface CoderFileNode {
  name: string
  path: string
  relativePath: string
  isDirectory: boolean
  size: number
  modified: number
  children?: CoderFileNode[]
}

export type CoderActionType = 'read' | 'write' | 'patch' | 'terminal'

export interface CoderAction {
  type: CoderActionType
  path?: string
  content?: string
  search?: string
  replace?: string
  command?: string
}

export interface CoderWorkspaceState {
  rootPath: string | null
  tree: CoderFileNode[]
  openFiles: string[]
  activeFile: string | null
  isScanning: boolean
}

// ============================================================
// Computer Agent Types
// ============================================================

export interface ScreenElement {
  type: string
  text: string
  x: number
  y: number
  width?: number
  height?: number
  confidence?: number
}

export interface ScreenAnalysis {
  elements: ScreenElement[]
  textBlocks?: Array<{ text: string; x: number; y: number }>
  description?: string
  resolution?: { width: number; height: number }
}

export interface AgentAction {
  id: string
  type: string
  params: Record<string, unknown>
  description: string
}

export interface AgentStep {
  id: string
  description: string
  action: AgentAction
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped'
  result?: string
  error?: string
  attempts: number
}

export interface AgentTask {
  id: string
  goal: string
  steps: AgentStep[]
  currentStep: number
  status: 'idle' | 'planning' | 'running' | 'waiting_confirmation' | 'done' | 'failed' | 'stopped'
  startedAt: number
  completedAt?: number
  errorLog: string[]
  planSummary?: string
}

export interface AgentMemoryEntry {
  type: string
  content: string
  timestamp: number
}

// ============================================================
// Model Catalog
// ============================================================

export interface ModelInfo {
  id: string
  name: string
  provider: Provider
  contextWindow: number
  supportsVision?: boolean
}

export const MODEL_CATALOG: Record<Provider, ModelInfo[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, supportsVision: true },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000 },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', contextWindow: 128000, supportsVision: true },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', contextWindow: 16385 }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic', contextWindow: 200000, supportsVision: true },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic', contextWindow: 200000, supportsVision: true },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'anthropic', contextWindow: 200000 }
  ],
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'gemini', contextWindow: 1048576, supportsVision: true },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: 'gemini', contextWindow: 1048576, supportsVision: true },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp', provider: 'gemini', contextWindow: 2000000, supportsVision: true },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini', contextWindow: 1000000, supportsVision: true },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini', contextWindow: 1000000, supportsVision: true }
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', contextWindow: 64000 },
    { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek', contextWindow: 64000 },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)', provider: 'deepseek', contextWindow: 64000 }
  ],
  mistral: [
    { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral', contextWindow: 32000 },
    { id: 'mistral-medium-latest', name: 'Mistral Medium', provider: 'mistral', contextWindow: 32000 },
    { id: 'open-mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'mistral', contextWindow: 32000 },
    { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'mistral', contextWindow: 32000 }
  ],
  groq: [
    { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'groq', contextWindow: 128000 },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'groq', contextWindow: 128000 },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'groq', contextWindow: 32768 },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', provider: 'groq', contextWindow: 8192 },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', contextWindow: 128000 }
  ],
  openrouter: [
    { id: 'openai/gpt-4o', name: 'GPT-4o (via OR)', provider: 'openrouter', contextWindow: 128000, supportsVision: true },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (via OR)', provider: 'openrouter', contextWindow: 200000, supportsVision: true },
    { id: 'qwen/qwen2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B (via OR) 👁️', provider: 'openrouter', contextWindow: 131072, supportsVision: true },
    { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B (via OR)', provider: 'openrouter', contextWindow: 128000 },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat (via OR)', provider: 'openrouter', contextWindow: 64000 },
    { id: 'deepseek/deepseek-reasoner', name: 'DeepSeek R1 (via OR)', provider: 'openrouter', contextWindow: 64000 }
  ],
  ollama: [
    { id: 'llama3.1', name: 'Llama 3.1', provider: 'ollama', contextWindow: 128000 },
    { id: 'mistral', name: 'Mistral', provider: 'ollama', contextWindow: 32000 },
    { id: 'codellama', name: 'Code Llama', provider: 'ollama', contextWindow: 16000 },
    { id: 'phi3', name: 'Phi-3', provider: 'ollama', contextWindow: 128000 },
    { id: 'llava', name: 'LLaVA 👁️', provider: 'ollama', contextWindow: 4096, supportsVision: true },
    { id: 'llava:13b', name: 'LLaVA 13B 👁️', provider: 'ollama', contextWindow: 4096, supportsVision: true },
    { id: 'llava-llama3', name: 'LLaVA Llama3 👁️', provider: 'ollama', contextWindow: 8192, supportsVision: true },
    { id: 'moondream', name: 'Moondream2 👁️ (2GB)', provider: 'ollama', contextWindow: 2048, supportsVision: true },
    { id: 'minicpm-v', name: 'MiniCPM-V 👁️', provider: 'ollama', contextWindow: 8192, supportsVision: true },
    { id: 'qwen2.5vl:3b', name: 'Qwen2.5 VL 3B 👁️', provider: 'ollama', contextWindow: 131072, supportsVision: true },
    { id: 'qwen2.5vl:7b', name: 'Qwen2.5 VL 7B 👁️ (recommended)', provider: 'ollama', contextWindow: 131072, supportsVision: true },
    { id: 'qwen2.5vl:32b', name: 'Qwen2.5 VL 32B 👁️', provider: 'ollama', contextWindow: 131072, supportsVision: true },
    { id: 'qwen2.5vl:72b', name: 'Qwen2.5 VL 72B 👁️', provider: 'ollama', contextWindow: 131072, supportsVision: true },
    { id: 'qwen2-vl', name: 'Qwen2-VL (old) 👁️', provider: 'ollama', contextWindow: 32000, supportsVision: true },
    { id: 'bakllava', name: 'BakLLaVA 👁️', provider: 'ollama', contextWindow: 4096, supportsVision: true },
    { id: 'deepseek-r1:latest', name: 'DeepSeek R1 (Local)', provider: 'ollama', contextWindow: 128000 }
  ],
  huggingface: [
    { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', provider: 'huggingface', contextWindow: 128000 },
    { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', provider: 'huggingface', contextWindow: 128000 },
    { id: 'meta-llama/Llama-3.2-11B-Vision-Instruct', name: 'Llama 3.2 11B Vision 👁️', provider: 'huggingface', contextWindow: 128000, supportsVision: true },
    { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B v0.3', provider: 'huggingface', contextWindow: 32768 },
    { id: 'microsoft/Phi-3-mini-4k-instruct', name: 'Phi-3 Mini 4K', provider: 'huggingface', contextWindow: 4096 },
    { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', provider: 'huggingface', contextWindow: 131072 },
    { id: 'Qwen/Qwen2.5-VL-72B-Instruct', name: 'Qwen 2.5 VL 72B 👁️', provider: 'huggingface', contextWindow: 131072, supportsVision: true },
    { id: 'llava-hf/llava-v1.6-mistral-7b-hf', name: 'LLaVA 1.6 Mistral 7B 👁️', provider: 'huggingface', contextWindow: 4096, supportsVision: true }
  ],
  nvidia: [
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', provider: 'nvidia', contextWindow: 128000 },
    { id: 'nvidia/nemotron-4-340b-instruct', name: 'Nemotron 4 340B', provider: 'nvidia', contextWindow: 4096 },
    { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B v0.3', provider: 'nvidia', contextWindow: 32768 },
    { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', provider: 'nvidia', contextWindow: 8192 },
    { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', provider: 'nvidia', contextWindow: 128000 }
  ],
  qwen: [
    { id: 'qwen-max', name: 'Qwen Max', provider: 'qwen', contextWindow: 32000 },
    { id: 'qwen-plus', name: 'Qwen Plus', provider: 'qwen', contextWindow: 131072 },
    { id: 'qwen-turbo', name: 'Qwen Turbo', provider: 'qwen', contextWindow: 131072 },
    { id: 'qwen-long', name: 'Qwen Long', provider: 'qwen', contextWindow: 10000000 },
    { id: 'qwen2.5-72b-instruct', name: 'Qwen 2.5 72B', provider: 'qwen', contextWindow: 131072 },
    { id: 'qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'qwen', contextWindow: 131072 },
    { id: 'qwen-vl-max', name: 'Qwen VL Max 👁️', provider: 'qwen', contextWindow: 32000, supportsVision: true },
    { id: 'qwen-vl-plus', name: 'Qwen VL Plus 👁️', provider: 'qwen', contextWindow: 32000, supportsVision: true },
    { id: 'qwen2.5-vl-72b-instruct', name: 'Qwen 2.5 VL 72B 👁️', provider: 'qwen', contextWindow: 131072, supportsVision: true },
    { id: 'qwen2.5-vl-7b-instruct', name: 'Qwen 2.5 VL 7B 👁️', provider: 'qwen', contextWindow: 131072, supportsVision: true }
  ]
}
