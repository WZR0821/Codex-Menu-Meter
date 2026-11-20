# Codex Menu Meter 开发维护手册

## 1. 文档信息

- 当前基线版本：`1.1.1`
- 应用名称：Codex Menu Meter
- Bundle ID：`local.codex-menu-meter`
- 技术栈：Electron 43、Node.js、原生 Swift Touch Bar helper
- 支持架构：Intel (`x86_64`) 与 Apple Silicon (`arm64`)
- 当前开发机：Intel Mac，macOS 26
- 项目目录：仓库根目录（下文命令都在这里执行）
- 已安装应用：`/Applications/Codex Menu Meter.app`

本手册用于后续开发、排错、打包和跨窗口交接。任何新任务开始前，建议先阅读
`NEW_SESSION_HANDOFF.md`，再按本手册的检查清单确认环境。

## 2. 快速开始

```bash
npm ci
npm run lint
npm test
npm start
```

开发运行前建议退出已安装的 Codex Menu Meter，避免两个实例同时占用菜单栏、
Touch Bar 和手机端口：

```bash
osascript -e 'tell application "Codex Menu Meter" to quit'
```

需要保留已安装版本继续运行时，可给开发实例使用独立数据目录，并暂时关闭
Touch Bar helper：

```bash
CMM_USER_DATA_DIR=/tmp/cmm-dev-data CMM_DISABLE_TOUCHBAR=1 npm start
```

## 3. 项目目录

| 路径 | 用途 |
| --- | --- |
| `src/main.js` | Electron 主进程、托盘、窗口、数据抓取、设置、Touch Bar、手机服务 |
| `src/index.html` | 桌面面板结构 |
| `src/renderer.js` | 桌面面板渲染、切换、动效和交互 |
| `src/styles.css` | 桌面面板视觉样式 |
| `src/settings.*` | 设置窗口结构、样式和行为 |
| `src/mobile/*` | 手机端 PWA 页面、样式（`app.css`）和渲染；`minimal.css`、`light.css` 是桌面面板和设置窗口在用 |
| `src/mobile-server.js` | 只读手机端 HTTP/SSE 服务、鉴权和数据脱敏 |
| `cloud/*` | 端到端加密快照 Worker、Durable Object 与 Wrangler 配置 |
| `src/provider-config.js` | GPT、Claude、Kimi、GLM、Qwen 的统一配置 |
| `src/foreground-provider.js` | 前台应用识别和手动覆盖状态机 |
| `src/activity-windows.js` | 5 小时/周周期 Token 汇总及滚动窗口降级 |
| `src/codex-token-activity.js` | Codex rollout token 事件解析 |
| `src/claude-token-activity.js` | Claude 会话记录解析、去重键和 token 口径 |
| `src/transcript-reader.js` | 大型会话文件的增量读取和缓存 |
| `src/i18n.js` | 中文、English、日本語共享文案 |
| `src/preload.js` | 受限 IPC 接口 |
| `native/touchbar-helper.swift` | Touch Bar 原生实现和前台应用事件监听 |
| `native/touchbar-helper` | 已编译的双架构 helper |
| `scripts/build-*.sh` | 原生 helper、Intel/Apple Silicon DMG 构建 |
| `scripts/qa-*.js` | 桌面、手机和设置窗口截图 QA |
| `test/*` | Node 单元测试与 QA 固定状态 |
| `assets/icon.icns` | 应用图标 |
| `package.json` | 版本、脚本和 electron-builder 配置 |

`node_modules`、`dist` 和 `backups` 都不是源码。它们体积很大，不能放进开发交接包。

## 4. 运行时架构

主要数据流如下：

```text
Codex/Claude 本机凭证与会话文件
             |
             v
      Electron 主进程 main.js
       |        |         |
       |        |         +--> 手机 HTTP/SSE 服务
       |        |         +--> AES-GCM 密文 --> Cloudflare Worker
       |        +------------> touchbar-state.json
       |                           |
       v                           v
  桌面面板 renderer.js      Swift Touch Bar helper
       |
       +--> 菜单栏标题、设置窗口、系统通知
```

主进程是唯一可以接触凭证和本机记录的部分。渲染进程、手机端和 Touch Bar 只接收
已经整理、脱敏后的显示数据。

## 5. 核心状态与刷新周期

`src/main.js` 中的 `state` 是桌面、菜单栏、Touch Bar 和手机端的共同状态源。
设置变化通过 `saveSettings()` 同步到 `state`，然后调用：

- `updateTrayTitle()`：更新菜单栏标题。
- `sendState()`：推送给桌面面板。
- `queueTouchBarStateWrite()`：合并写入 Touch Bar 状态文件。
- 手机端 SSE：向已认证客户端推送脱敏状态。

当前刷新周期：

| 数据 | 周期 |
| --- | --- |
| Codex 额度 | 120 秒 |
| Claude 额度 | 5 分钟 |
| Kimi/GLM 等额外平台 | 5 分钟 |
| Codex/Claude 雷达 | 15 分钟 |
| Token 活动 | 5 分钟 |
| Touch Bar 本地状态读取 | 0.5 秒 |

不要在渲染循环、鼠标移动或窗口跟随逻辑中增加网络请求或全量会话扫描。

## 6. 数据来源

### 6.1 Codex/GPT

- 凭证：`~/.codex/auth.json`
- 额度接口：
  - `https://chatgpt.com/backend-api/wham/usage`
  - `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits`
- 雷达：
  - 智力页：`https://codexradar.com/data/codex-four-task-results.json`（`src/codex-four-results.js`；四题都判完才有总分，带 ETag，原站 304 回应不带 ETag，读取器只在 200 时更新）
  - 额度页：`https://codexradar.com/current.json`
  - 2026-11-20 前智力页读的 RadarBench（`radar-bench-binding.json` + `/api/radar-bench-score`）在原站返回 502，已停用，`src/radar-bench.js` 已删
- Token：
  - `~/.codex/sessions`
  - `~/.codex/archived_sessions`

Token 活动读取 `token_count` 事件，并排除子代理继承的父任务历史。主数字采用本机
精确 token；本机无记录时才使用后台百分比，不能把百分比伪装成 token 数量。
缓存命中率为 `cached_input_tokens / input_tokens`，必须保留每日的
`inputTokens` 和 `cachedInputTokens`；缺少输入数据时显示 `--`，不得显示为 0%。
着色分界为：`≥99%` 绿色，`95–99%` 黄色，`<95%` 红色；无数据保持中性灰。判色必须
基于四舍五入到一位小数后的显示值，避免出现「显示 99.0% 却是黄色」。

会话数以 `session_meta.payload.session_id` 计。子代理有各自的 rollout 文件，但
`session_id` 指向父线程，所以子代理会并入发起它的会话，与 Claude 侧
`record.sessionId` 的口径一致；只有解析不出 id 时才回退到文件名。

额度卡下方的 Token 汇总由 `src/activity-windows.js` 生成。官方额度返回有效
`resetAt` 时，必须按当前 5 小时/7 天额度周期边界统计；缺少重置时间时才降级为
滚动 5 小时/7 天。这里的总量、读写量和缓存命中率都来自相同的一组本地会话记录。

### 6.2 Claude Code

- 凭证：
  - `~/.claude/.credentials.json`
  - 钥匙串服务 `Claude Code-credentials`
- 额度接口：`https://api.anthropic.com/api/oauth/usage`
- 雷达：`https://claudecoderadar.com/data/claude-code-radar.json`
- Token：`~/.claude/projects`

Claude OAuth 失效时允许刷新一次，并写回原凭证来源。官方额度失败时保留最近一次
精确结果，不使用本地 token 推算百分比。

### 6.3 其他平台

- Kimi Code：`https://api.kimi.com/coding/v1/usages`
- GLM：`https://open.bigmodel.cn/api/monitor/usage/quota/limit`，并自动尝试国际站
- Qwen：当前无官方额度查询接口，只显示说明

API Key 只保存在应用数据目录的 `settings.json`，不能进入源码、截图或交接包。

## 7. 前台应用自动切换

此功能由 `native/touchbar-helper.swift` 与 `src/foreground-provider.js` 共同实现。

### 7.1 事件路径

1. Swift helper 订阅 `NSWorkspace.didActivateApplicationNotification`。
2. helper 通过 stdout 发出：

```text
foreground-app:<bundleId>\t<name>\t<bundlePath>\t<pid>
```

3. `main.js` 的 `handleTouchBarHelperOutput()` 解析事件。
4. `ForegroundProviderTracker` 识别前台平台。
5. `selectProvider(provider, { source: "foreground" })` 静默更新平台。

这条路径只更新菜单栏和 Touch Bar，不调用 `togglePanel()`、`showPanelAnimated()` 或
`openSettingsWindow()`，因此不会自动展开面板，也不会抢占前台。

### 7.2 当前识别规则

| 平台 | Bundle ID |
| --- | --- |
| Codex/ChatGPT 桌面端 | `com.openai.codex` |
| Claude 桌面端 | `com.anthropic.claudefordesktop` |

名称和 `.app` 路径仅作为兼容回退。Safari、Finder、Terminal 等其他应用不会改变
当前选择。

当前实现识别桌面应用本身。若 Claude Code 运行在 Terminal/iTerm 的某个标签页中，
系统前台应用只会报告终端；要进一步识别 CLI，需要单独设计进程树或终端标签识别，
不能把所有 Terminal 前台事件直接判定为 Claude。

### 7.3 自动与手动优先级

- 设置项：`autoSwitchProvider`，默认开启。
- 切入 Codex 或 Claude 时自动选择对应平台。
- 切入其他应用时保持当前平台。
- 自动切换后，用户仍可通过面板或 Touch Bar 手动切换。
- 同一个前台应用未改变时，手动结果不会被自动逻辑抢回。
- 前台应用发生变化后，手动覆盖清除；下一次进入 Codex/Claude 时恢复自动判断。

修改此逻辑时必须保持 `test/foreground-provider.test.js` 中的覆盖测试通过。

## 8. 菜单栏与面板

1.0.1 的窗口呈现由 `src/panel-window.js` 管理，`native/panel-window.mm` 使用公开 AppKit
API 设置瞬态窗口及跨应用全屏空间属性。macOS 13+ 明确加入 `CanJoinAllApplications`；
`setAlwaysOnTop` 和 `visibleOnFullScreen` 不能替代这个空间归属设置。应在显示、聚焦和
设置窗口层级之后再应用原生属性，避免 Chromium 重置窗口行为。不要用修改 Objective-C
继承关系或私有 WindowServer API 的方式代替。

窗口关闭、销毁和重新显示时必须取消旧的置顶恢复任务；恢复时不能要求窗口已经可见，
否则恰好被遮挡的窗口会跳过恢复。当前 Space 归属由原生窗口查询，不能仅通过显示器 ID 判断。

`npm run build:native` 会构建 Touch Bar helper 和双架构 `panel-window.node`。后者使用
Node-API 8，不依赖 Electron 的 V8 ABI；安装包通过 `extraResources` 带入该模块。
`npm run qa:panel` 在真正的 Electron/AppKit 窗口上验证原生属性与开关行为。发布前另外在
独立应用的全屏 Space 中检查菜单栏点击、快捷键、收起后重开和快速连续开关。

菜单栏标题由 `updateTrayTitle()` 生成，示例：

```text
GPT 5h：∞  周：89%
CC 5h：35%  周：51%
```

面板为透明、无边框 BrowserWindow，宽度固定 `406`，高度跟随当前页内容：渲染层在
`renderer.js` 量出「工具栏 + 状态行 + 活动页内容」的高度，通过 `panel:content-height`
报给主进程，主进程在 `PANEL_CONTENT_MIN_HEIGHT`~`PANEL_CONTENT_MAX_HEIGHT` 之间取值
并重新 `setBounds`。`PANEL_HEIGHT` 只是首帧的起点。**同一版式共用一个高度**：
渲染层按「当前页 × 是否附加平台」分档缓存该档见过的最大高度，所以 GPT 和 Claude
之间来回切时窗口尺寸完全不动，只有附加平台和雷达页各自成一档。切换动画期间
（`PANEL_HEIGHT_SWITCH_HOLD_MS`）不上报高度；主进程侧变高立刻生效、变矮延后
`PANEL_HEIGHT_SHRINK_DELAY_MS` 再收，避免刷新中间态引起窗口抖动。这样用量页永远不需要滚动；
附加平台虽然保留额度曲线，但没有 Token 区，仍不会留下大片空白。关键交互约束：

- 正常桌面点击外部关闭。
- 全屏菜单栏收回时，光标在面板内则保持，离开面板才关闭。
- 自动平台切换不得打开面板。
- 面板首次点击前已预创建和预热，避免冷启动卡顿。
- 用量页应完整显示且不产生多余纵向滚动。
- 雷达页和设置页允许滚动，并保留底部余白与回弹效果。

改动窗口尺寸或用量页任何区块的间距后，跑 `npm run qa:render`：它会按渲染层上报的
高度调整窗口再截图，并在用量页仍需滚动时直接失败。

## 9. Touch Bar

Touch Bar 使用私有 `DFRFoundation` API，因此由单独的 Swift helper 负责。主应用通过
`touchbar-state.json` 输出状态，通过 helper stdout 接收点击和前台事件。

主要协议：

```text
touchbar-provider:<provider>
pointer-down
foreground-app:<bundleId>\t<name>\t<bundlePath>\t<pid>
```

当前 UI 规则：

- 显示 5h/7d 剩余额度、进度条和重置倒计时（0.10.16 起；每一块是整条高度的灰色圆角块）。
- 剩余较多为绿色、中等为黄色、较少为红色。
- GPT 切换按钮为蓝色，CC 为橙色；只启用一个平台时是灰色。
- 有 IQ 数据的平台显示能力排序后的六个 IQ，两页手动切换。
- 没有 IQ 数据的平台，额度块铺满整条，带名称的附加限额（状态文件的 `usage.extra`，如 Fable）各占一块。
- 折叠控制条显示“用量”。
- 平台切换会同步菜单栏和面板状态。

编译 helper：

```bash
npm run build:native
lipo -archs native/touchbar-helper
# 离屏渲染核对界面（不碰真实 Touch Bar）：
native/touchbar-helper --render <state.json> <out.png> [平台] [IQ 页]
```

默认工具链指向命令行工具时，构建脚本会自动改用完整的 Xcode（原因见 `NEW_SESSION_HANDOFF.md`）。

预期输出：

```text
x86_64 arm64
```

`DFRFoundation` 是私有框架，未来 macOS 更新可能改变行为。发布前必须在真实 Touch Bar
机器上测试展开、折叠、IQ 翻页和平台按钮。

## 10. 手机端、Tailscale 与云同步

手机端由 `src/mobile-server.js` 提供：

- 默认端口：`43821`
- 监听地址：`0.0.0.0`
- 页面路径：`/mobile/`
- 状态接口：`/api/state`
- 实时更新：SSE
- 鉴权：URL token 首次验证后写入 HttpOnly Cookie

PWA manifest 的 `start_url` 必须保留访问 token，否则从主屏幕启动会提示密钥无效。
更换密钥时，服务器会断开已有 SSE 客户端。

Tailscale 只负责远程网络可达性。应用会优先提供 Tailscale 地址，但不会把 Codex 或
Claude 凭证发送到手机；手机只收到 `createMobilePayload()` 生成的只读脱敏数据。

页面样式（0.10.17 起）：

- 手机页面只加载 `src/mobile/app.css`，配色与桌面的 `src/apple.css` 一致，只有浅色。
  同目录下的 `minimal.css`、`light.css` 由桌面面板（`src/index.html`）和设置窗口
  （`src/settings.html`）加载，不属于手机页面，不要删。
- 新增静态文件要同时加进 `mobile-server.js` 的 `STATIC_FILES` 白名单，否则本地服务返回 404。
- 用量页必须单屏：390×844、375×667、320×568 三种尺寸下 GPT 和 Claude（含 Fable 行）都不能出现
  纵向滚动。`app.css` 末尾按屏高分三档收紧字号和间距，`npm run qa:mobile` 会逐项检查。
- 相对倒计时每 30 秒重画一次，算法与面板、Touch Bar 相同（四舍五入到分钟）。
- 云同步用的页面是另一份部署：`cloud/wrangler.jsonc` 把 `src/mobile` 当作静态资源目录，
  改完页面要 `npm run sync:deploy` 之后云端才更新；本地服务随应用安装更新。

### 10.1 加密云同步

云同步是本地手机服务之外的可选只读通道：

- `src/mobile/cloud-sync-crypto.js`：浏览器和 Node 共用的 HKDF/AES-GCM 协议。
- `cloud/worker.mjs`：静态 PWA、动态 cloud runtime 配置及 Durable Object 路由。
- `cloud/sync-account-core.mjs`：密文保存、鉴权、ETag、旧快照拒绝及 90 天回收。
- macOS 钥匙串服务：`Codex Menu Meter Cloud Sync`。
- `settings.json` 仅保存 Worker 地址和随机 account ID，不保存主密钥。
- 手机密钥保存在 IndexedDB；最近一次密文也缓存在本地，断网时可解密显示。

配对链接必须使用 `#pair=...` fragment。不要把恢复码放入 query、Cookie、日志或
Durable Object。服务端只能保存派生鉴权值、AES-GCM envelope 和接收时间。

部署：

```bash
npx wrangler login
npm run sync:deploy
```

部署配置绑定 Cloudflare SQLite Durable Object `SYNC_ACCOUNTS`。新安装预填的地址是
`src/main.js` 的 `DEFAULT_CLOUD_SYNC_SERVER_URL`。

本地端到端 QA（先在一个终端启动 Worker）：

```bash
npm run sync:dev -- --port 8787 --local
npm run qa:cloud
```

`qa:cloud` 会创建临时账号、上传密文、验证配对页、浏览器解密、URL fragment 清理、
IndexedDB 重载和手机单屏布局，最后删除临时 Durable Object 数据。

8787 端口被别的服务占用时（这台开发机上是 SideStore 源），换一个端口并用环境变量告诉脚本：

```bash
npx wrangler dev --config cloud/wrangler.jsonc --port 8799 --ip 127.0.0.1 --local --persist-to /tmp/cmm-wrangler-state
CMM_SYNC_QA_URL=http://127.0.0.1:8799 npm run qa:cloud -- /tmp/cmm-cloud.png
```

部署前先 `npx wrangler whoami`：登录令牌会过期，过期后要在终端里重新 `npx wrangler login`（浏览器授权）。

## 11. 本机运行数据

默认应用数据目录：

```text
~/Library/Application Support/codex-menu-meter/
```

常见文件：

| 文件 | 内容 |
| --- | --- |
| `settings.json` | 语言、开机启动、平台开关、API Key、手机访问密钥 |
| `usage-history.json` | 最近 7 天额度采样 |
| `touchbar-state.json` | Touch Bar 脱敏显示状态 |
| `touchbar-helper.log` | helper 启停、点击和自动切换日志 |

这些文件含本机设置或敏感字段，不能复制到源码仓库、开发交接 ZIP 或公开 issue。

调试环境变量：

| 变量 | 用途 |
| --- | --- |
| `CMM_USER_DATA_DIR` | 使用独立 Electron 数据目录 |
| `CMM_DISABLE_TOUCHBAR=1` | 不启动 Touch Bar helper |
| `CMM_DEBUG_STATE_PATH` | 每 2 秒输出一次主状态快照 |
| `CMM_SYNC_SERVER_URL` | 新安装时预填加密云同步 Worker 地址 |
| `KIMI_API_KEY` | 覆盖 Kimi 设置 Key |
| `GLM_API_KEY` / `ZHIPU_API_KEY` | 覆盖 GLM 设置 Key |

## 12. 测试与视觉 QA

基础检查：

```bash
npm run lint
npm test
```

当前基线为 108 项单元测试。重点覆盖：

- Codex token 解析和子代理去重
- 5 小时/周 Token 周期边界与滚动窗口降级
- 增量会话读取
- 前台应用识别、手动覆盖和恢复自动切换
- 手机鉴权、SSE 断开和数据脱敏
- 平台配置升级兼容
- 云同步密钥派生、加解密、错误密钥拒绝与 HTTPS 校验
- Durable Object 首次绑定、鉴权、旧快照拒绝和删除
- Token 活动 7 天直方图的分色、分段、柱高和型号写法

依赖审计基线：

```bash
npm audit --omit=dev
```

当前生产依赖为 0 个已知漏洞。完整 `npm audit` 会报告 3 个开发/打包工具链的传递
依赖问题（`brace-expansion`、`fast-uri`、`tar`）；它们不进入生产依赖。后续可在单独
版本中运行 `npm audit fix`、重新构建双架构 DMG 并完成全套回归，不要在发布途中
直接改锁文件。

桌面截图 QA：

```bash
npm run qa:render -- test/fixtures/qa-state.json codex usage /tmp/cmm-usage.png
npm run qa:render -- test/fixtures/qa-state.json claude radar /tmp/cmm-claude-radar.png
```

手机 QA：

```bash
npm run qa:mobile -- test/fixtures/qa-state.json /tmp/cmm-mobile-qa
```

云同步 QA（需要本地 Worker 在 `8787` 端口运行）：

```bash
npm run qa:cloud -- /tmp/cmm-cloud.png
```

设置窗口 QA：

```bash
npm run qa:settings -- /tmp/cmm-settings.png
```

QA 脚本不仅截图，也会检查横向溢出、手机用量页纵向滚动、隐藏标题和动效残留。
生成截图后仍需人工查看文字裁切、按钮状态、色彩和底部余白。

## 13. 构建与发布

构建 Intel：

```bash
npm run build:intel-dmg
```

构建 Apple Silicon：

```bash
npm run build:apple-silicon-dmg
```

输出文件：

```text
dist/Codex-Menu-Meter-macOS26-Intel-<version>.dmg
dist/Codex-Menu-Meter-macOS26-AppleSilicon-<version>.dmg
```

构建脚本会：

1. 重新编译双架构 Touch Bar helper。
2. 用 electron-builder 构建目标架构应用。
3. 清理 Finder 扩展属性。
4. 验证 ad-hoc 签名。
5. 用 ULMO/LZMA 生成体积更小的 DMG。

当前包是 ad-hoc 签名，没有 Apple Developer ID 公证。对外正式分发前，需要补充
Developer ID、hardened runtime、entitlements 和 notarization 流程。

版本升级时至少同步：

- `package.json`
- `package-lock.json` 顶部两个版本字段
- `scripts/qa-settings.js` 中的模拟版本
- `README.md` 或维护手册中的当前版本说明

## 14. 发布前检查清单

1. `npm run lint` 通过。
2. `npm test` 全部通过。
3. 桌面用量、桌面雷达、手机和设置截图无裁切。
4. `npm run build:native` 后 helper 为 `x86_64 arm64`。
5. Intel 应用主程序为 `x86_64`。
6. Apple Silicon 应用主程序为 `arm64`。
7. 两个 `.app` 均通过 `codesign --verify --deep --strict`。
8. DMG 名称和应用版本一致。
9. 在真实机器验证菜单栏点击、外部关闭、全屏菜单栏、Touch Bar 和开机启动。
10. 激活 Codex 后菜单栏与 Touch Bar 切到 GPT，且面板不展开。
11. 激活 Claude 后菜单栏与 Touch Bar 切到 CC，且面板不展开。
12. 激活 Finder/Safari 后当前平台保持不变。
13. 自动切换后手动选择不会在同一前台应用内被抢回。
14. 手机 Safari、主屏幕 PWA 和 Tailscale 地址均可访问。
15. 云端 Worker `/health`、首次配对、断网缓存与恢复轮询均可用。
16. Worker 存储和日志中没有恢复码、主密钥或明文快照。
17. 交付包不含 `settings.json`、OAuth token、API Key 或本机访问密钥。

## 15. 安装开发构建

先退出旧版本：

```bash
osascript -e 'tell application "Codex Menu Meter" to quit'
```

Intel 开发机：

```bash
ditto --norsrc \
  "dist/mac/Codex Menu Meter.app" \
  "/Applications/Codex Menu Meter.app"
```

Apple Silicon 开发机：

```bash
ditto --norsrc \
  "dist/mac-arm64/Codex Menu Meter.app" \
  "/Applications/Codex Menu Meter.app"
```

验证并启动：

```bash
codesign --verify --deep --strict "/Applications/Codex Menu Meter.app"
open -a "Codex Menu Meter"
```

覆盖应用不会删除 `~/Library/Application Support/codex-menu-meter`，因此现有设置和
手机访问密钥会保留。

## 16. 常见故障

### 菜单栏与 Touch Bar 不同步

1. 查看 `touchbar-helper.log`。
2. 确认 helper 正在运行。
3. 检查 `touchbar-state.json` 的 `preferredProvider`。
4. 确认 helper 架构包含当前 CPU。
5. 检查 `touchbar-provider:` stdout 是否被 `main.js` 解析。

### 自动前台切换无效

1. 设置中确认“跟随前台应用”开启。
2. 用 `osascript` 查看真正的前台应用名称。
3. 检查 bundle ID 是否仍为当前规则中的值。
4. 查看日志是否出现 `foreground-provider:codex` 或 `foreground-provider:claude`。
5. 不要用高频轮询替换 NSWorkspace 激活事件。

### 自动切换意外展开面板

检查自动路径是否调用了 `togglePanel()`、`showPanelAnimated()` 或模拟 Tray 点击。
正确实现只能调用 `selectProvider(..., { source: "foreground" })`。

### 面板点击外部不关闭

检查全局 `pointer-down`、`handleGlobalPointerDown()`、窗口 bounds 和打开宽限时间。
普通桌面依赖外部点击关闭；全屏自动收起还受面板 hover 状态控制。

### 首次打开或切换卡顿

1. 保持面板预创建。
2. 网络刷新使用 `runRefreshOnce()` 合并。
3. 不在切换事件中同步扫描全部会话。
4. 动效应为短时、单层，避免持续 blur、box-shadow 或无限动画。
5. 使用 DevTools/Activity Monitor 确认是主进程 I/O 还是 GPU 合成。

### 手机主屏幕提示密钥无效

检查动态 manifest 的 `start_url` 是否包含 token，以及 Cookie 是否因更换密钥失效。
从电脑设置页重新复制链接或旋转密钥后，需要重新添加主屏幕图标。

云同步模式不使用本地访问 token。若云同步主屏幕页要求配对，请在设置中复制恢复码，
输入一次后会保存到该 PWA 的 IndexedDB；不要把恢复码改放到 query 参数。

### 加密云同步失败

1. `npx wrangler whoami` 确认部署账号。
2. `curl https://<worker>/health` 检查 Worker。
3. 设置中确认 Worker 地址为 HTTPS，且没有额外路径。
4. 钥匙串中检查 `Codex Menu Meter Cloud Sync`。
5. 本地运行 `npm run sync:dev -- --port 8787 --local` 和 `npm run qa:cloud`。
6. 鉴权失效时使用“重置配对”，不要复用旧手机恢复码。

### Claude 额度无法读取

1. 检查 `~/.claude/.credentials.json`。
2. 检查钥匙串 `Claude Code-credentials`。
3. 检查 access token 过期时间和 refresh token。
4. 记录官方接口错误，不能用本地 token 伪造额度。

## 17. 包体维护

项目目录当前体积主要来自历史产物，而不是源码：

- `dist`：历代 DMG 和 QA 截图
- `backups`：历代完整 `.app`
- `node_modules`：可由 `npm ci` 重建

建议长期保留：

- 完整源码
- 当前版本 Intel/Apple Silicon DMG
- 上一个稳定版本 DMG
- 当前维护手册和校验文件

建议归档到外置存储或单独压缩：

- 更早的 DMG
- 旧 `.app` 备份
- 历史 QA 截图

不要在未确认用户已备份前直接删除 `dist` 或 `backups`。开发交接 ZIP 应始终排除
`node_modules`、`dist`、`backups`、`.DS_Store` 和本机应用数据。

## 18. 当前 0.10.6 验证状态

- JavaScript 语法检查：通过
- 单元测试：38/38 通过
- 生产依赖审计：0 个已知漏洞
- 设置窗口 QA：通过
- 本地/Tailscale 手机页面 QA：通过
- 云端密文上传、浏览器解密、配对重载 QA：通过
- Cloudflare 本地 Worker 与 SQLite Durable Object：通过
- Touch Bar helper：`x86_64 arm64`
- Touch Bar helper 源码未变时会复用已校验的 universal 二进制；需强制重编译时设置 `CMM_FORCE_NATIVE_REBUILD=1`。
- Intel 应用主程序：`x86_64`
- Apple Silicon 应用主程序：`arm64`
- 前台 Codex -> GPT：实机通过
- 前台 Claude -> CC：实机通过
- 前台 Finder 保持原选择：实机通过
- 自动切换不展开面板：实现路径已核对
