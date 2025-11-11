// Preload script for webview to capture network requests and console logs
// This runs in the webview context and captures all console and network activity

// Log that preload script is running
console.log('[Webview Preload] Script loaded and running');

// Store original fetch and XMLHttpRequest
const originalFetch = window.fetch;
const OriginalXHR = window.XMLHttpRequest;

// Override fetch to log network requests
window.fetch = function(...args: Parameters<typeof fetch>): Promise<Response> {
  const [url, options = {}] = args;
  const startTime = Date.now();

  // Log the request
  (window as any).__networkLog(`[Network] ${options.method || 'GET'} ${url}`, {
    type: 'info',
    source: 'network-fetch',
    url,
    method: options.method || 'GET',
    requestType: 'fetch'
  });

  // Call original fetch and log response
  return originalFetch.apply(this, args)
    .then(response => {
      const duration = Date.now() - startTime;
      const status = response.status;
      const statusText = response.statusText;

      let messageType: 'info' | 'error' | 'warning' = 'info';
      if (status >= 400) {
        messageType = 'error';
      } else if (status >= 300) {
        messageType = 'warning';
      }

      (window as any).__networkLog(
        `[Network] ${options.method || 'GET'} ${url} - ${status} ${statusText} (${duration}ms)`,
        {
          type: messageType,
          source: 'network-fetch',
          url,
          method: options.method || 'GET',
          status,
          statusText,
          duration,
          requestType: 'fetch'
        }
      );

      return response;
    })
    .catch(error => {
      const duration = Date.now() - startTime;

      (window as any).__networkLog(
        `[Network] ${options.method || 'GET'} ${url} - Failed: ${error.message} (${duration}ms)`,
        {
          type: 'error',
          source: 'network-fetch',
          url,
          method: options.method || 'GET',
          error: error.message,
          duration,
          requestType: 'fetch'
        }
      );

      throw error;
    });
};

// Override XMLHttpRequest to log network requests
(window as any).XMLHttpRequest = function(this: any) {
  const xhr = new OriginalXHR();

  let method: string;
  let url: string;
  let startTime: number;

  const originalOpen = xhr.open;
  (xhr as any).open = function(this: XMLHttpRequest, methodArg: string, urlArg: string | URL, async?: boolean, username?: string | null, password?: string | null) {
    method = methodArg;
    url = urlArg.toString();
    return originalOpen.call(this, methodArg, urlArg, async !== undefined ? async : true, username, password);
  };

  const originalSend = xhr.send;
  (xhr as any).send = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    startTime = Date.now();

    (window as any).__networkLog(`[Network] ${method} ${url}`, {
      type: 'info',
      source: 'network-xhr',
      url,
      method,
      requestType: 'xhr'
    });

    xhr.addEventListener('load', function() {
      const duration = Date.now() - startTime;
      const status = xhr.status;
      const statusText = xhr.statusText;

      let messageType: 'info' | 'error' | 'warning' = 'info';
      if (status >= 400) {
        messageType = 'error';
      } else if (status >= 300) {
        messageType = 'warning';
      }

      (window as any).__networkLog(
        `[Network] ${method} ${url} - ${status} ${statusText} (${duration}ms)`,
        {
          type: messageType,
          source: 'network-xhr',
          url,
          method,
          status,
          statusText,
          duration,
          requestType: 'xhr'
        }
      );
    });

    xhr.addEventListener('error', function() {
      const duration = Date.now() - startTime;

      (window as any).__networkLog(
        `[Network] ${method} ${url} - Failed: Network error (${duration}ms)`,
        {
          type: 'error',
          source: 'network-xhr',
          url,
          method,
          error: 'Network error',
          duration,
          requestType: 'xhr'
        }
      );
    });

    return originalSend.call(this, body);
  };

  return xhr;
};

// Capture regular console messages
const consoleTypes = ['log', 'error', 'warn', 'info', 'debug'] as const;
consoleTypes.forEach(type => {
  const original = console[type];
  (console as any)[type] = function(...args: any[]) {
    original.apply(console, args);

    try {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          return JSON.stringify(arg);
        }
        return String(arg);
      }).join(' ');

      (window as any).__networkLog(message, {
        type: type === 'warn' ? 'warning' : type,
        source: 'console'
      });
    } catch (e) {
      // Ignore errors in logging
    }
  };
});

// Listen for uncaught errors
window.addEventListener('error', (event) => {
  (window as any).__networkLog(`Uncaught Error: ${event.message}`, {
    type: 'error',
    source: event.filename || 'unknown',
    lineNumber: event.lineno,
    columnNumber: event.colno
  });
});

// Listen for unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  (window as any).__networkLog(`Unhandled Promise Rejection: ${event.reason}`, {
    type: 'error',
    source: 'promise'
  });
});
