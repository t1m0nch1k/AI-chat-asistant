/**
 * Web Tools — поиск в интернете и чтение страниц.
 *
 * Поиск:
 *  1. DuckDuckGo Instant Answer API (бесплатно, без ключа)
 *  2. Tavily Search API (опционально, с ключом — лучшее качество)
 *
 * Браузер:
 *  - Открывает BrowserWindow с WebView внутри приложения
 *  - AI может читать содержимое страницы
 */

import { ipcMain, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// ── Активные браузерные окна ──────────────────────────────────────────────────
const browserWindows = new Map<string, BrowserWindow>()

export function setupWebToolHandlers(): void {

  // ── DuckDuckGo поиск (без API ключа) ─────────────────────────────────────

  ipcMain.handle('web:search-ddg', async (_, { query }: { query: string }) => {
    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AI-Assistant/1.0' }
      })
      const data = await res.json() as any

      const results: SearchResult[] = []

      // Abstract (прямой ответ)
      if (data.AbstractText) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '',
          snippet: data.AbstractText,
          source: 'DuckDuckGo'
        })
      }

      // Related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 8)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || topic.Text.slice(0, 60),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: 'DuckDuckGo'
            })
          }
        }
      }

      return { success: true, results, query }
    } catch (err: any) {
      return { success: false, error: err.message, results: [] }
    }
  })

  // ── Tavily поиск (с API ключом, лучшее качество) ─────────────────────────

  ipcMain.handle('web:search-tavily', async (_, { query, apiKey }: { query: string; apiKey: string }) => {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          query,
          search_depth: 'basic',
          max_results: 8,
          include_answer: true
        })
      })

      if (!res.ok) {
        throw new Error(`Tavily error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json() as any

      const results: SearchResult[] = (data.results || []).map((r: any) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
        source: 'Tavily'
      }))

      return {
        success: true,
        results,
        answer: data.answer || null,
        query
      }
    } catch (err: any) {
      return { success: false, error: err.message, results: [] }
    }
  })

  // ── Чтение содержимого страницы ───────────────────────────────────────────

  ipcMain.handle('web:fetch-page', async (_, { url }: { url: string }) => {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: AbortSignal.timeout(10000)
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const html = await res.text()

      // Простое извлечение текста из HTML
      const text = extractTextFromHtml(html)

      return {
        success: true,
        url,
        title: extractTitle(html),
        text: text.slice(0, 8000) // Ограничиваем размер
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Открыть встроенный браузер ────────────────────────────────────────────

  ipcMain.handle('web:open-browser', async (_, { url, windowId }: { url: string; windowId: string }) => {
    // Закрыть существующее окно с тем же ID
    if (browserWindows.has(windowId)) {
      browserWindows.get(windowId)?.close()
      browserWindows.delete(windowId)
    }

    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      title: 'AI Assistant Browser',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    })

    win.loadURL(url)
    browserWindows.set(windowId, win)

    win.on('closed', () => {
      browserWindows.delete(windowId)
    })

    // Возвращаем заголовок когда страница загрузится
    return new Promise<{ success: boolean; title?: string; url?: string }>((resolve) => {
      win.webContents.once('did-finish-load', () => {
        resolve({
          success: true,
          title: win.webContents.getTitle(),
          url: win.webContents.getURL()
        })
      })
      win.webContents.once('did-fail-load', (_, code, desc) => {
        resolve({ success: false, title: desc })
      })
    })
  })

  // ── Получить текст из открытого браузера ──────────────────────────────────

  ipcMain.handle('web:get-page-text', async (_, { windowId }: { windowId: string }) => {
    const win = browserWindows.get(windowId)
    if (!win) {
      return { success: false, error: 'Browser window not found' }
    }

    try {
      const text = await win.webContents.executeJavaScript(`
        (function() {
          // Удаляем скрипты и стили
          const clone = document.body.cloneNode(true);
          const scripts = clone.querySelectorAll('script, style, nav, footer, header, aside');
          scripts.forEach(el => el.remove());
          return clone.innerText.replace(/\\s+/g, ' ').trim().slice(0, 8000);
        })()
      `)
      return {
        success: true,
        text,
        title: win.webContents.getTitle(),
        url: win.webContents.getURL()
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // ── Закрыть браузер ───────────────────────────────────────────────────────

  ipcMain.handle('web:close-browser', (_, { windowId }: { windowId: string }) => {
    const win = browserWindows.get(windowId)
    if (win && !win.isDestroyed()) {
      win.close()
    }
    browserWindows.delete(windowId)
    return { success: true }
  })

  // ── YouTube поиск (через DuckDuckGo с site:youtube.com) ───────────────────

  ipcMain.handle('web:search-youtube', async (_, { query }: { query: string }) => {
    try {
      const searchQuery = `site:youtube.com ${query}`
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_html=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'AI-Assistant/1.0' }
      })
      const data = await res.json() as any

      const results: SearchResult[] = []

      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 10)) {
          if (topic.FirstURL?.includes('youtube.com')) {
            results.push({
              title: topic.Text?.split(' - ')[0] || 'YouTube Video',
              url: topic.FirstURL,
              snippet: topic.Text || '',
              source: 'YouTube'
            })
          }
        }
      }

      // Если DuckDuckGo не дал результатов — возвращаем прямую ссылку поиска
      if (results.length === 0) {
        results.push({
          title: `Search YouTube: "${query}"`,
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
          snippet: 'Click to open YouTube search results',
          source: 'YouTube'
        })
      }

      return { success: true, results, query }
    } catch (err: any) {
      return { success: false, error: err.message, results: [] }
    }
  })
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  title: string
  url: string
  snippet: string
  source: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  return match ? match[1].trim() : 'Unknown'
}
