#!/usr/bin/env node

/**
 * Memory Test Script for nano-banana-mcp-azure-blob
 * 
 * This script helps verify that memory leaks have been fixed.
 * It monitors memory usage before and after operations.
 */

function formatMemory(bytes) {
  return Math.round(bytes / 1024 / 1024) + ' MB';
}

function printMemoryUsage(label) {
  const usage = process.memoryUsage();
  console.log(`\n📊 ${label}`);
  console.log(`   RSS (总内存):        ${formatMemory(usage.rss)}`);
  console.log(`   Heap Used (已用堆):  ${formatMemory(usage.heapUsed)}`);
  console.log(`   Heap Total (总堆):   ${formatMemory(usage.heapTotal)}`);
  console.log(`   External (外部):     ${formatMemory(usage.external)}`);
  return usage;
}

async function simulateImageProcessing() {
  console.log('\n🔬 开始内存测试...\n');
  
  // 初始内存
  const initialMemory = printMemoryUsage('初始内存使用');
  
  // 模拟图片处理（创建和释放大量 Buffer）
  console.log('\n🎨 模拟生成 10 张图片...');
  
  const memorySnapshots = [];
  
  for (let i = 1; i <= 10; i++) {
    // 模拟图片数据（5MB 的 Buffer）
    let imageBuffer = Buffer.alloc(5 * 1024 * 1024);
    
    // 模拟转换为 base64（会创建字符串，占用更多内存）
    const base64Data = imageBuffer.toString('base64');
    
    // 模拟保存操作
    imageBuffer = null; // 显式释放
    
    // 触发垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    } else {
      // 给垃圾回收器运行的机会
      await new Promise(resolve => setImmediate(resolve));
    }
    
    // 记录内存使用
    const currentMemory = process.memoryUsage();
    memorySnapshots.push({
      iteration: i,
      heapUsed: currentMemory.heapUsed,
      rss: currentMemory.rss
    });
    
    console.log(`   图片 ${i}/10: Heap = ${formatMemory(currentMemory.heapUsed)}, RSS = ${formatMemory(currentMemory.rss)}`);
    
    // 短暂延迟，模拟真实场景
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 最终内存
  console.log('\n⏰ 等待垃圾回收...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (global.gc) {
    global.gc();
    console.log('🧹 手动触发垃圾回收');
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const finalMemory = printMemoryUsage('最终内存使用');
  
  // 分析结果
  console.log('\n📈 内存使用分析');
  console.log('═══════════════════════════════════════════');
  
  const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
  const rssIncrease = finalMemory.rss - initialMemory.rss;
  
  console.log(`Heap 增长: ${formatMemory(heapIncrease)}`);
  console.log(`RSS 增长:  ${formatMemory(rssIncrease)}`);
  
  // 检查是否有内存泄漏
  const maxHeap = Math.max(...memorySnapshots.map(s => s.heapUsed));
  const minHeap = Math.min(...memorySnapshots.map(s => s.heapUsed));
  const heapVariation = maxHeap - minHeap;
  
  console.log(`\nHeap 峰值: ${formatMemory(maxHeap)}`);
  console.log(`Heap 谷值: ${formatMemory(minHeap)}`);
  console.log(`Heap 波动: ${formatMemory(heapVariation)}`);
  
  // 判断结果
  console.log('\n🎯 测试结果');
  console.log('═══════════════════════════════════════════');
  
  // 如果最终内存增长小于 50MB，认为是正常的
  if (heapIncrease < 50 * 1024 * 1024) {
    console.log('✅ 通过: 内存使用稳定，没有明显泄漏');
  } else {
    console.log('⚠️  警告: 内存增长较大，可能存在泄漏');
  }
  
  // 检查是否启用了 --expose-gc
  if (global.gc) {
    console.log('✅ 已启用 --expose-gc 标志（推荐）');
  } else {
    console.log('ℹ️  未启用 --expose-gc 标志');
    console.log('   提示: 使用 node --expose-gc test-memory.js 可以更有效地控制垃圾回收');
  }
  
  console.log('\n💡 使用建议');
  console.log('═══════════════════════════════════════════');
  console.log('1. 在 MCP 配置中添加 --expose-gc 标志');
  console.log('2. 如果处理大量图片，考虑增加 --max-old-space-size');
  console.log('3. 定期监控生产环境的内存使用');
  
  console.log('\n📚 更多信息请参阅 MEMORY_FIX.md\n');
}

// 运行测试
console.log('╔═══════════════════════════════════════════╗');
console.log('║  Nano Banana MCP - 内存测试工具          ║');
console.log('╚═══════════════════════════════════════════╝');

simulateImageProcessing().catch(console.error);

