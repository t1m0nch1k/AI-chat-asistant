/**
 * Action to type text into an input field.
 */
export async function executeType(params) {
  if (!params.selector || !params.text) {
    throw new Error('Selector and text are required for type action');
  }
  
  const result = await chrome.tabs.query({ active: true, currentWindow: true }).then(async ([tab]) => {
    if (!tab) throw new Error('No active tab found');
    return await chrome.tabs.sendMessage(tab.id, { 
      action: 'type', 
      selector: params.selector,
      text: params.text
    });
  });
  
  return result;
}
