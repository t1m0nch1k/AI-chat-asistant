# 📖 Полный гайд: Запуск и сборка AI Assistant

---

## Содержание

1. [Требования к системе](#1-требования-к-системе)
2. [Первый запуск (dev режим)](#2-первый-запуск-dev-режим)
3. [Настройка приложения](#3-настройка-приложения)
4. [Сборка .exe установщика](#4-сборка-exe-установщика)
5. [Portable версия](#5-portable-версия)
6. [Структура проекта](#6-структура-проекта)
7. [Частые проблемы и решения](#7-частые-проблемы-и-решения)

---

## 1. Требования к системе

### Для разработки

| Компонент | Минимум | Рекомендуется |
|-----------|---------|---------------|
| Node.js | 18.x | 20 LTS или 22 LTS (у тебя v24.14.0 ✅) |
| npm | 9.x | 10.x+ (у тебя v11.9.0 ✅) |
| Windows | 10 | 11 |
| RAM | 4 GB | 8 GB |
| Диск | 2 GB свободно | 4 GB |

### Проверка версий

Открой PowerShell или CMD и выполни:

```powershell
node --version
# Должно быть: v18.x.x или выше

npm --version
# Должно быть: 9.x.x или выше
```

Если Node.js не установлен — скачай с [nodejs.org](https://nodejs.org) (выбирай LTS версию).

### Версии в этом проекте

```
Node.js:          v24.14.0
npm:              v11.9.0
Electron:         v30.0.6
electron-builder: v24.13.3
electron-vite:    v2.2.0
React:            v18.3.1
TypeScript:       v5.4.5
```

--- (dev режим)

### Шаг 1 — Перейди в папку проекта

```powershell
cd C:\Users\artem\ai-chat-assistant
```

### Шаг 2 — Установи зависимости

```powershell
npm install
```

Это займёт 1–3 минуты. Установится ~650 пакетов.

> Если видишь ошибки peer dependencies — используй:
> ```powershell
> npm install --legacy-peer-deps
> ```

### Шаг 3 — Запусти в режиме разработки

```powershell
npm run dev
```

После этого:
- Откроется окно приложения
- В системном трее появится иконка
- Автоматически откроются DevTools (для отладки)

### Что происходит при `npm run dev`

```
electron-vite dev
    │
    ├── Компилирует Main process (src/main/)
    ├── Компилирует Preload script (src/preload/)
    ├── Запускает Vite dev server для React UI
    └── Запускает Electron с hot reload
```

Изменения в коде применяются автоматически без перезапуска.

### Горячие клавиши в dev режиме

| Клавиша | Действие |
|---------|----------|
| `Alt+Shift+G` | Показать/скрыть окно |
| `F12` | DevTools (если не открылись) |
| `Ctrl+R` | Перезагрузить renderer |

---

## 3. Настройка приложения

### Добавление API ключа

1. Нажми иконку ⚙️ в правом верхнем углу окна
2. Перейди на вкладку **Provider**
3. Выбери провайдера (OpenAI, Anthropic, и т.д.)
4. Вставь API ключ в поле
5. Нажми **Save Settings**

### Где получить API ключи

| Провайдер | Ссылка | Бесплатный тариф |
|-----------|--------|-----------------|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Нет (есть кредиты при регистрации) |
| Anthropic | [console.anthropic.com](https://console.anthropic.com) | Нет |
| Gemini | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Да (бесплатный tier) |
| Groq | [console.groq.com](https://console.groq.com/keys) | Да (быстрый и бесплатный) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | Да (дешёвый) |
| OpenRouter | [openrouter.ai/keys](https://openrouter.ai/keys) | Да (агрегатор) |
| Ollama | Локально, ключ не нужен | Да (полностью бесплатно) |

### Настройка Ollama (локальные модели)

1. Скачай Ollama: [ollama.com](https://ollama.com)
2. Установи и запусти
3. Скачай модель:
   ```powershell
   ollama pull llama3.1
   # или
   ollama pull mistral
   # или
   ollama pull phi3
   ```
4. В настройках приложения выбери провайдер **Ollama**
5. Base URL оставь `http://localhost:11434`

---

## 4. Сборка .exe установщика

### Быстрая сборка (installer + portable)

```powershell
npm run package
```

Это выполнит:
1. `electron-vite build` — компиляция TypeScript и React
2. `electron-builder` — упаковка в .exe

Результат появится в папке `dist/`:

```
dist/
├── AI Assistant Setup 1.0.0.exe    ← NSIS installer (~130 MB)
├── AI Assistant 1.0.0.exe          ← Portable (~130 MB)
└── win-unpacked/                   ← Распакованная версия
```

### Только NSIS installer

```powershell
npm run build
npx electron-builder --win nsis --x64
```

### Только portable

```powershell
npm run package:portable
```

или

```powershell
npm run build
npx electron-builder --win portable --x64
```

### Что делает NSIS installer

При запуске `AI Assistant Setup 1.0.0.exe`:
- Показывает диалог выбора папки установки
- Создаёт ярлык на рабочем столе
- Создаёт ярлык в меню Пуск
- Регистрирует приложение в "Программы и компоненты"
- Добавляет деинсталлятор

### Настройка installer под себя

Открой `package.json`, секция `"build"`:

```json
"build": {
  "appId": "com.твоёимя.ai-assistant",   // ← Измени на своё
  "productName": "AI Assistant",           // ← Название приложения
  "win": {
    "icon": "resources/icon.ico"           // ← Путь к иконке
  },
  "nsis": {
    "oneClick": false,                     // false = показывать диалог установки
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "AI Assistant",        // ← Название ярлыка
    "deleteAppDataOnUninstall": false      // true = удалять настройки при деинсталляции
  }
}
```

### Замена иконки

Иконка должна быть в формате `.ico` с размерами 16×16, 32×32, 48×48, 256×256.

Создать `.ico` из PNG можно через:
- [icoconvert.com](https://icoconvert.com) — онлайн
- [GIMP](https://www.gimp.org) — File → Export As → .ico
- PowerShell скрипт (уже есть в проекте, запускался при создании)

Замени файлы:
```
resources/
├── icon.ico    ← для installer и окна приложения
└── icon.png    ← для системного трея (16×16 или 32×32)
```

### Время сборки

| Этап | Время |
|------|-------|
| `electron-vite build` | ~10 сек |
| Скачивание electron binaries (первый раз) | 2–5 мин |
| Упаковка в .exe | 1–3 мин |
| **Итого первый раз** | ~8 мин |
| **Итого повторно** | ~2 мин |

> Electron binaries кешируются в `%LOCALAPPDATA%\electron\Cache` и скачиваются только один раз.

---

## 5. Portable версия

Portable — это `.exe` файл, который не требует установки. Просто скопируй и запусти.

```powershell
npm run package:portable
```

Результат: `dist/AI Assistant 1.0.0.exe`

**Плюсы portable:**
- Не нужна установка
- Можно запускать с флешки
- Не оставляет следов в реестре

**Минусы portable:**
- Нет ярлыка в меню Пуск
- Настройки сохраняются рядом с .exe (или в %APPDATA%)

---

## 6. Структура проекта

```
ai-chat-assistant/
│
├── src/
│   ├── main/                    ← Electron main process (Node.js)
│   │   ├── index.ts             — Создание окна, hotkey, lifecycle
│   │   ├── ai.ts                — AI провайдеры (OpenAI, Anthropic, etc.)
│   │   ├── store.ts             — Хранилище настроек (electron-store)
│   │   ├── tools.ts             — Agent tools (файловая система)
│   │   └── tray.ts              — Системный трей
│   │
│   ├── preload/
│   │   └── index.ts             ← Безопасный мост main ↔ renderer
│   │
│   └── renderer/src/            ← React UI
│       ├── App.tsx              — Главный компонент
│       ├── main.tsx             — Точка входа React
│       ├── components/
│       │   ├── ChatWindow.tsx   — Окно чата + Agent mode
│       │   ├── MessageList.tsx  — Список сообщений (Markdown)
│       │   ├── InputArea.tsx    — Поле ввода + drag & drop
│       │   ├── Sidebar.tsx      — История чатов
│       │   └── SettingsWindow.tsx — Настройки (5 вкладок)
│       ├── store/
│       │   └── useAppStore.ts   — Zustand state management
│       ├── types/
│       │   ├── index.ts         — TypeScript типы
│       │   └── electron.d.ts    — Типы для window.api
│       └── utils/
│           ├── cn.ts            — Tailwind class merge
│           └── agentTools.ts    — Agent tool definitions
│
├── resources/
│   ├── icon.ico                 ← Иконка приложения (Windows)
│   └── icon.png                 ← Иконка трея
│
├── out/                         ← Скомпилированный код (после npm run build)
├── dist/                        ← Готовые .exe файлы (после npm run package)
│
├── package.json                 ← Зависимости + конфиг сборки
├── electron.vite.config.ts      ← Конфиг Vite
├── postcss.config.cjs           ← PostCSS (Tailwind)
├── tsconfig.json                ← TypeScript конфиг
└── GUIDE.md                     ← Этот файл
```

---

## 7. Частые проблемы и решения

### ❌ `npm install` падает с ошибкой peer dependencies

```powershell
npm install --legacy-peer-deps
```

---

### ❌ Белый экран при запуске

**Причина:** Ошибка в коде renderer.

**Решение:**
1. Открой DevTools (`F12` или `Ctrl+Shift+I`)
2. Посмотри вкладку Console на ошибки
3. Исправь ошибку

---

### ❌ Иконка в трее не появляется

**Причина:** Файл `resources/icon.png` не найден или пустой.

**Решение:** Убедись что файл существует:
```powershell
Get-Item resources\icon.png
```

Если нет — создай любую PNG иконку 16×16 пикселей и положи туда.

---

### ❌ `Error: Dynamic require of "tailwindcss" is not supported`

**Причина:** Tailwind config в формате `.js` в ESM проекте.

**Решение:** Убедись что файл называется `tailwind.config.cjs` (не `.js`):
```powershell
Get-Item src\renderer\tailwind.config.cjs
```

---

### ❌ Приложение не открывается по `Alt+Shift+G`

**Причина:** Другое приложение уже использует этот hotkey.

**Решение:** Измени hotkey в настройках приложения (вкладка System → Global Hotkey).

Формат: `Ctrl+Shift+A`, `Alt+Space`, `Super+G` и т.д.

---

### ❌ `electron-builder` не может найти иконку

```
Error: icon.ico not found
```

**Решение:**
```powershell
# Проверь что файл существует
Get-Item resources\icon.ico

# Если нет — скопируй из PNG
# (или создай заново через скрипт)
```

---

### ❌ Сборка зависает на "Downloading electron"

**Причина:** Медленный интернет или блокировка GitHub.

**Решение:** Установи зеркало для скачивания:
```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm run package
```

---

### ❌ Антивирус блокирует .exe

**Причина:** Неподписанный исполняемый файл — это нормально для личных проектов.

**Решение:**
- Добавь папку `dist/` в исключения антивируса
- Или подпиши код сертификатом (для публичного распространения)

---

### ❌ AI не отвечает / ошибка API

Проверь:
1. API ключ введён правильно (без лишних пробелов)
2. Выбран правильный провайдер
3. Выбрана существующая модель
4. Есть интернет-соединение
5. Баланс на аккаунте провайдера не исчерпан

Для Ollama — убедись что сервис запущен:
```powershell
ollama list
# Должен показать список скачанных моделей
```

---

## Полезные команды

```powershell
# Запуск в dev режиме
npm run dev

# Только компиляция (без запуска)
npm run build

# Сборка installer + portable
npm run package

# Только installer
npm run build; npx electron-builder --win nsis

# Только portable
npm run package:portable

# Проверка кода (линтер)
npm run lint

# Просмотр скомпилированного кода
npm run preview
```

---

## Автозапуск с Windows

Включается в настройках приложения:
**Settings → System → Start with Windows → включить**

Или вручную через реестр:
```powershell
# Добавить в автозапуск
$appPath = "C:\путь\к\AI Assistant.exe"
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "AIAssistant" -Value $appPath

# Удалить из автозапуска
Remove-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "AIAssistant"
```

---

## Где хранятся данные

| Данные | Путь |
|--------|------|
| Настройки и история чатов | `%APPDATA%\ai-chat-assistant\` |
| Логи | `%APPDATA%\ai-chat-assistant\logs\` |
| Electron кеш | `%LOCALAPPDATA%\electron\Cache\` |

Чтобы полностью сбросить приложение:
```powershell
Remove-Item "$env:APPDATA\ai-chat-assistant" -Recurse -Force
```
