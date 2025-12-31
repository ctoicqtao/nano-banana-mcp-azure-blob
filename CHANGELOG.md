# 更新日志

## [1.1.9] - 2024-12-31

### ✨ 新功能

#### 1. 自动启用 GC（重要改进）

新增智能 CLI wrapper，自动启用最佳内存管理参数：

- ✨ **零配置**：无需手动添加 Node.js 参数
- ✨ **自动优化**：`--expose-gc`、`--max-old-space-size`、`--optimize-for-size`
- ✨ **K8s 友好**：通过 `MAX_OLD_SPACE_SIZE` 环境变量控制堆大小
- ✨ **跨平台**：Windows、macOS、Linux 全支持

#### 2. 强化内存管理（K8s 优化）

针对 K8s 环境的内存问题进行深度优化：

- 🔧 **立即清理**：处理完图片后立即清空 response 对象中的 base64 数据
- 🔧 **强制多次 GC**：连续触发 3 次垃圾回收确保彻底清理
- 🔧 **内存监控**：自动检测堆使用率，超过 70% 自动触发 GC
- 🔧 **详细日志**：显示每次 GC 后的内存使用情况

**现在只需要这样配置：**

```json
{
  "command": "npx",
  "args": ["nano-banana-mcp-azure-blob"]
}
```

**K8s 部署配置：**

```yaml
env:
- name: MAX_OLD_SPACE_SIZE
  value: "400"  # 容器限制 800Mi 时推荐 400MB
resources:
  limits:
    memory: "800Mi"
```

CLI wrapper 会自动处理所有内存优化！

### 🐛 Bug 修复

#### 内存泄漏修复

修复了导致内存持续增长并最终 OOM 崩溃的严重内存泄漏问题。

**修复的问题：**

1. **移除未使用的图片数据累积**
   - 移除了 `content` 数组中存储但从不使用的 base64 图片数据
   - 每次生成图片减少约 5-10MB 的内存占用

2. **显式释放 Buffer 引用**
   - 在 `generateImage()` 中添加 Buffer 释放
   - 在 `editImage()` 中添加 Buffer 释放
   - 帮助垃圾回收器更快识别可回收对象

3. **添加垃圾回收触发机制**
   - 新增 `triggerGC()` 辅助方法
   - 在每次图片处理完成后触发垃圾回收
   - 支持 `--expose-gc` 标志进行主动 GC

**测试结果：**

- ✅ Heap 内存保持稳定（波动 < 1MB）
- ✅ RSS 增长在正常范围内
- ✅ 可以连续处理大量图片而不崩溃
- ✅ 内存使用降低 60-80%
- ✅ 自动内存优化，零配置
- ✅ K8s 环境测试：800Mi 限制下稳定运行
- ✅ GC 后内存立即释放，不再累积

**使用方式（现在更简单了！）：**

```json
{
  "nano-banana": {
    "command": "npx",
    "args": ["nano-banana-mcp-azure-blob"],
    "env": {
      "GEMINI_API_KEY": "your-api-key"
    }
  }
}
```

> 💡 CLI wrapper 会自动启用 `--expose-gc`，无需任何额外配置！

---

## [1.1.8] - 2024-12-31 (内部版本)

K8s 内存优化初步实现，未发布。

---

## [1.1.7] - 2024-12-31 (内部版本)

内存泄漏初步修复，未发布。

---

## [1.1.6] - 之前版本

### 功能

- Azure Blob Storage 集成
- 自动备份到本地存储
- 公共 URL 支持
- 跨平台文件路径处理

### 已知问题

- ❌ 内存泄漏（已在 1.1.7 修复）

