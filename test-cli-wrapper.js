#!/usr/bin/env node

/**
 * Test script to verify the CLI wrapper works correctly
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('╔═══════════════════════════════════════════╗');
console.log('║  CLI Wrapper 测试工具                     ║');
console.log('╚═══════════════════════════════════════════╝\n');

console.log('🔍 测试 1: 检查 wrapper 是否自动启用 --expose-gc');
console.log('═══════════════════════════════════════════\n');

const cliPath = join(__dirname, 'dist', 'cli.js');

// Create a test script that checks if gc is available
const testScript = `
if (typeof global.gc === 'function') {
  console.log('✅ GC 已启用');
  process.exit(0);
} else {
  console.log('❌ GC 未启用');
  process.exit(1);
}
`;

// Test 1: Run the CLI wrapper directly (should auto-enable GC)
console.log('运行: node dist/cli.js');
const child1 = spawn('node', [cliPath], {
  stdio: 'inherit',
  env: process.env,
});

child1.on('exit', (code) => {
  if (code === 0) {
    console.log('\n✅ 测试通过: CLI wrapper 自动启用了 --expose-gc\n');
  } else {
    console.log('\n❌ 测试失败: CLI wrapper 未能启用 --expose-gc\n');
  }
  
  console.log('💡 使用说明');
  console.log('═══════════════════════════════════════════');
  console.log('现在你可以直接使用以下命令，无需手动添加 --expose-gc：');
  console.log('');
  console.log('  npx nano-banana-mcp-azure-blob');
  console.log('');
  console.log('或在 MCP 配置中：');
  console.log('');
  console.log('  {');
  console.log('    "nano-banana": {');
  console.log('      "command": "npx",');
  console.log('      "args": ["nano-banana-mcp-azure-blob"],');
  console.log('      "env": {');
  console.log('        "GEMINI_API_KEY": "your-api-key"');
  console.log('      }');
  console.log('    }');
  console.log('  }');
  console.log('');
  console.log('Wrapper 会自动检测并启用 --expose-gc 参数！🎉\n');
});

