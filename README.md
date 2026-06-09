# 🤖 AI Assistant

A powerful, extensible Windows 11 AI Chat Assistant with advanced Agent capabilities, designed to be your ultimate productivity companion.

![AI Assistant Banner](https://via.placeholder.com/800x400?text=AI+Assistant+Banner)

## ✨ Key Features

### 🧠 Multi-LLM Integration
Connect to your favorite AI providers seamlessly. Support for:
- **Cloud Providers:** OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, OpenRouter.
- **Local LLMs:** Full integration with **Ollama** for private, offline AI.

### 🛠️ Agent Capabilities
More than just a chatbot. The AI Assistant can interact with your system to get things done:
- **Coder Mode:** A dedicated environment for software development featuring:
    - Integrated Code Editor.
    - Built-in Terminal for command execution.
    - File Explorer for project navigation.
- **System Tools:** Capability to analyze screen, manage files, and execute system-level tasks.
- **Knowledge Management:** Organize and provide context to the AI via a dedicated knowledge base.

### 🖥️ Windows Integration
Designed specifically for the Windows ecosystem:
- **Global Hotkey:** Toggle the assistant instantly with `Alt+Shift+G`.
- **System Tray:** Runs quietly in the background with a tray icon for quick access.
- **Auto-start:** Option to launch automatically with Windows.
- **Native Performance:** Built with Electron and React for a smooth, responsive experience.

### 🎨 Modern UI/UX
- **Sleek Interface:** Built with Tailwind CSS and Framer Motion for fluid animations.
- **Markdown Support:** Rich text rendering with syntax highlighting for code.
- **Customizable Settings:** Comprehensive configuration for providers, models, and system behavior.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ (v20 LTS recommended)
- **npm** 9+
- **Windows 10/11**

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/t1m0nch1k/AI-chat-asistant.git
   cd AI-chat-asistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   npm run dev
   ```

---

## ⚙️ Configuration

### Setting up AI Providers
1. Open the app and click the ⚙️ **Settings** icon.
2. Navigate to the **Provider** tab.
3. Select your provider (e.g., OpenAI, Gemini, Ollama).
4. Enter your API key and save settings.

### Local AI with Ollama
1. Install [Ollama](https://ollama.com).
2. Pull a model: `ollama pull llama3.1`.
3. In the app settings, select **Ollama** as the provider.

---

## 🔨 Development & Build

### Available Scripts
- `npm run dev`: Launches the app in development mode with hot-reload.
- `npm run build`: Compiles the TypeScript and React code.
- `npm run package`: Builds the final production installers (NSIS & Portable).
- `npm run package:portable`: Builds only the portable `.exe`.

### Build Architecture
The project uses `electron-vite` for a modern build pipeline:
- **Main Process:** Node.js backend for system access.
- **Preload Script:** Secure bridge between Main and Renderer.
- **Renderer Process:** React frontend for the user interface.

---

## 📂 Project Structure

```text
src/
├── main/          # Electron main process (AI logic, system tools, tray)
├── preload/       # Secure API bridge
└── renderer/      # React UI (Components, Store, Hooks)
    ├── components/ # UI Building blocks (Chat, Coder, Settings)
    ├── store/      # State management (Zustand)
    └── types/      # TypeScript definitions
resources/         # Application icons and assets
```

---

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.
   └── types/      # TypeScript definitions
resources/         # Application icons and assets
```

---

## 📝 License
Distributed under the MIT License. See `LICENSE` for more information.
