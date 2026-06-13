/**
 * Action to capture a screenshot of the visible tab.
 */
export async function executeScreenshot(params) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    return { success: true, data: dataUrl };
  } catch (error) {
    throw new Error(`Screenshot failed: ${error.message}`);
  }
}
