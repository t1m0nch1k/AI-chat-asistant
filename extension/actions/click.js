/**
 * Action to click an element on the page.
 */
export async function executeClick(params) {
  if (!params.selector) throw new Error('Selector is required for click action');
  
  const result = await chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    if (!tab) throw new Error('No active tab found');
    return await chrome.tabs.sendMessage(tab.id, { 
      action: 'click', 
      selector: params.selector 
    });
  });
  
  return result;
}
