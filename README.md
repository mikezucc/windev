# Windev

A local development browser with integrated AI coding assistants.

## Overview

Windev is an Electron application that manages browser windows for local development services. Each service configuration includes a URL, repository path, and shell command preference. When opened, a browser window launches with an embedded webview and an integrated terminal running either Claude Code or Codex.

## Architecture

The application consists of three main components: a services manager (main window), browser windows with embedded webviews, and PTY-backed terminal sessions. Services are persisted using electron-store. The browser manager handles window lifecycle and coordinates shell sessions through the shell manager.

Each browser window contains a webview for navigation, a debug output panel for console messages, and a terminal panel running the configured AI coding assistant. The webview uses a custom preload script to capture network requests and console output, which are forwarded to the debug panel.

## Features

The browser includes standard navigation controls, URL history, screenshot and video recording capabilities, and responsive testing tools with device presets. The debug output panel filters console messages by type (errors, warnings, info, log, debug) and supports text search. The terminal integrates xterm.js with proper PTY handling for interactive shell sessions.

Services can be configured to launch either Claude Code or Codex on startup. Window dimensions are configurable per service and persist between sessions.

## User Interface

The application uses a clean, typographic editorial light theme with system fonts and minimal visual effects. The services page displays each project as a separate bordered card without shadows. File paths replace the home directory with tilde notation for cleaner presentation. The terminal maintains a dark theme for optimal coding visibility.

## Technical Challenges

### TypeScript Migration from Legacy Project

The browser page and shell panel components were ported from a previous project with different architecture. This required renaming all API references from `builderAPI` to `browserAPI`, removing repository selection logic in favor of single-service architecture, and eliminating unused concepts like organizations and moments API. Multiple missing components (DebugOutputPanel, ResponsiveSizeSelector, CreateMomentModal) had to be created from scratch. The webm-writer library required custom type declarations.

### Terminal Display Issues

The xterm.js terminal initially had problems with carriage return handling. Claude Code uses ANSI escape sequences with carriage returns to update progress lines in place, but aggressive auto-scrolling was interfering with cursor positioning. The solution was to remove forced scrollToBottom calls and set `convertEol: false` to preserve raw PTY control sequences.

### Line Wrapping and Backspace Behavior

Long terminal inputs that wrapped to multiple lines had incorrect cursor positioning on backspace. This occurred because the PTY dimensions were initialized at 80x30 but the actual terminal UI was larger. The fix involved immediately resizing the PTY when the shell ID is received, ensuring dimension synchronization before any user interaction.

### IPC Argument Mismatch

The shell resize IPC handler expected a `ClaudeShellResizeData` object but the preload script was sending individual arguments. This caused resize operations to fail with undefined shellId errors. The fix required wrapping the arguments in an object: `{ shellId, cols, rows }`.

### Webview Height Expansion

The webview element was not filling vertical space because its internal iframe (inside the shadow root) had `flex: 1 1 auto` styling. This required JavaScript access to the shadow root to directly override the iframe styles with `flex: 'none'` and explicit height/width percentages.

### Execute Command Focus Issue

The "Attempt to fix" button in the debug panel would send commands to the terminal, but they wouldn't execute until the user manually clicked the terminal and pressed enter. The PTY wasn't receiving input because focus remained on the button. The solution added explicit terminal focus with a brief delay before sending the command.

### Electron Security Warnings

The webview triggered Content Security Policy warnings because it loads arbitrary user-specified URLs. This is expected for a development browser tool. The warnings were suppressed by setting `ELECTRON_DISABLE_SECURITY_WARNINGS` and injecting permissive CSP headers via the session's webRequest handler.
