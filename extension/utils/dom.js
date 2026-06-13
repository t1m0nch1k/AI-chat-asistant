/**
 * DOM Utilities for the AI Browser Assistant.
 */
export const DOMUtils = {
  /**
   * Helper to wait for an element to appear in the DOM.
   */
  async waitForElement(selector, timeout = 10000) {
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
  },

  /**
   * Generates a CSS selector that uniquely identifies an element.
   */
  generateUniqueSelector(el) {
    if (el.id) return `#${el.id}`;
    
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
      let selector = el.nodeName.toLowerCase();
      if (el.className) {
        selector += `.${el.className.trim().split(/\s+/).join('.')}`;
      }
      
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
};
