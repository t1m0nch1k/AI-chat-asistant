# 🔨 Гайд по сборке AI Assistant

## Требования

- **Node.js** 18+ (рекомендуется 20 LTS)
- **npm** 9+
- **Windows 10/11** (для сборки .exe)

---

## Быстрый старт (разработка)

```bash
# 1. Установить зависимости
npm install

# 2. Запустить в dev-режиме (hot reload)
npm run dev
```

Приложение откроется в окне + DevTools. Иконка появится в трее.

---

## Сборка production

### Installer (.exe + portable)

```bash
# Сборка всех артефактов
npm run package
```

Результат в папке `dist/`:
```
dist/
  AI Assistant Setup 1.0.0.exe    ← NSIS installer
  AI Assistant 1.0.0.exe          ← Portable (без установки)
```

### Только installer

```bash
npm run build && npx electron-builder --win nsis
```

### Только portable

```bash
npm run build && npx electron-builder --win portable
```

---

## Структура сборки

```
electron-vite build  →  out/
  out/main/index.js       ← Main process
  out/preload/index.mjs   ← Preload script
  out/renderer/           ← React UI

electron-builder     →  dist/
  dist/*.exe              ← Финальные установщики
```

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
| Итоговый .exe | ~120-150 MB (включает Electron runtime) |

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
