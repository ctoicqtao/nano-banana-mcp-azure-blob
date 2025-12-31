#!/usr/bin/env node

/**
 * K8s Memory Test Script
 * 
 * Simulates the memory management behavior in K8s environment
 */

// Simulate K8s environment with MAX_OLD_SPACE_SIZE
process.env.MAX_OLD_SPACE_SIZE = '400';

console.log('╔═══════════════════════════════════════════╗');
console.log('║  K8s 内存管理测试工具                     ║');
console.log('╚═══════════════════════════════════════════╝\n');

function formatMemory(bytes) {
  return Math.round(bytes / 1024 / 1024) + ' MB';
}

function printMemoryUsage(label) {
  const usage = process.memoryUsage();
  const heapUsedMB = usage.heapUsed / 1024 / 1024;
  const heapTotalMB = usage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;
  
  console.log(`\n📊 ${label}`);
  console.log(`   RSS (总内存):        ${formatMemory(usage.rss)}`);
  console.log(`   Heap Used (已用堆):  ${formatMemory(usage.heapUsed)}`);
  console.log(`   Heap Total (总堆):   ${formatMemory(usage.heapTotal)}`);
  console.log(`   Heap 使用率:         ${Math.round(usagePercent)}%`);
  console.log(`   External (外部):     ${formatMemory(usage.external)}`);
  
  return { usage, usagePercent };
}

async function simulateImageProcessing() {
  console.log('🔬 模拟 K8s 环境中的图片处理...\n');
  console.log('环境设置:');
  console.log(`   MAX_OLD_SPACE_SIZE: ${process.env.MAX_OLD_SPACE_SIZE}MB`);
  console.log(`   GC 可用: ${typeof global.gc === 'function' ? '✅' : '❌'}\n`);
  
  // 初始内存
  const { usage: initialMemory } = printMemoryUsage('初始内存使用');
  
  console.log('\n🎨 模拟处理 10 张大图片（每张 ~10MB）...');
  
  const memorySnapshots = [];
  
  for (let i = 1; i <= 10; i++) {
    // 模拟图片数据（10MB 的 Buffer）
    let imageBuffer = Buffer.alloc(10 * 1024 * 1024);
    
    // 模拟转换为 base64（会创建字符串，占用更多内存）
    let base64Data = imageBuffer.toString('base64');
    
    // 模拟 response 对象
    let response = {
      candidates: [{
        content: {
          parts: [{
            inlineData: {
              data: base64Data
            }
          }]
        }
      }]
    };
    
    // 检查内存使用率
    const beforeClean = process.memoryUsage();
    const heapUsedMB = beforeClean.heapUsed / 1024 / 1024;
    const heapTotalMB = beforeClean.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    console.log(`\n   图片 ${i}/10:`);
    console.log(`   ├─ 处理前: Heap = ${formatMemory(beforeClean.heapUsed)}, 使用率 = ${Math.round(usagePercent)}%`);
    
    // 模拟处理完成后的清理（新的优化）
    response.candidates[0].content.parts[0].inlineData.data = '';
    response = null;
    imageBuffer = null;
    base64Data = null;
    
    // 如果使用率超过 70%，触发 GC（模拟新的 checkMemoryAndGC）
    if (usagePercent > 70 && global.gc) {
      console.log(`   ├─ ⚠️  使用率超过 70%，触发 GC...`);
      global.gc();
    }
    
    // 强制多次 GC（模拟新的 forceAggressiveGC）
    if (global.gc) {
      for (let j = 0; j < 3; j++) {
        global.gc();
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // 清理后的内存
    const afterClean = process.memoryUsage();
    const afterHeapMB = afterClean.heapUsed / 1024 / 1024;
    const afterPercent = (afterHeapMB / (afterClean.heapTotal / 1024 / 1024)) * 100;
    const freed = beforeClean.heapUsed - afterClean.heapUsed;
    
    console.log(`   ├─ 清理后: Heap = ${formatMemory(afterClean.heapUsed)}, 使用率 = ${Math.round(afterPercent)}%`);
    console.log(`   └─ 释放了: ${formatMemory(freed)} ${freed > 0 ? '✅' : '❌'}`);
    
    memorySnapshots.push({
      iteration: i,
      before: beforeClean.heapUsed,
      after: afterClean.heapUsed,
      freed: freed,
      usagePercent: afterPercent
    });
    
    // 短暂延迟
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // 最终清理
  console.log('\n⏰ 等待最终垃圾回收...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (global.gc) {
    for (let i = 0; i < 5; i++) {
      global.gc();
      await new Promise(resolve => setImmediate(resolve));
    }
    console.log('🧹 执行了 5 次强制垃圾回收');
  }
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const finalMemory = printMemoryUsage('最终内存使用');
  
  // 分析结果
  console.log('\n📈 内存使用分析');
  console.log('═══════════════════════════════════════════');
  
  const heapIncrease = finalMemory.usage.heapUsed - initialMemory.heapUsed;
  const rssIncrease = finalMemory.usage.rss - initialMemory.rss;
  
  console.log(`Heap 增长: ${formatMemory(heapIncrease)}`);
  console.log(`RSS 增长:  ${formatMemory(rssIncrease)}`);
  
  const totalFreed = memorySnapshots.reduce((sum, s) => sum + s.freed, 0);
  console.log(`总共释放: ${formatMemory(totalFreed)}`);
  
  const avgUsage = memorySnapshots.reduce((sum, s) => sum + s.usagePercent, 0) / memorySnapshots.length;
  console.log(`平均使用率: ${Math.round(avgUsage)}%`);
  
  // K8s 环境检查
  console.log('\n☸️  K8s 环境适配性检查');
  console.log('═══════════════════════════════════════════');
  
  const finalHeapMB = finalMemory.usage.heapUsed / 1024 / 1024;
  const finalRssMB = finalMemory.usage.rss / 1024 / 1024;
  const maxOldSpaceSize = parseInt(process.env.MAX_OLD_SPACE_SIZE || '512');
  const containerLimit = maxOldSpaceSize * 2; // 假设容器限制是堆大小的 2 倍
  
  console.log(`配置的堆限制: ${maxOldSpaceSize}MB`);
  console.log(`推荐容器限制: ${containerLimit}MB`);
  console.log(`当前 RSS: ${Math.round(finalRssMB)}MB`);
  console.log(`容器使用率: ${Math.round((finalRssMB / containerLimit) * 100)}%`);
  
  // 判断结果
  console.log('\n🎯 测试结果');
  console.log('═══════════════════════════════════════════');
  
  const checks = [];
  
  // 检查 1: 内存是否被释放
  if (totalFreed > 0) {
    checks.push({ name: '内存释放', pass: true, msg: `成功释放 ${formatMemory(totalFreed)}` });
  } else {
    checks.push({ name: '内存释放', pass: false, msg: '未能释放内存' });
  }
  
  // 检查 2: Heap 增长是否合理
  if (heapIncrease < 100 * 1024 * 1024) {
    checks.push({ name: 'Heap 增长', pass: true, msg: `增长 ${formatMemory(heapIncrease)}，在合理范围` });
  } else {
    checks.push({ name: 'Heap 增长', pass: false, msg: `增长过大 ${formatMemory(heapIncrease)}` });
  }
  
  // 检查 3: RSS 是否在容器限制内
  if (finalRssMB < containerLimit * 0.8) {
    checks.push({ name: 'RSS 使用', pass: true, msg: `${Math.round(finalRssMB)}MB < ${containerLimit * 0.8}MB (80% 阈值)` });
  } else {
    checks.push({ name: 'RSS 使用', pass: false, msg: `${Math.round(finalRssMB)}MB 接近限制` });
  }
  
  // 检查 4: 平均使用率
  if (avgUsage < 80) {
    checks.push({ name: '平均使用率', pass: true, msg: `${Math.round(avgUsage)}% < 80%` });
  } else {
    checks.push({ name: '平均使用率', pass: false, msg: `${Math.round(avgUsage)}% 偏高` });
  }
  
  // 检查 5: GC 是否可用
  if (global.gc) {
    checks.push({ name: 'GC 可用性', pass: true, msg: '--expose-gc 已启用' });
  } else {
    checks.push({ name: 'GC 可用性', pass: false, msg: '--expose-gc 未启用' });
  }
  
  checks.forEach(check => {
    const icon = check.pass ? '✅' : '❌';
    console.log(`${icon} ${check.name}: ${check.msg}`);
  });
  
  const allPassed = checks.every(c => c.pass);
  
  console.log('\n' + '═'.repeat(47));
  if (allPassed) {
    console.log('✅ 所有检查通过！适合在 K8s 环境部署');
  } else {
    console.log('⚠️  部分检查未通过，需要优化');
  }
  
  console.log('\n💡 K8s 部署建议');
  console.log('═══════════════════════════════════════════');
  console.log(`推荐配置:`);
  console.log(`  MAX_OLD_SPACE_SIZE: ${maxOldSpaceSize}`);
  console.log(`  Memory Limit: ${containerLimit}Mi`);
  console.log(`  Memory Request: ${Math.round(containerLimit * 0.5)}Mi`);
  console.log(`\n在 K8s 中设置:`);
  console.log(`  env:`);
  console.log(`  - name: MAX_OLD_SPACE_SIZE`);
  console.log(`    value: "${maxOldSpaceSize}"`);
  console.log(`  resources:`);
  console.log(`    requests:`);
  console.log(`      memory: "${Math.round(containerLimit * 0.5)}Mi"`);
  console.log(`    limits:`);
  console.log(`      memory: "${containerLimit}Mi"`);
  console.log('\n📚 更多信息请参阅 K8S_MEMORY_OPTIMIZATION.md\n');
}

// 运行测试
simulateImageProcessing().catch(console.error);

