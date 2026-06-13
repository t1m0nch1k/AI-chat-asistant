/**
 * Action to scroll the page.
 */
export async function executeScroll(params) {
  if (params.y === undefined && params.selector === undefined) {
    throw new Error('Either y coordinate or selector is required for scroll action');
  }
  
  const action = params.selector ? 'scroll_to_element' : 'scroll';
  
  const result = await chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    if (!tab) throw new Error('No active tab found');
    return await chrome.tabs.sendMessage(tab.id, { 
      action, 
      ...params 
    });
  });
  
  return result;
}
