/**
 * Content script for interacting with the DOM of web pages.
 */

// Helper to wait for an element to appear in the DOM
async function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const element = document.querySelector(selector);
      if (element) {
        clearInterval(interval);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for element: ${selector}`));
      }
    }, 100);
  });
}

/**
 * Extract interactive elements from the page.
 * This implements the requested structured format.
 */
function getInteractiveElements() {
  const interactiveTags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', '[role="button"]', '[role="link"]'];
  const elements = [];
  
  // In a real scenario, we'd use a more complex selector or iterate all elements
  const allElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [role="link"]');

  allElements.forEach((el, index) => {
    const rect = el.getBoundingClientRect();
    const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
    
    if (isVisible) {
      elements.push({
        id: `el_${index}`,
        tag: el.tagName.toLowerCase(),
        text: el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '',
        selector: generateUniqueSelector(el),
        visible: true,
        enabled: !el.disabled
      });
    }
  });

  return elements;
}

/**
 * Generates a CSS selector that uniquely identifies an element.
 */
function generateUniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  
  const path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className) {
      selector += `.${el.className.trim().split(/\s+/).join('.')}`;
    }
    
    // Use index if there are siblings of the same type
    let sibling = el.previousElementSibling;
    let index = 1;
    while (sibling) {
      if (sibling.nodeName === el.nodeName) index++;
      sibling = sibling.previousElementSibling;
    }
    if (index > 1 || el.nextElementSibling?.nodeName === el.nodeName) {
      selector += `:nth-of-type(${index})`;
    }
    
    path.unshift(selector);
    el = el.parentNode;
    if (!el || el === document.body) break;
  }
  return path.join(' > ');
}

/**
 * Handle messages from the background script.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content] Received request:', request);

  const handleAction = async () => {
    try {
      switch (request.action) {
        case 'get_page_text':
          sendResponse({ data: document.body.innerText });
          break;
        
        case 'get_html':
          sendResponse({ data: document.documentElement.outerHTML });
          break;
        
        case 'get_interactive_elements':
          sendResponse({ data: getInteractiveElements() });
          break;

        case 'get_links':
          const links = Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText,
            href: a.href,
            selector: generateUniqueSelector(a)
          }));
          sendResponse({ data: links });
          break;

        case 'click':
          const clickEl = await waitForElement(request.selector);
          clickEl.click();
          sendResponse({ success: true });
          break;

        case 'type':
          const typeEl = await waitForElement(request.selector);
          typeEl.value = request.text;
          typeEl.dispatchEvent(new Event('input', { bubbles: true }));
          typeEl.dispatchEvent(new Event('change', { bubbles: true }));
          sendResponse({ success: true });
          break;

        case 'select_value':
          const selectEl = await waitForElement(request.selector);
          selectEl.value = request.value;
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          sendResponse({ success: true });
          break;

        case 'clear':
          const clearEl = await waitForElement(request.selector);
          clearEl.value = '';
          clearEl.dispatchEvent(new Event('input', { bubbles: true }));
          sendResponse({ success: true });
          break;

        case 'get_coordinates':
          const coordEl = await waitForElement(request.selector);
          const rect = coordEl.getBoundingClientRect();
          sendResponse({ 
            data: { 
              x: rect.left + rect.width / 2, 
              y: rect.top + rect.height / 2,
              width: rect.width,
              height: rect.height
            } 
          });
          break;

        case 'submit_form':
          const formEl = await waitForElement(request.selector);
          formEl.submit();
          sendResponse({ success: true });
          break;

        case 'scroll':

          window.scrollTo({
            top: request.y || 0,
            behavior: 'smooth'
          });
          sendResponse({ success: true });
          break;

        case 'scroll_to_element':
          const scrollEl = await waitForElement(request.selector);
          scrollEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (error) {
      console.error('[Content] Action failed:', error);
      sendResponse({ error: error.message });
    }
  };

  handleAction();
  return true; // Keep channel open for async sendResponse
});
