# K8s 环境内存优化指南

## 🎯 问题分析

在 K8s 环境中部署 nano-banana-mcp-azure-blob 时，即使给了 800MB 内存上限，运行一段时间后内存可能不会被及时回收，原因包括：

### 1. **Node.js GC 策略**
- Node.js 的垃圾回收器采用"惰性"策略
- 当内存充足时，GC 不会主动运行
- 在 K8s 中，Node.js 可能看不到真实的内存压力

### 2. **大对象滞留**
- Gemini API 返回的 response 对象包含大量 base64 数据
- 即使处理完成，这些对象可能仍在内存中
- V8 引擎的老年代对象不容易被回收

### 3. **K8s 内存限制与 Node.js**
- K8s 的内存限制（cgroup）对 Node.js 不透明
- Node.js 的堆大小默认基于系统总内存，而非容器限制
- 可能导致 OOM Killer 强制终止进程

## ✅ 已实施的优化

### 1. **立即清理 response 对象**

```typescript
// 处理完图片后立即清空 base64 数据
if (part.inlineData?.data) {
  // ... 处理图片 ...
  
  // 清空 base64 数据
  part.inlineData.data = '';
}

// 清空整个 response 对象引用
response = null;
```

### 2. **强制多次 GC**

```typescript
private async forceAggressiveGC(): Promise<void> {
  if (global.gc) {
    // 连续触发 3 次 GC，确保彻底清理
    for (let i = 0; i < 3; i++) {
      global.gc();
      await new Promise(resolve => setImmediate(resolve));
    }
  }
}
```

### 3. **内存监控和自动 GC**

```typescript
private checkMemoryAndGC(): void {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const usagePercent = (heapUsedMB / heapTotalMB) * 100;

  // 堆使用超过 70% 时自动触发 GC
  if (usagePercent > 70 && global.gc) {
    console.log(`⚠️  High memory usage detected (${Math.round(usagePercent)}%), triggering GC...`);
    global.gc();
  }
}
```

### 4. **优化的 CLI wrapper**

自动添加内存优化参数：
- `--expose-gc`: 启用手动 GC
- `--max-old-space-size=512`: 限制堆大小为 512MB
- `--optimize-for-size`: 优先内存而非速度

## 🚀 K8s 部署配置

### 方案 1: 使用环境变量（推荐）

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nano-banana-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: nano-banana-mcp
  template:
    metadata:
      labels:
        app: nano-banana-mcp
    spec:
      containers:
      - name: nano-banana
        image: node:18-alpine
        command: ["npx"]
        args: ["nano-banana-mcp-azure-blob"]
        env:
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: nano-banana-secrets
              key: gemini-api-key
        - name: AZURE_STORAGE_CONNECTION_STRING
          valueFrom:
            secretKeyRef:
              name: nano-banana-secrets
              key: azure-connection-string
        - name: MAX_OLD_SPACE_SIZE
          value: "400"  # 设置为容器内存限制的 50-60%
        - name: NODE_ENV
          value: "production"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "800Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "ps aux | grep node | grep -v grep"
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "ps aux | grep node | grep -v grep"
          initialDelaySeconds: 10
          periodSeconds: 10
```

### 方案 2: 使用 NODE_OPTIONS

```yaml
env:
- name: NODE_OPTIONS
  value: "--expose-gc --max-old-space-size=400 --optimize-for-size"
- name: GEMINI_API_KEY
  valueFrom:
    secretKeyRef:
      name: nano-banana-secrets
      key: gemini-api-key
```

### 方案 3: 自定义 Docker 镜像

**Dockerfile:**

```dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 全局安装包
RUN npm install -g nano-banana-mcp-azure-blob

# 设置环境变量
ENV NODE_ENV=production
ENV MAX_OLD_SPACE_SIZE=400

# 暴露端口（如果需要）
# EXPOSE 3000

# 启动命令
CMD ["nano-banana-mcp-azure-blob"]
```

**K8s Deployment:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nano-banana-mcp
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: nano-banana
        image: your-registry/nano-banana-mcp:1.1.8
        env:
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: nano-banana-secrets
              key: gemini-api-key
        - name: MAX_OLD_SPACE_SIZE
          value: "400"
        resources:
          limits:
            memory: "800Mi"
```

## 📊 内存配置建议

### 内存分配原则

1. **K8s 内存限制**: 800Mi（你的当前设置）
2. **Node.js 堆大小**: 400-480MB（限制的 50-60%）
3. **为什么不是 100%?**
   - V8 堆外内存（Buffer、网络等）
   - 系统开销
   - GC 工作空间

### 配置示例

| K8s Memory Limit | Max Old Space Size | 说明 |
|------------------|-------------------|------|
| 512Mi | 256-300 | 小型部署 |
| 800Mi | 400-480 | 你的当前设置（推荐 400） |
| 1024Mi | 512-640 | 中型部署 |
| 2048Mi | 1024-1280 | 大型部署 |

### 环境变量设置

```yaml
env:
- name: MAX_OLD_SPACE_SIZE
  value: "400"  # 对应 800Mi 的容器
```

## 🔍 监控和调试

### 1. 查看内存使用

在应用日志中查看 GC 触发信息：

```bash
kubectl logs -f deployment/nano-banana-mcp | grep "GC\|memory"
```

你会看到类似：
```
🚀 Starting with optimized memory settings (heap limit: 400MB)...
🧹 GC triggered - Heap: 145MB, RSS: 312MB
🧹 Aggressive GC completed - Heap: 98MB, RSS: 280MB
```

### 2. 实时监控内存

```bash
# 监控 Pod 内存使用
kubectl top pod -l app=nano-banana-mcp

# 查看详细内存统计
kubectl exec deployment/nano-banana-mcp -- cat /sys/fs/cgroup/memory/memory.stat
```

### 3. 添加自定义监控

在代码中添加定期内存报告：

```typescript
// 每 5 分钟报告一次内存使用
setInterval(() => {
  const usage = process.memoryUsage();
  console.log('📊 Memory Report:', {
    rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
    external: `${Math.round(usage.external / 1024 / 1024)}MB`,
  });
}, 5 * 60 * 1000);
```

## ⚠️ 故障排除

### 问题 1: 仍然出现 OOM

**症状**: Pod 被 OOMKilled

**解决方案**:
```yaml
# 降低 max-old-space-size
env:
- name: MAX_OLD_SPACE_SIZE
  value: "350"  # 从 400 降到 350

# 或增加容器内存限制
resources:
  limits:
    memory: "1024Mi"
```

### 问题 2: 内存缓慢增长

**症状**: 内存使用缓慢上升，GC 不频繁

**解决方案**:
```yaml
# 添加更激进的 GC 策略
env:
- name: NODE_OPTIONS
  value: "--expose-gc --max-old-space-size=400 --optimize-for-size --gc-interval=100"
```

### 问题 3: 性能下降

**症状**: GC 过于频繁，影响响应时间

**解决方案**:
```yaml
# 增加内存限制，减少 GC 压力
env:
- name: MAX_OLD_SPACE_SIZE
  value: "512"
resources:
  limits:
    memory: "1024Mi"
```

## 🎯 最佳实践总结

### 1. **推荐配置**（800Mi 容器）

```yaml
env:
- name: MAX_OLD_SPACE_SIZE
  value: "400"
- name: NODE_ENV
  value: "production"
resources:
  requests:
    memory: "256Mi"
  limits:
    memory: "800Mi"
```

### 2. **监控告警**

设置 Prometheus 告警：

```yaml
- alert: NanoBananaHighMemory
  expr: container_memory_usage_bytes{pod=~"nano-banana-mcp.*"} > 700000000
  for: 5m
  annotations:
    summary: "Nano Banana memory usage high"
```

### 3. **HPA（水平扩展）**

如果单个 Pod 压力大，考虑扩展：

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nano-banana-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nano-banana-mcp
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
```

### 4. **定期重启**（可选）

作为额外保障，可以定期重启 Pod：

```yaml
spec:
  template:
    spec:
      containers:
      - name: nano-banana
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]
        # 添加就绪探针，确保平滑重启
```

## 📈 预期效果

实施这些优化后：

- ✅ **内存使用稳定**: 峰值在 400-500MB
- ✅ **自动 GC**: 每次处理图片后强制清理
- ✅ **监控可见**: 日志中可见 GC 活动
- ✅ **不会 OOM**: 内存限制在安全范围内
- ✅ **性能良好**: GC 延迟 < 100ms

## 🆘 需要帮助？

如果问题仍然存在，请收集以下信息：

```bash
# 1. Pod 状态
kubectl describe pod <pod-name>

# 2. 内存使用趋势
kubectl top pod <pod-name> --containers

# 3. 应用日志
kubectl logs <pod-name> --tail=1000 | grep -E "GC|memory|OOM"

# 4. 容器指标
kubectl exec <pod-name> -- node -e "console.log(process.memoryUsage())"
```

然后在 GitHub Issues 中提供这些信息。

