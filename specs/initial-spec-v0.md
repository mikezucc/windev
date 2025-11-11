# Windev - Design Specification

**Version:** 1.0.0
**Created:** November 2025
**Project Type:** Standalone Electron Application

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Models](#data-models)
5. [IPC Communication](#ipc-communication)
6. [User Interface](#user-interface)
7. [File Structure](#file-structure)
8. [Technologies](#technologies)
9. [Usage Workflow](#usage-workflow)
10. [Build & Deployment](#build--deployment)

---

## Overview

### Purpose
Windev is a standalone Electron application designed to manage and launch browser windows for local web services with integrated Claude Code terminal sessions. It enables developers to open multiple independent browser+terminal windows, each tied to a specific web service and project directory.

### Key Goals
- **Simplicity**: Minimal UI focused on core functionality
- **Independence**: Each browser window has its own terminal session
- **Persistence**: Services and preferences saved locally
- **Isolation**: Completely standalone with no external dependencies (no VM/orchestrator)

### Use Cases
1. Developer opens multiple local web services (e.g., frontend on :3000, backend on :4000)
2. Each service gets a browser window with webview + Claude Code terminal
3. Terminal auto-initializes in the project's repository directory
4. Multiple windows can be opened simultaneously, all independent

---

## Architecture

### Process Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐                                          │
│  │  Main Process  │ (Node.js)                                │
│  │   (main.ts)    │                                          │
│  └────────┬───────┘                                          │
│           │                                                   │
│           ├──> browserManager (manages browser windows)      │
│           ├──> shellManager (manages PTY sessions)           │
│           ├──> store (electron-store for persistence)        │
│           └──> IPC handlers (service CRUD, shell ops)        │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────┐                  │
│  │         Renderer Process #1            │                  │
│  │      Main Window (Service List)        │                  │
│  │         React + Material-UI            │                  │
│  └────────────────────────────────────────┘                  │
│                                                               │
│  ┌────────────────────────────────────────┐                  │
│  │         Renderer Process #2            │                  │
│  │     Browser Window #1 (Service A)      │                  │
│  │   ┌──────────┐      ┌──────────────┐   │                  │
│  │   │ Webview  │      │ Claude Term  │   │                  │
│  │   │ (URL)    │      │ (xterm.js)   │   │                  │
│  │   └──────────┘      └──────────────┘   │                  │
│  └────────────────────────────────────────┘                  │
│                                                               │
│  ┌────────────────────────────────────────┐                  │
│  │         Renderer Process #3            │                  │
│  │     Browser Window #2 (Service B)      │                  │
│  │   ┌──────────┐      ┌──────────────┐   │                  │
│  │   │ Webview  │      │ Claude Term  │   │                  │
│  │   │ (URL)    │      │ (xterm.js)   │   │                  │
│  │   └──────────┘      └──────────────┘   │                  │
│  └────────────────────────────────────────┘                  │
│                                                               │
│  (Additional browser windows as needed...)                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Security Model
- **Context Isolation**: Enabled for all renderer processes
- **Node Integration**: Disabled (security best practice)
- **Preload Scripts**: Act as secure IPC bridge via contextBridge
- **Webview Tag**: Enabled for embedding web content
- **Sandbox**: Disabled (required for webview functionality)

---

## Core Components

### 1. Main Process Components

#### `main.ts` (218 lines)
- **Responsibility**: Application lifecycle and IPC coordination
- **Key Functions**:
  - `createMainWindow()`: Creates service list window
  - IPC handlers for service CRUD operations
  - IPC handlers for Claude shell operations
  - Event forwarding from shellManager to browserManager
- **External Dependencies**: electron, store, browserManager, shellManager

#### `browserManager.ts` (200 lines)
- **Responsibility**: Manages browser window lifecycle
- **Key Functions**:
  - `createBrowserWindow(options)`: Creates new browser window with webview
  - `sendShellOutputToWindow(windowId, shellId, data)`: Routes shell output
  - `closeWindow(windowId)`: Closes specific window
  - `closeAllWindows()`: Cleanup on app quit
- **Data Structure**:
  ```typescript
  interface BrowserWindowInfo {
    id: string;
    window: BrowserWindow;
    url: string;
    serviceId: string;
    shellId?: string;
  }
  ```

#### `shellManager.ts` (207 lines)
- **Responsibility**: Manages PTY (pseudo-terminal) sessions
- **Key Functions**:
  - `createShell(repoPath, windowId)`: Spawns PTY with Claude Code
  - `writeToShell(shellId, input)`: Sends user input to terminal
  - `resizeShell(shellId, cols, rows)`: Handles terminal resize
  - `destroyShell(shellId)`: Cleanup on window close
- **Technology**: node-pty for full terminal emulation
- **Features**:
  - Auto-runs `claude` command on initialization
  - Proper PATH setup including nvm, homebrew, cargo
  - Per-window shell sessions (not shared)

#### `store.ts` (30 lines)
- **Responsibility**: Persistent data storage
- **Technology**: electron-store
- **Schema**:
  ```typescript
  interface StoreSchema {
    services: Service[];
    themeMode: 'light' | 'dark' | 'system';
    windowBounds: { width, height, x?, y? };
  }
  ```

### 2. Renderer Process Components

#### Main Window (`renderer/main/`)
- **App.tsx** (222 lines): Service management UI
  - Service list with CRUD operations
  - Dialog for adding/editing services
  - Material-UI components for consistent design
  - Calls `electronAPI.openBrowserWindow()` to launch browsers

#### Browser Window (`renderer/browser/`)
- **BrowserPage.tsx** (131 lines): Browser + terminal layout
  - Navigation bar (back, forward, refresh, URL bar)
  - Webview for displaying web service
  - Claude terminal panel (475px wide, right side)
  - Listens for IPC events: `load-url`, `set-shell-id`, `set-webview-preload`

#### Components (`renderer/components/`)
- **ClaudeShellPanel.tsx** (131 lines): Terminal UI component
  - Uses xterm.js for terminal emulation
  - FitAddon for responsive sizing
  - WebLinksAddon for clickable URLs
  - Handles terminal I/O via IPC

### 3. Preload Scripts

#### `mainPreload.ts` (24 lines)
- **Context**: Main service list window
- **Exposed API**: `window.electronAPI`
  - Service operations: get, add, update, remove
  - Browser window: open
  - Utility: select directory, theme mode

#### `browserPreload.ts` (79 lines)
- **Context**: Browser windows
- **Exposed API**: `window.browserAPI`
  - Shell operations: write, destroy, resize
  - Shell events: onOutput, onError, onExit
  - Webview setup: onLoadUrl, onSetWebviewPreload

#### `webviewPreload.ts` (199 lines)
- **Context**: Injected into webview content
- **Purpose**: Capture console and network activity
- **Features**:
  - Intercepts `fetch()` and `XMLHttpRequest`
  - Captures console.log, error, warn, etc.
  - Tracks network requests with timing
  - Forwards to parent window via `__networkLog()`

---

## Data Models

### Service
```typescript
interface Service {
  id: string;                    // Unique identifier
  name: string;                  // Display name (e.g., "My App")
  url: string;                   // Service URL (e.g., "http://localhost:3000")
  repoPath: string;              // Local project directory path
  windowPrefs: WindowPreferences;
}
```

### WindowPreferences
```typescript
interface WindowPreferences {
  width: number;                 // Default: 1400
  height: number;                // Default: 900
  x?: number;                    // Optional window position
  y?: number;
}
```

### BrowserWindowOptions
```typescript
interface BrowserWindowOptions {
  serviceId: string;
  url: string;
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  repoPath: string;
}
```

### Shell Events
```typescript
interface ClaudeShellOutputData {
  shellId: string;
  data: string;                  // Raw terminal output
}

interface ClaudeShellErrorData {
  shellId: string;
  error: string;
}

interface ClaudeShellExitData {
  shellId: string;
  exitCode: number;
}
```

---

## IPC Communication

### Channel Definitions
All IPC channels defined in `src/shared/ipc-channels.ts`:

#### Service Management
- `GET_SERVICES`: Retrieve all saved services
- `ADD_SERVICE`: Create new service
- `UPDATE_SERVICE`: Modify existing service
- `REMOVE_SERVICE`: Delete service

#### Browser Window
- `OPEN_BROWSER_WINDOW`: Launch new browser window
- `BUILDER_BROWSER_CLOSED`: Notify when window closes
- `BUILDER_CONSOLE_MESSAGE`: Forward webview console logs

#### Claude Shell
- `CLAUDE_SHELL_CREATE`: Spawn new PTY session
- `CLAUDE_SHELL_WRITE`: Send input to terminal
- `CLAUDE_SHELL_OUTPUT`: Receive terminal output
- `CLAUDE_SHELL_ERROR`: Receive error messages
- `CLAUDE_SHELL_EXIT`: Notify when shell exits
- `CLAUDE_SHELL_DESTROY`: Kill PTY session
- `CLAUDE_SHELL_RESIZE`: Update terminal dimensions

#### Utility
- `SELECT_DIRECTORY`: Open native folder picker
- `OPEN_EXTERNAL_URL`: Open URL in default browser
- `COPY_TO_CLIPBOARD`: Copy text to system clipboard
- `GET_THEME_MODE` / `SET_THEME_MODE`: Theme preferences

### Communication Flow Example

**Opening a Browser Window:**
```
1. User clicks "Open" in main window (App.tsx)
2. Calls: electronAPI.openBrowserWindow(options)
3. Main process: IpcChannels.OPEN_BROWSER_WINDOW handler
4. browserManager.createBrowserWindow(options)
5. Creates BrowserWindow with browserPreload.ts
6. Loads browser.html (BrowserPage component)
7. shellManager.createShell(repoPath, windowId)
8. Main sends: 'load-url', 'set-shell-id', 'set-webview-preload'
9. BrowserPage receives events and configures webview + terminal
10. Terminal output flows: PTY → shellManager → browserManager → specific window
```

---

## User Interface

### Main Window (Service List)
```
┌─────────────────────────────────────────────────┐
│  Windev Services                    [+ Add]     │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ My Frontend App                 [🗗][✎][🗑]│ │
│  │ http://localhost:3000                      │ │
│  │ /Users/dev/projects/my-app                 │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ API Server                      [🗗][✎][🗑]│ │
│  │ http://localhost:4000                      │ │
│  │ /Users/dev/projects/api-server             │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
└─────────────────────────────────────────────────┘
```

**Actions:**
- 🗗 (Open): Launches browser window
- ✎ (Edit): Modifies service settings
- 🗑 (Delete): Removes service
- + Add: Opens dialog to create new service

### Browser Window
```
┌───────────────────────────────────────────────────────────────────┐
│ [←][→][↻]  [http://localhost:3000                              ]  │
├───────────────────────────────────┬───────────────────────────────┤
│                                   │ Claude Code Terminal          │
│                                   ├───────────────────────────────┤
│                                   │ $ cd /Users/dev/my-app        │
│          Webview                  │ $ claude                      │
│     (Web Service Content)         │ Welcome to Claude Code!       │
│                                   │ How can I help you today?     │
│                                   │                               │
│                                   │ >                             │
│                                   │                               │
│                                   │                               │
└───────────────────────────────────┴───────────────────────────────┘
```

**Layout:**
- Left (flex): Webview displaying the web service
- Right (475px): Claude Code terminal panel

---

## File Structure

```
windev/
├── src/
│   ├── main/                           # Electron Main Process (Node.js)
│   │   ├── main.ts                     # App entry, IPC handlers
│   │   ├── browserManager.ts           # Window lifecycle management
│   │   ├── shellManager.ts             # PTY session management
│   │   └── store.ts                    # electron-store configuration
│   │
│   ├── renderer/                       # React UI (Browser contexts)
│   │   ├── main/                       # Main service list window
│   │   │   ├── App.tsx                 # Service CRUD UI
│   │   │   └── index.tsx               # React root
│   │   ├── browser/                    # Browser windows
│   │   │   ├── BrowserPage.tsx         # Webview + terminal layout
│   │   │   └── index.tsx               # React root
│   │   ├── components/                 # Shared React components
│   │   │   └── ClaudeShellPanel.tsx    # Terminal component
│   │   ├── index.html                  # Main window template
│   │   └── browser.html                # Browser window template
│   │
│   ├── preload/                        # IPC Bridge Scripts
│   │   ├── mainPreload.ts              # For main window
│   │   ├── browserPreload.ts           # For browser windows
│   │   └── webviewPreload.ts           # Injected into webviews
│   │
│   └── shared/                         # Shared TypeScript types
│       └── ipc-channels.ts             # IPC enum + interfaces
│
├── dist/                               # Build output (generated)
│   ├── main/                           # Compiled main process
│   ├── renderer/                       # Compiled renderer bundles
│   └── preload/                        # Compiled preload scripts
│
├── assets/                             # App icons and resources
├── node_modules/                       # Dependencies
│
├── package.json                        # NPM configuration
├── package-lock.json                   # Dependency lock file
│
├── tsconfig.json                       # Base TypeScript config
├── tsconfig.main.json                  # Main process TS config
├── tsconfig.renderer.json              # Renderer process TS config
│
├── webpack.main.config.js              # Main process bundler
├── webpack.renderer.config.js          # Renderer bundler (2 entries)
├── webpack.preload.config.js           # Preload bundler (3 entries)
│
└── DESIGN_SPEC.md                      # This document
```

---

## Technologies

### Core Framework
- **Electron** `^28.1.3`: Cross-platform desktop app framework
- **React** `^18.2.0`: UI library for renderer processes
- **TypeScript** `^5.3.3`: Type-safe JavaScript

### UI Components
- **Material-UI** `^5.15.6`: React component library
- **@emotion/react** `^11.11.3`: CSS-in-JS styling
- **@mui/icons-material** `^5.15.6`: Material Design icons

### Terminal
- **node-pty** `1.1.0-beta34`: PTY (pseudo-terminal) for Node.js
- **@xterm/xterm** `^5.5.0`: Terminal emulator for the browser
- **@xterm/addon-fit** `^0.10.0`: Auto-sizing terminal
- **@xterm/addon-web-links** `^0.11.0`: Clickable URLs in terminal

### Data Storage
- **electron-store** `^8.1.0`: Persistent local storage

### Build Tools
- **webpack** `^5.99.9`: Module bundler
- **ts-loader** `^9.5.2`: TypeScript loader for webpack
- **electron-builder** `^24.9.1`: Package and distribute Electron apps

---

## Usage Workflow

### Initial Setup
1. **Install Dependencies**
   ```bash
   cd windev
   npm install
   ```

2. **Build Application**
   ```bash
   npm run build
   ```

3. **Run Application**
   ```bash
   npm start
   ```

### Adding a Service

1. Click **"Add Service"** button in main window
2. Fill in service details:
   - **Name**: Friendly display name (e.g., "My App")
   - **URL**: Local web service URL (e.g., `http://localhost:3000`)
   - **Repository Path**: Click "Browse" to select project directory
   - **Window Dimensions**: Set preferred width/height (default: 1400x900)
3. Click **"Add"** to save

### Opening a Browser Window

1. In the service list, click the **🗗 (Open)** button
2. A new window opens containing:
   - **Webview**: Loads the specified URL
   - **Terminal**: Auto-starts Claude Code in the repository directory
3. Navigate and interact with both the webview and terminal

### Working with Multiple Windows

- Open as many browser windows as needed
- Each window is independent:
  - Separate webview instance
  - Dedicated terminal session
  - Independent state
- Windows can be managed individually
- Closing a window automatically cleans up its terminal session

### Editing/Deleting Services

- **Edit**: Click **✎** button, modify fields, click "Save"
- **Delete**: Click **🗑** button, confirm deletion

---

## Build & Deployment

### Development Build
```bash
npm run build:dev        # Development mode with eval-source-map
npm run dev              # Build + run in development mode
```

### Production Build
```bash
npm run build:prod       # Production mode with source-map
npm start                # Build + run in production mode
```

### Distribution Packages
```bash
npm run dist             # Package for current platform
npm run dist:mac         # macOS .dmg / .app
npm run dist:win         # Windows installer
npm run dist:linux       # Linux AppImage
```

### Native Module Rebuilding
```bash
npm run rebuild          # Rebuild all native modules
npm run rebuild:node-pty # Rebuild only node-pty
```

**Note**: Native modules (like node-pty) must be rebuilt for the Electron version. This happens automatically via `postinstall` script.

---

## Configuration

### electron-builder (package.json)
```json
{
  "build": {
    "appId": "com.windev.app",
    "productName": "Windev",
    "files": ["dist/**/*", "assets/**/*"],
    "mac": {
      "category": "public.app-category.developer-tools",
      "icon": "assets/icon.icns"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "linux": {
      "target": "AppImage",
      "icon": "assets/icon.png"
    }
  }
}
```

### TypeScript Configuration
- **Base**: ES2022, strict mode, JSX support
- **Main**: CommonJS modules for Node.js compatibility
- **Renderer**: ES2022 modules for modern browsers

### Webpack Configuration
- **Main**: Targets electron-main, externalizes node_modules
- **Renderer**: Targets electron-renderer, 2 entry points (main, browser)
- **Preload**: Targets electron-preload, 3 entry points (mainPreload, browserPreload, webviewPreload)

---

## Design Decisions

### Why Independent Shell Sessions Per Window?
- **User Request**: Per-window terminals as specified
- **Isolation**: Each service/repo gets its own Claude Code instance
- **Flexibility**: Users can work on different projects simultaneously
- **Simplicity**: No complex shared state or terminal multiplexing

### Why No Shared Infrastructure?
- **Standalone Goal**: Complete independence from original VM/orchestrator system
- **Simplicity**: Easier to maintain and distribute
- **Use Case**: Focused on local development, not remote VMs

### Why Webview Instead of BrowserView?
- **Maturity**: Webview is stable and well-documented
- **Preload Support**: Easy injection of console capture scripts
- **Isolation**: Clear separation between app and embedded content

### Why electron-store Instead of Custom Storage?
- **Battle-tested**: Widely used, reliable
- **Type-safe**: Good TypeScript support
- **Features**: Automatic encryption, schema validation, migration support

---

## Future Enhancements

### Potential Features (Not Implemented)
- **Tabbed Interface**: Multiple services in one window with tabs
- **Custom Themes**: User-configurable color schemes
- **Service Groups**: Organize services by project
- **Environment Variables**: Per-service environment configuration
- **Port Auto-detection**: Automatically discover running local services
- **Screenshot/Recording**: Capture webview content (feature existed in original)
- **Git Integration**: Show repo status in terminal panel
- **Service Templates**: Predefined service configurations

---

## Troubleshooting

### Common Issues

**1. node-pty fails to build**
```bash
npm run clean:rebuild    # Clean and rebuild native modules
```

**2. Terminal doesn't start**
- Verify repository path exists and is accessible
- Check that `claude` command is in PATH
- Review Electron console for error messages

**3. Webview doesn't load**
- Verify URL is accessible (test in regular browser)
- Check Content Security Policy in browser.html
- Ensure webview preload path is correct

**4. Multiple terminal sessions interfere**
- This shouldn't happen (per-window design)
- If it does, check shellManager for windowId tracking

---

## Version History

### v1.0.0 (November 2025)
- Initial release
- Core functionality: service management, browser windows, terminal integration
- Extracted from original Facet Desktop project
- Standalone Electron app with no external dependencies

---

## Credits

**Extracted from**: Facet Desktop Application
**Architecture**: Electron multi-process model
**UI Framework**: React + Material-UI
**Terminal**: node-pty + xterm.js
**Created by**: Claude Code (Anthropic)

---

## License

MIT License
