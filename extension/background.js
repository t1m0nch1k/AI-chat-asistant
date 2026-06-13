import { wsManager } from './websocket.js';
import { executeClick } from './actions/click.js';
import { executeType } from './actions/type.js';
import { executeScroll } from './actions/scroll.js';
import { executeScreenshot } from './actions/screenshot.js';

/**
 * Background script for orchestrating communication between the AI server and the browser tabs.
 */

wsManager.connect();

/**
 * Sends a command to the active tab and returns the result.
 */
async function sendCommandToActiveTab(command) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error('No active tab found');

    const response = await chrome.tabs.sendMessage(tab.id, command);
    return response;
  } catch (error) {
    console.error('[Background] Error sending command to tab:', error);
    return { error: error.message };
  }
}

/**
 * Handles the logic for different AI actions.
 */
async function handleAIAction(actionData) {
  const { action, ...params } = actionData;
  console.log(`[Background] Executing AI action: ${action}`, params);

  try {
    switch (action) {
      // Tab-level actions (Browser API)
      case 'open_url':
        await chrome.tabs.create({ url: params.url });
        return { success: true, message: `Opened ${params.url}` };

      case 'reload':
        const [reloadTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.reload(reloadTab.id);
        return { success: true };

      case 'go_back':
        const [backTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.goBack(backTab.id);
        return { success: true };

      case 'go_forward':
        const [fwdTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.goForward(fwdTab.id);
        return { success: true };

      case 'close_tab':
        const [closeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.remove(closeTab.id);
        return { success: true };

      // Modular Actions
      case 'click':
        return await executeClick(params);
      case 'type':
        return await executeType(params);
      case 'scroll':
        return await executeScroll(params);
      case 'screenshot':
        return await executeScreenshot(params);

      // Page-level actions (Content Script)
      default:
        return await sendCommandToActiveTab({ action, ...params });
    }
  } catch (error) {
    console.error(`[Background] Action ${action} failed:`, error);
    return { error: error.message };
  }
}

// Listen for messages from AI server via WebSocket
wsManager.addListener((type, data) => {
  if (type === 'message') {
    handleAIAction(data).then(result => {
      wsManager.send({
        type: 'response',
        requestId: data.requestId || 'unknown',
        result: result
      });
    });
  }
});

// Handle messages from the popup
chrome.runtime.onMessage.addListener((request, sender, response) => {
  if (request.action === 'get_connection_status') {
    response({ connected: wsManager.isConnected });
  }
});
