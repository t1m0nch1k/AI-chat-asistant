/**
 * Popup script to display the connection status of the AI assistant.
 */
async function updateStatus() {
  const indicator = document.getElementById('status-indicator');
  const text = document.getElementById('status-text');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'get_connection_status' });
    if (response && response.connected) {
      indicator.className = 'indicator connected';
      text.textContent = 'Connected';
    } else {
      indicator.className = 'indicator disconnected';
      text.textContent = 'Disconnected';
    }
  } catch (e) {
    indicator.className = 'indicator disconnected';
    text.textContent = 'Error';
  }
}

// Update status on load
updateStatus();

// Refresh status every 2 seconds while popup is open
setInterval(updateStatus, 2000);
