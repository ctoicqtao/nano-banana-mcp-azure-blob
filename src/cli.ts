#!/usr/bin/env node

/**
 * CLI Wrapper for nano-banana-mcp-azure-blob
 * 
 * This wrapper automatically enables optimal Node.js flags for memory management:
 * - --expose-gc: Allow manual garbage collection
 * - --max-old-space-size: Set appropriate heap size based on environment
 * - --optimize-for-size: Optimize for memory usage rather than speed
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if we need to restart with optimized flags
const needsRestart = typeof global.gc !== 'function';

if (!needsRestart) {
  // Optimized flags already applied, run the main program
  await import('./index.js');
} else {
  // Restart with optimized Node.js flags
  const mainScript = join(__dirname, 'index.js');
  
  // Get all arguments except node and script path
  const args = process.argv.slice(2);
  
  // Determine optimal memory settings
  // Default to 512MB, can be overridden by NODE_OPTIONS
  const maxOldSpaceSize = process.env.MAX_OLD_SPACE_SIZE || '512';
  
  // Build node flags for optimal memory management
  const nodeFlags = [
    '--expose-gc',                      // Enable manual GC
    `--max-old-space-size=${maxOldSpaceSize}`, // Limit heap size
    '--optimize-for-size',              // Optimize for memory over speed
  ];
  
  console.log(`🚀 Starting with optimized memory settings (heap limit: ${maxOldSpaceSize}MB)...`);
  
  // Spawn new process with optimized flags
  const child = spawn(
    process.execPath,
    [...nodeFlags, mainScript, ...args],
    {
      stdio: 'inherit',
      env: process.env,
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

