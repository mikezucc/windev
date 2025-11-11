import { EventEmitter } from 'events';
import * as pty from 'node-pty';
import * as os from 'os';
import * as path from 'path';

interface ShellInfo {
  pty: pty.IPty;
  repoPath: string;
  shellId: string;
  windowId: string;
  createdAt: Date;
}

export class ShellManager extends EventEmitter {
  private shells: Map<string, ShellInfo> = new Map();
  private shellCounter = 0;

  createShell(repoPath: string, windowId: string): string {
    const shellId = `shell-${++this.shellCounter}`;

    console.log(`Creating shell: ${shellId} for window: ${windowId}, repo: ${repoPath}`);

    try {
      // Get the shell to use (prefer zsh, fallback to bash)
      const shell = process.platform === 'win32' ? 'cmd.exe' : (process.env.SHELL || '/bin/zsh');

      // Set up proper PATH for the shell
      const homeDir = os.homedir();
      const defaultPaths = [
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        path.join(homeDir, '.nvm/versions/node/v20.19.2/bin'),
        path.join(homeDir, '.local/bin'),
        path.join(homeDir, '.cargo/bin'),
        '/opt/homebrew/bin',
        '/usr/local/opt/node@20/bin'
      ];

      // Merge with existing PATH
      const existingPath = process.env.PATH || '';
      const pathParts = existingPath.split(':').concat(defaultPaths);
      const uniquePaths = Array.from(new Set(pathParts)).filter(p => p);

      // Create a pseudo-terminal
      const shellPty = pty.spawn(shell, ['-l'], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        cwd: repoPath,
        env: {
          ...process.env,
          PATH: uniquePaths.join(':'),
          FORCE_COLOR: '1',
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          LANG: process.env.LANG || 'en_US.UTF-8',
          NODE_ENV: process.env.NODE_ENV || 'development',
          PS1: '$ ',
          BASH_XTRACEFD: '1'
        }
      });

      // Handle output from the PTY
      shellPty.onData((data: string) => {
        this.emit('output', shellId, windowId, data);
      });

      // Handle PTY exit
      shellPty.onExit(({ exitCode, signal }) => {
        console.log(`Shell ${shellId} exited with code ${exitCode}, signal ${signal}`);
        this.emit('exit', shellId, windowId, exitCode, signal ? signal.toString() : null);
        this.shells.delete(shellId);
      });

      // Store shell info
      this.shells.set(shellId, {
        pty: shellPty,
        repoPath,
        shellId,
        windowId,
        createdAt: new Date()
      });

      // Send initial message and run claude command
      setTimeout(() => {
        this.emit('output', shellId, windowId, `Claude Code shell initialized in ${repoPath}\n`);

        // Wait a bit for shell to be ready, then run claude command
        setTimeout(() => {
          console.log('Running claude command automatically...');
          shellPty.write('claude\r');
        }, 500);
      }, 100);

      return shellId;
    } catch (error) {
      console.error(`Failed to create shell ${shellId}:`, error);
      this.emit('error', shellId, windowId, `Failed to create shell: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  writeToShell(shellId: string, input: string): boolean {
    const shellInfo = this.shells.get(shellId);
    if (!shellInfo) {
      console.error(`Shell ${shellId} not found`);
      return false;
    }

    try {
      shellInfo.pty.write(input);
      console.log(`Wrote to shell ${shellId}:`, input.length, 'bytes');
      return true;
    } catch (error) {
      console.error(`Failed to write to shell ${shellId}:`, error);
      return false;
    }
  }

  destroyShell(shellId: string): boolean {
    const shellInfo = this.shells.get(shellId);
    if (!shellInfo) {
      return false;
    }

    try {
      shellInfo.pty.kill();
      this.shells.delete(shellId);
      console.log(`Destroyed shell ${shellId}`);
      return true;
    } catch (error) {
      console.error(`Failed to destroy shell ${shellId}:`, error);
      return false;
    }
  }

  destroyShellsByWindow(windowId: string): void {
    const shellsToDestroy: string[] = [];

    for (const [shellId, shellInfo] of this.shells.entries()) {
      if (shellInfo.windowId === windowId) {
        shellsToDestroy.push(shellId);
      }
    }

    shellsToDestroy.forEach(shellId => this.destroyShell(shellId));
  }

  destroyAllShells(): void {
    for (const shellId of this.shells.keys()) {
      this.destroyShell(shellId);
    }
  }

  getShellInfo(shellId: string): ShellInfo | undefined {
    return this.shells.get(shellId);
  }

  getAllShells(): string[] {
    return Array.from(this.shells.keys());
  }

  resizeShell(shellId: string, cols: number, rows: number): boolean {
    const shellInfo = this.shells.get(shellId);
    if (!shellInfo) {
      return false;
    }

    try {
      shellInfo.pty.resize(cols, rows);
      return true;
    } catch (error) {
      console.error(`Failed to resize shell ${shellId}:`, error);
      return false;
    }
  }
}

export const shellManager = new ShellManager();

// Clean up shells when app quits
if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
  try {
    const { app } = require('electron');
    app.on('before-quit', () => {
      shellManager.destroyAllShells();
    });
  } catch (e) {
    // Not in Electron main process
  }
}

// Clean up on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    shellManager.destroyAllShells();
  });

  process.on('SIGINT', () => {
    shellManager.destroyAllShells();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    shellManager.destroyAllShells();
    process.exit(0);
  });
}
