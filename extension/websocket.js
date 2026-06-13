/**
 * WebSocketManager handles the connection and communication with the local AI server.
 */
export class WebSocketManager {
  constructor(url = 'ws://localhost:8000') {
    this.url = url;
    this.socket = null;
    this.reconnectInterval = 5000;
    this.listeners = new Set();
    this.isConnected = false;
  }

  /**
   * Establishes a WebSocket connection.
   */
  connect() {
    console.log(`[WS] Connecting to ${this.url}...`);
    try {
      this.socket = new WebSocket(this.url);
      this.isConnected = false;

      this.socket.onopen = () => {
        console.log('[WS] Connected to AI server');
        this.isConnected = true;
        this.notifyListeners('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message received:', data);
          this.notifyListeners('message', data);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      this.socket.onclose = () => {
        console.log('[WS] Connection closed. Attempting reconnect...');
        this.isConnected = false;
        this.notifyListeners('disconnected');
        setTimeout(() => this.connect(), this.reconnectInterval);
      };

      this.socket.onerror = (error) => {
        console.error('[WS] WebSocket error:', error);
      };
    } catch (e) {
      console.error('[WS] Connection failed:', e);
      setTimeout(() => this.connect(), this.reconnectInterval);
    }
  }

  /**
   * Adds a listener for WS events.
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Removes a listener for WS events.
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notifies all registered listeners about an event.
   * @param {string} type - Event type ('connected', 'disconnected', 'message')
   * @param {any} data - Event data
   */
  notifyListeners(type, data = null) {
    this.listeners.forEach(callback => callback(type, data));
  }

  /**
   * Sends a JSON message to the AI server.
   * @param {any} payload - Data to send
   */
  send(payload) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] Socket not connected. Message dropped:', payload);
    }
  }
}

// Initialize as a singleton for the background script
export const wsManager = new WebSocketManager();
