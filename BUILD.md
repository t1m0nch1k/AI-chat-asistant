# 🔨 Гайд по сборке AI Assistant

## Требования

- **Node.js** 18+ (рекомендуется 20 LTS)
- **npm** 9+
- **.NET 8 SDK** — для сборки голосового агента (VoiceAgent.exe)
- **Windows 10/11** (для сборки .exe)

> **Важно:** Для работы голосового ассистента требуется **русский языковой пакет Windows** (Параметры → Время и язык → Язык и регион → Русский). Используется современный API `Windows.Media.SpeechRecognition`, который работает с системными языковыми пакетами, а не с устаревшим .NET Language Pack.

---

## Сборка голосового агента (C#)

Перед первым запуском или перед production-сборкой нужно скомпилировать C# проект:

```bash
cd resources/voice-agent
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

Результат:
```
resources/voice-agent/bin/Release/net8.0-windows10.0.19041.0/win-x64/publish/VoiceAgent.exe
```

Это self-contained приложение (~40–60 MB) — .NET Runtime устанавливать не нужно.

Если .NET SDK не установлен, скачайте с [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/8.0).

---

## Быстрый старт (разработка)

```bash
# 1. Установить зависимости Node.js
npm install

# 2. Собрать голосовой агент (один раз, или после изменений в C# коде)
npm run build:voice-agent

# 3. Запустить в dev-режиме (hot reload)
npm run dev
```

Приложение откроется в окне + DevTools. Иконка появится в трее.

---

## Сборка production

### Installer (.exe + portable)

```bash
# Сборка всех артефактов (включая VoiceAgent.exe)
npm run package
```

Результат в папке `dist/`:
```
dist/
  AI Assistant Setup 2.1.0.exe    ← NSIS installer
  AI Assistant 2.1.0.exe          ← Portable (без установки)
```

> `npm run package` автоматически вызывает `npm run build:voice-agent` перед сборкой Electron.

### Только installer

```bash
npm run build:voice-agent
npm run build && npx electron-builder --win nsis
```

### Только portable

```bash
npm run build:voice-agent
npm run build && npx electron-builder --win portable
```

---

## Структура сборки

```
electron-vite build  →  out/
  out/main/index.js       ← Main process
  out/preload/index.mjs   ← Preload script
  out/renderer/           ← React UI

dotnet publish       →  resources/voice-agent/bin/.../publish/
  VoiceAgent.exe          ← Голосовой агент (C# / WinRT)

electron-builder     →  dist/
  dist/*.exe              ← Финальные установщики
```

---

## Голосовой агент (VoiceAgent.exe)

Исходники находятся в `resources/voice-agent/`:

| Файл | Назначение |
|------|-----------|
| `VoiceAgent.csproj` | Проект .NET 8 (target: `net8.0-windows10.0.19041.0`) |
| `Program.cs` | Логика: wake word → command → IPC stdout |

**Архитектура:**
- `Windows.Media.SpeechRecognition` — современный WinRT API
- `SpeechRecognitionListConstraint` — грамматика wake words
- `SpeechRecognitionTopicConstraint(Dictation)` — свободное распознавание команд
- `ContinuousRecognitionSession` — фоновый режим без задержек
- Вывод в stdout: `STATUS:READY`, `WAKE_DETECTED:...`, `COMMAND:...`

**Ограничения:**
- Использует системный микрофон по умолчанию (выбор конкретного микрофона не поддерживается WinRT API)
- Требует русский языковой пакет Windows 10/11
- Self-contained publish увеличивает размер бандла на ~40–60 MB

---

## Настройка electron-builder

В `package.json` → секция `"build"`:

```json
{
  "build": {
    "appId": "com.yourname.ai-assistant",
    "productName": "AI Assistant",
    "win": {
      "target": ["nsis", "portable"],
      "icon": "resources/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true
    }
  }
}
```

---

## Автообновление (опционально)

Для автообновлений нужен GitHub Releases:

1. Создай репозиторий на GitHub
2. Обнови `package.json`:
```json
"publish": {
  "provider": "github",
  "owner": "your-username",
  "repo": "ai-assistant"
}
```
3. Создай GitHub token с правами `repo`
4. Установи переменную окружения:
```bash
set GH_TOKEN=your_token_here
```
5. Публикуй:
```bash
npm run package -- --publish always
```

---

## Иконка

Замени `resources/icon.ico` и `resources/icon.png` своими иконками:
- `icon.ico` — для Windows (рекомендуется 256×256 + 48×48 + 32×32 + 16×16)
- `icon.png` — для трея (16×16 или 32×32)

Инструменты для создания ICO:
- [IcoFX](https://icofx.ro/)
- [GIMP](https://www.gimp.org/) (экспорт в .ico)
- [RealFaviconGenerator](https://realfavicongenerator.net/)

---

## Переменные окружения (dev)

Создай `.env` в корне (не коммить!):
```env
# Для тестирования без UI
OPENAI_API_KEY=sk-...
```

---

## Troubleshooting

### Голосовой агент не запускается / `VoiceAgent.exe not found`
→ Убедись что собрал C# проект:
```bash
cd resources/voice-agent && dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

### `STATUS:ERROR_LANGUAGE_PACK`
→ В Windows не установлен **русский языковой пакет** для распознавания речи:
1. Параметры → Время и язык → Язык и регион
2. Добавь язык **Русский** (если нет)
3. Нажми на Русский → Параметры языка → Установи **Распознавание речи** (Speech recognition)
4. Перезапусти приложение

### Wake word не распознаётся
→ Проверь что микрофон работает и включён в системе
→ Попробуй другие wake words в настройках приложения
→ Убедись что нет других приложений, занимающих микрофон

### `Error: Dynamic require of "tailwindcss" is not supported`
→ Убедись что `postcss.config.cjs` существует (не `.js`)

### Приложение не появляется в трее
→ Проверь что `resources/icon.png` существует

### `electron-builder` не находит иконку
→ Убедись что `resources/icon.ico` существует и не пустой

### Белый экран в production
→ Проверь CSP в `index.html`, убедись что пути к ресурсам правильные

---

## Размер бандла

| Файл | Размер |
|------|--------|
| Renderer JS | ~2 MB (включает React, markdown, syntax highlighter) |
| Renderer CSS | ~28 KB |
| Main process | ~24 KB |
| VoiceAgent.exe | ~40–60 MB (self-contained .NET 8 runtime) |
| Итоговый .exe | ~160–220 MB (включает Electron + .NET runtime) |

Для уменьшения размера:
```bash
# Исключить devDependencies из бандла (уже настроено)
# Использовать electron-builder compression
```

---

## Подпись кода (Code Signing)

Для production рекомендуется подписать .exe:

```json
"win": {
  "certificateFile": "cert.pfx",
  "certificatePassword": "password"
}
```

Без подписи Windows SmartScreen покажет предупреждение при первом запуске.
