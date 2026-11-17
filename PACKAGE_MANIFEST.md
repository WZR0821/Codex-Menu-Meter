# 开发交接包说明

## 包含内容

- Electron 主进程、桌面面板、设置页和手机端源码
- Swift Touch Bar helper 源码
- 已编译的 Intel + Apple Silicon 双架构 Touch Bar helper
- 应用图标
- 单元测试和视觉 QA 脚本
- Cloudflare Worker、Durable Object 与端到端加密协议源码
- Intel/Apple Silicon 构建脚本
- `package.json` 与锁定依赖
- README、完整维护手册、新窗口交接摘要
- 当前版本安装包校验信息
- 包内源码 SHA-256 清单

## 有意排除

- `node_modules`：运行 `npm ci` 即可重建
- `dist`：历代 DMG、解包应用和 QA 截图
- `backups`：历代完整 `.app`
- `.DS_Store` 和缓存文件
- `cloud/.wrangler`：本地 Worker 缓存与 Durable Object 测试状态
- `~/Library/Application Support/codex-menu-meter` 中的本机设置
- Codex/Claude 登录凭证、OAuth token、API Key 和手机访问密钥

## 恢复开发环境

```bash
npm ci
npm run lint
npm test
npm run sync:dev -- --port 8787 --local
npm run qa:cloud
```

## 重新生成交接 ZIP

```bash
npm run package:handoff
```

输出：

```text
dist/Codex-Menu-Meter-<version>-Developer-Handoff.zip
```
