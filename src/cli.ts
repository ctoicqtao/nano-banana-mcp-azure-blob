#!/usr/bin/env node

/**
 * CLI Wrapper for nano-banana-mcp-azure-blob
 * 
 * This wrapper automatically enables --expose-gc flag if not already enabled
 * to ensure optimal memory management.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if --expose-gc is already enabled
if (typeof global.gc === 'function') {
  // GC is available, run the main program
  await import('./index.js');
} else {
  // GC is not available, restart with --expose-gc
  const mainScript = join(__dirname, 'index.js');
  
  // Get all arguments except node and script path
  const args = process.argv.slice(2);
  
  // Spawn new process with --expose-gc flag
  const child = spawn(
    process.execPath, // node executable path
    ['--expose-gc', mainScript, ...args],
    {
      stdio: 'inherit', // Inherit stdin, stdout, stderr
      env: process.env, // Inherit environment variables
    }
  );
  
  // Handle exit
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  // Handle signals
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

