# Codex Menu Meter 开发维护手册

## 1. 文档信息

- 当前基线版本：`2.1.0`
- 应用名称：Codex Menu Meter
- Bundle ID：`local.codex-menu-meter`
- 技术栈：Electron 43、Node.js、原生 Swift Touch Bar helper、Objective-C++ 面板窗口模块（Node-API）
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

这样启动没有全局点击和前台应用事件（两者都由 helper 发出）：点面板外部只能靠失焦收起，前台自动切换也不会
触发。测这两项时要开着 helper。

## 3. 项目目录

| 路径 | 用途 |
| --- | --- |
| `src/main.js` | Electron 主进程、托盘、窗口、数据抓取、设置、Touch Bar、手机服务 |
| `src/index.html` | 桌面面板结构 |
| `src/renderer.js` | 桌面面板渲染、切换、动效和交互 |
| `src/styles.css` | 桌面面板基础样式 |
| `src/apple.css` | 桌面面板的 Apple 外观层：最后加载，覆盖配色、字体、圆角和控件，含深色 |
| `src/theme.js` | 桌面面板和设置窗口的深浅色切换 |
| `src/settings.*` | 设置窗口结构、样式和行为；`settings-apple.css` 是设置窗口的 Apple 外观层 |
| `src/mobile/*` | 手机端 PWA 页面、样式（`app.css`）和渲染；文案在 `mobile.js` 的 `TEXT`，不读 `i18n.js` |
| `src/mobile/cards.js`、`token-week.js`、`usage-pace.js` | 桌面面板也加载：Token 活动卡（7 天柱状图、1 年折线、周报、单日按小时分布）和额度去向、直方图分段、用量节奏 |
| `src/mobile/minimal.css`、`light.css` | 桌面在用：`minimal.css` 只有面板加载，`light.css` 面板和设置窗口都加载；手机页面不用 |
| `src/mobile-server.js` | 只读手机端 HTTP/SSE 服务、鉴权和数据脱敏 |
| `cloud/*` | 端到端加密快照 Worker、Durable Object 与 Wrangler 配置 |
| `src/provider-config.js` | GPT、Claude、Google（Antigravity）、Kimi、GLM、Qwen 的统一配置；`defaultEnabled` 的平台在设置里没选过时默认开启 |
| `src/foreground-provider.js` | 前台应用识别和手动覆盖状态机 |
| `src/panel-window.js`、`native/panel-window.mm` | 面板窗口的呈现和全屏空间属性，原生部分编译成 `native/panel-window.node`（第 8 节） |
| `src/claude-credentials.js`、`src/claude-usage.js` | Claude 凭据判断、官方额度接口返回值解析 |
| `src/codex-four-results.js` | Codex 雷达智力页（四题众测榜）解析 |
| `src/model-catalog.js` | Codex 型号目录合并和型号版本排序 |
| `src/service-status.js` | 官方状态页解析，只看和本应用相关的组件 |
| `src/push-webhook.js` | 提醒推送的请求格式（Bark、ntfy、通用 JSON） |
| `src/activity-windows.js` | 5 小时/周周期 Token 汇总及滚动窗口降级 |
| `src/codex-token-activity.js` | Codex rollout token 事件解析 |
| `src/claude-token-activity.js` | Claude 会话记录解析、去重键和 token 口径 |
| `src/antigravity.js` | Google（Antigravity）：本机语言服务的额度读取与卡片映射、会话库（SQLite + protobuf）的 Token 解析（2.1.0，第 6.7 节） |
| `src/transcript-reader.js` | 大型会话文件的增量读取和缓存，含 `.jsonl.zst` 解压 |
| `src/daily-store.js` | 按天存档 `token-daily.json`（2.0.0） |
| `src/usage-recap.js` | 周报（上一个完整的自然周）和 5 小时窗口的纯计算，主进程调用（2.0.0） |
| `src/model-pricing.js` | 内置价格、LiteLLM 价格表筛选和费用计算（2.0.0） |
| `src/i18n.js` | 桌面面板和设置窗口的中文、English、日本語文案 |
| `src/preload.js` | 受限 IPC 接口 |
| `native/touchbar-helper.swift` | Touch Bar 原生实现，以及全局点击和前台应用事件监听 |
| `native/touchbar-helper` | 已编译的双架构 helper |
| `scripts/build-*.sh` | Touch Bar helper、面板原生模块、Intel/Apple Silicon DMG 构建；`build-icons.sh` 生成图标 |
| `scripts/after-pack.js` | electron-builder 打包后的处理 |
| `scripts/qa-*.js` | 桌面、手机、设置窗口截图 QA，云同步端到端（`qa-cloud-sync.js`），面板窗口原生属性检查（`qa-panel-window.js`） |
| `scripts/smoke-test.sh` | 打包后的冒烟测试（2.0.0，第 13.1 节） |
| `scripts/make-demo-state.js` | 生成 README 截图用的合成演示数据（2.0.0） |
| `scripts/create-handoff-zip.sh` | 生成开发交接包（`npm run package:handoff`） |
| `.github/workflows/ci.yml` | GitHub Actions（2.0.0，第 13.1 节） |
| `docs/` | 各版发布说明、开发历史、README 截图 |
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
- `sendState()`：把 24ms 内的多次变化合并成一次（`SEND_STATE_COALESCE_MS`），由 `flushState()` 一起写 Touch Bar
  状态文件（`queueTouchBarStateWrite()`）、排队推送云同步、向已认证的手机 SSE 客户端广播脱敏状态，并更新桌面面板。
- `sendSettings()`：把设置推给设置窗口。

数据刷新完成后也走 `sendState()`，所以面板、Touch Bar、手机和云同步拿到的是同一份状态。

当前刷新周期：

| 数据 | 周期 |
| --- | --- |
| Codex 额度 | 120 秒 |
| Claude 额度 | 5 分钟 |
| Kimi/GLM 等额外平台 | 5 分钟 |
| Codex/Claude 雷达 | 5 分钟 |
| Token 活动 | 5 分钟 |
| 服务状态页 | 5 分钟 |
| Codex 型号目录（读本机文件） | 60 秒 |
| Claude 断连时检查本机凭据（不联网） | 8 秒 |
| 云同步（开着时；内容没变也至少每 5 分钟上传一次，当作心跳） | 5 分钟 |
| 价格表 | 24 小时，失败 3 小时后重试 |
| 新版本检查 | 12 小时，失败 1 小时后重试 |
| Touch Bar 本地状态读取 | 0.5 秒 |

另有几次补刷：最早的一个额度重置时间过后 20 秒，刷新那个平台（接口要十几秒才切到新窗口）；Mac 唤醒或解锁后
等 4 秒全部刷新一遍，30 秒后再重试失败的额度。接口回 429 时按 `retry-after` 退避，没给就至少等 10 分钟，最长
1 小时。

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
- 型号目录：`~/.codex/models_cache.json`（`src/model-catalog.js`；雷达智力页和 Touch Bar 的型号列表据此补上雷达还没收录的型号）
- 服务状态：`https://status.openai.com/api/v2/summary.json`（`src/service-status.js`，只看 Codex、Responses、Login 组件）
- Token：
  - `~/.codex/sessions`
  - `~/.codex/archived_sessions`

两个目录里的 `.jsonl` 和 `.jsonl.zst` 都读（2.0.0 起）。Codex 会把闲置一段时间的会话压成 zstd、删掉原文件，
1.1.1 及以前不读压缩文件，开发者本机近 30 天的 Codex 用量少算了约八成。压缩文件由 `src/transcript-reader.js`
用 Node 自带的 zstd 分块边读边解压，不会整个读进内存。压缩文件不会再变，解析出的、落在统计窗口内的记录存进
`codex-archive-cache.json`，下次启动不用再解压；改了 Codex 记录的解析口径时，把 `CODEX_ARCHIVE_CACHE_VERSION`
加 1，旧缓存就会作废。

Token 活动读取 `token_count` 事件，并排除子代理继承的父任务历史。主数字只用本机
精确 token，本机没有记录时也不用后台百分比代替，不能把百分比伪装成 token 数量。
缓存命中率为 `cached_input_tokens / input_tokens`，必须保留每日的
`inputTokens` 和 `cachedInputTokens`；缺少输入数据时显示 `--`，不得显示为 0%。
着色分界为：`≥97%` 绿色，`93–97%` 黄色，`<93%` 红色（2.0.0 起；此前是 99 / 95）；无数据保持中性灰。判色必须
基于四舍五入到一位小数后的显示值，避免出现「显示 97.0% 却是黄色」。分界写在三处，要一起改：
`src/renderer.js`、`src/mobile/mobile.js`、`src/mobile/cards.js` 的 `cacheHitTone`，说明文字在
`src/i18n.js` 和 `src/mobile/mobile.js` 的 `cacheHitHint`。

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
- 额度接口：`https://api.anthropic.com/api/oauth/usage?cedar_ember=1`
- 套餐：`https://api.anthropic.com/api/oauth/profile`（钥匙串里的 `subscriptionType` 只在登录时写一次，升降级后
  不变，所以以这个接口为准；读不到时沿用上次结果，从没读到过才用钥匙串里的值）
- 刷新 token：`https://platform.claude.com/v1/oauth/token`
- 雷达：`https://claudecoderadar.com/data/claude-code-radar.json`（原站已改作他用，取不到时界面按中性状态处理，
  错误码 `radar-source-unavailable`）
- 服务状态：`https://status.claude.com/api/v2/summary.json`（只看 Claude Code、Claude API 组件）
- Token：`~/.claude/projects`

Claude OAuth 失效（401）时允许刷新一次，并写回原凭证来源；刷新后仍是 401，再换另一份凭据（文件和钥匙串里
不同的那份）试一次。凭据失效或缺失时面板显示「重新连接」卡片（第 16 节）。官方额度失败时保留最近一次
精确结果，不使用本地 token 推算百分比。

`cedar_ember=1` 让额度接口顺带返回重置卡。接口按客户端类型放行，本应用拿到的是 `eligible: false`、
`ineligible_reason: "surface"`，界面显示「官方未提供」。不要改 User-Agent 冒充 Claude CLI 去取，
也不调用兑换重置卡的接口，应用只读。

### 6.3 其他平台

- Kimi Code：`https://api.kimi.com/coding/v1/usages`，返回 404 时改试 `/usage`
- GLM：`https://open.bigmodel.cn/api/monitor/usage/quota/limit`，并自动尝试国际站
- Qwen：当前无官方额度查询接口，只显示说明

Kimi / GLM 的 API Key 存在 macOS 钥匙串（2.0.0 起），服务名 `Codex Menu Meter API Key`，账户名是平台 id
（`kimi`、`glm`），`settings.json` 里不再有 Key。1.x 存在 `settings.json` 里的 Key 由启动时的 `loadExtraApiKeys`
迁移：写进钥匙串成功后才从设置文件删掉，写不进去就留在原处照常使用。读取顺序是钥匙串、设置文件、环境变量
（见第 11 节）。设置页的 Key 输入框留空表示不修改，另有清除按钮。Key 不能进入源码、截图或交接包。

### 6.4 按天存档、1 年视图、周报和按小时分布（2.0.0）

- `src/daily-store.js` 把每天的用量存进 `token-daily.json`。每天按「模型 × 速度档 × 提示长度档」记 token 分量
  （未缓存输入、5 分钟缓存写、1 小时缓存写、缓存读、输出、请求数）和会话数，不记费用。费用每次按当前价格表
  重算，价格表更新后旧日子的费用也跟着变。最多保留 800 天（`DAILY_STORE_MAX_DAYS`）。
- 统计窗口（30 天）内的天每次由日志现算，同时写回存档；窗口之前的天只从存档取（`attachHistory`），最多给
  渲染层 366 天（`HISTORY_VIEW_DAYS`）。Claude Code 默认只留 30 天日志，30 天以前的 Claude 用量只能靠存档。
- 回填：启动约 20 秒后（`HISTORY_BACKFILL_DELAY_MS`），后台把窗口之前的全部旧日志读一遍，两个平台排队依次做，
  做完把该平台的 `backfilled` 记成 true，之后只增量更新。回填完成前 `history.status` 是 `pending`，完成后是
  `ready`；`coverageStart` 是存档里最早有记录的一天。开发者本机首次回填约 86 秒，主进程内存最高约 430 MB。
- 存档版本 `DAILY_STORE_VERSION` 变了（改了汇总口径）时，已存的天先保留，回填重跑一遍，能从日志重算的天以新算的为准。
- Token 活动的四种范围：7 天（按天的分色柱状图）、30 天（格子）、1 年、周报。本机记着的范围是发布前用过的
  `quarter`（90 天，发布前按用户要求删掉）时按 30 天显示。
- 1 年视图是 12 个自然月（本月算到今天），画成一条折线：平台主色、2px，下面一层很淡的面积；本地记录开始之前
  的月份不画线。每月一列透明的点击区，和柱状图的列同一套类名和 `data-bucket`，悬停出提示、点击选中；选中和悬停
  的月份在线上标一个圆点，悬停另画一条竖线，背后都不铺底色。最高的月份画在 84% 高（`LINE_TOP`）。
- 周报（`src/usage-recap.js` 的 `buildWeeklyReport`）：上一个完整的自然周（本地时区周一 0 点到本周一 0 点），
  主进程每次刷新 Token 活动时按本机会话记录现算（`attachRecap`），挂在 `activity.weeklyReport`：总量、读写、
  命中、费用、会话数、有用量的天数、最忙的一天和时段、前三个模型和项目（其余并成「其他 N 个」）、前一周的总量、
  这一周周额度采样里的最高已用百分比（即剩余最低点）。额度采样（`usageHistory`）只在应用开着时记，存 30 天。
  界面上五行（最忙的一天、模型、项目、额度最低、费用）平分 30 天格子区的高度，日期写在「统计详情」那一行。
- 单日按小时分布：`buildLocalActivity` 给近 30 天有用量的每一天记 `hours`（本地时间 24 个小时的 token）；没有
  记录的那天渲染层按全 0 画，每一天、两个平台这一块一样高。5 小时窗口（`fiveHourWindows`）从额度采样的
  `fiveReset` 还原：resetAt 相差 10 分钟以内算同一个窗口，落在窗口之外的旧采样不算，用量为 0 的窗口不要，
  起点取 resetAt 往前 5 小时。GPT 不限 5 小时额度时 `fiveHourUnlimited` 为 true，界面写「不限」。手机页的数据经
  `mobile-server.js` 脱敏后带上这三样（`hours`、`weeklyReport`、`fiveHourWindows` / `fiveHourUnlimited`）。
- 环比（`src/mobile/cards.js`）：近 N 天（含今天）和前 N 天比，周报和前一周比；只有 `coverageStart` 不晚于
  前一段的第一天、前一段有用量时才显示。1 年视图不比。

### 6.5 价格表与额度去向（2.0.0）

- 内置价格在 `src/model-pricing.js`。设置 `priceAutoUpdate` 打开时（默认），主进程每 24 小时从 LiteLLM 的公开
  价格表（`PRICE_TABLE_URL`）取一次，失败 3 小时后重试，带 ETag。只留 OpenAI / Anthropic 的 chat、responses
  型号（名字以 claude、gpt、o+数字、codex、chatgpt 开头），存进 `model-prices.json`。同一型号以在线价格为准，
  内置表里的快速档倍率和提示长度分档在在线价格缺这些字段时补上；在线表没有的型号用内置价格。关掉这项立即
  回到只用内置价格。设置页显示当前价格的来源、日期和型号数。
- 额度去向：`buildWindowsWithAttribution` 把本周额度周期内的本机用量按项目汇总，只给渲染层前 2 个项目
  （`ATTRIBUTION_PROJECTS`）和「其他 N 个」的合计。项目按会话的工作目录归并：子目录并入同一批记录里出现过的
  上级目录，主目录和 Documents、Desktop 这类容器目录不算项目。`src/mobile/cards.js` 按「项目费用 ÷ 本周总费用
  × 已用百分比」估算每个项目约占几个百分点；已用不到 1%（`ATTRIBUTION_MIN_USED`）或本周没有可计价的用量时，
  只显示一句说明。这是按本机日志的 API 等价费用折算的估算，不含网页版和其他设备。

### 6.6 提醒、新版本检查和诊断信息（2.0.0）

- 提醒都要设置里的通知总开关打开（`alertsActive`），提醒过的记录存在 `alert-state.json`。
- 重置卡到期（`creditExpiryAlerts`，默认开）：可用的重置卡（Claude 还包括 pending 状态的）到期前 72 小时和
  24 小时各提醒一次（`CREDIT_EXPIRY_LEADS_MS`）。
- 周额度重置前（`weeklyResetReminder`，默认开）：离周额度重置不到 12 小时、剩余不少于 20% 时，每个周期提醒一次
  （`WEEKLY_RESET_LEAD_MS`、`WEEKLY_RESET_MIN_REMAINING`）。
- 新版本检查（`updateCheckEnabled`，默认开）：启动 45 秒后查一次，之后每小时看是否到期；距上次检查满 12 小时
  （上次失败则 1 小时）才请求 GitHub Releases 的 latest 接口，带 ETag。只认 `x.y.z` 正式版，草稿和预发布不算。
  有新版本时每个版本只通知一次（`alert-state.json` 里的 `update.notifiedVersion`），不走推送 webhook，点通知打开
  Release 页面；应用不下载也不安装。设置页「更新」一栏可以立即检查。价格表和新版本检查共用这个每小时的定时器。
- 复制诊断信息：带版本、架构、系统、语言和外观、各开关状态、`DIAGNOSTIC_SLICES` 里各数据源的状态和报错、
  本机日志文件数、存档天数、价格表来源、Key 存在哪里（只写 keychain / file / none）。家目录换成 `~`，URL 参数里的
  token、key 等打码。不带用量数字、费用、Key、推送地址、手机访问密钥和云同步账号。新增数据源时要加进
  `DIAGNOSTIC_SLICES`，并确认它的报错文案里不会带出敏感内容。

### 6.7 Google（Antigravity，2.1.0）

界面名一律「Google」，菜单栏和 Touch Bar 简写 `GA`，主题色绿（GPT 蓝、Claude 橙）。面板默认三栏 GPT、Claude、Google：
`provider-config.js` 里 `claude`、`antigravity` 带 `defaultEnabled: true`，设置文件里没写过 `enabled` 就算开启。
Google 没有雷达，`renderer.js` 的 `hasRadar()` 只对 codex / claude 返回 true（桌面 `.panel.no-radar`、手机
`body[data-radar="off"]` 把切换藏起来）。

额度（`readAntigravityUsage`，2 分钟一次）：

- Antigravity 运行时在 `~/.gemini/antigravity/daemon/hub_<port>.json` 写下 pid、端口和 `csrfToken`，进程活着才用。
- 向 `127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary` 发 Connect JSON 的 POST
  （头 `X-Codeium-Csrf-Token`、`Connect-Protocol-Version: 1`），`GetUserStatus` 只取 `userTier.name` 当套餐名，失败也不影响额度。
  `GetUserStatus` 的返回里有账号邮箱和姓名，不进状态；`csrfToken` 不落盘、不进诊断信息。
- 返回 `groups[].buckets[]`（`window` 为 `5h` / `weekly`，`remainingFraction`、`resetTime`）。proto3 省略 0：有 `resetTime`
  没 `remainingFraction` 表示用完；剩 1 且没 `resetTime` 表示还没开始计时（`inactive`）。
- 卡片映射：主组是 Gemini。「一周」卡的大数字是 Gemini 一周，别组的一周以 `fold: 'week'` 并进同一张卡（双道条）；
  「5 小时」卡优先 Gemini 5h，没有就用别组的 5h，卡片右上角写分组名。窗口对象带 `group`、`label`、`shortLabel`（手机窄屏用）、
  `fold` 和唯一键 `name`（一周是组名，5 小时是 `<组名> · 5h`，额度采样和提醒按它区分）。免费档（Starter）用真实数据验过，
  付费档只有单元测试里的模拟结构。
- Antigravity 没开时报 `antigravity-not-running`，保留上一次的额度。

Token 活动（`createAntigravityActivityReader`，30 秒快照）：

- 读 `~/.gemini/antigravity/conversations/*.db`（SQLite）。为了不在原目录生成 `-shm` / `-wal`，先把 db 和 `-wal` 复制到
  临时目录，再用 Node 自带的 `node:sqlite` 打开副本；原文件只读不写，按文件签名缓存解析结果。
- `gen_metadata.data` 是 protobuf：1 chat_model、2 step_indices；ChatModelMetadata 的 4 usage、19 / 22 型号、20 custom_metadata
  （含 last_step_index）；ModelUsageStats 的 2 input（不含缓存）、3 output（含思考）、4 cache_write、5 cache_read、11 response_id
  （去重键 `ag:<responseId>`）。时间取 `steps.metadata` 的字段 1，工作目录取 `conversation_summaries.db` 的 `workspace_uris`。
  字段含义是对照真实数据推出来的，没有官方文档，Antigravity 升级后先跑 `test/antigravity.test.js` 和真实数据核对。
- 口径和 Claude 一致：总量 = 输入 + 缓存写 + 缓存读 + 输出，读写 = 输入 + 缓存写 + 输出，命中率 = 缓存读 / 全部输入。
  Gemini 型号不在价格表里，费用写「未定价」（额度去向显示 `attrUnpriced`），命中率不分色。
- `buildWindowsWithAttribution` 对 Antigravity 按窗口所属的组筛记录（`antigravityEntriesForGroup`：Gemini 组只算 Gemini 型号，
  其他组算其余型号）。按天存档、1 年视图、周报、按小时分布和 5 小时窗口还原都走第 6.4 节的同一套代码。

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
| Antigravity | `com.google.antigravity`（2.1.0） |

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

1.0.1 起，窗口呈现由 `src/panel-window.js` 管理，`native/panel-window.mm` 使用公开 AppKit
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
并重新 `setBounds`。`PANEL_HEIGHT` 只是首帧的起点。这样明细都收起时用量页不需要滚动；附加平台虽然保留额度曲线，
但没有 Token 区，也不会留下大片空白。2.0.0 把上限从 780 提到 840：单日明细加了按小时分布，展开「统计详情」后
约 810–830。窗口高度同时受屏幕限制（工作区高度减 24），屏幕矮时（例如开发机可用高度 787）或几块明细同时展开时，
多出的部分在面板里滚动，滚动条位置固定，宽度不变。

- 渲染层每次上报当前可见内容的实际高度，不按页缓存；只有不到 3px 的变矮不报。切换平台、页面或雷达视图后
  先等 `PANEL_HEIGHT_SWITCH_HOLD_MS`（180ms）再报。
- 主进程：变高不论多少都立刻跟上；6px（`PANEL_HEIGHT_EPSILON`）以内的变矮不收，更大的变矮等
  `PANEL_HEIGHT_SHRINK_DELAY_MS`（80ms）再收，避免刷新中间态引起窗口抖动；尺寸变化用 180–260ms 的动画过渡。
  2.0.0 以前 6px 以内的变高也被略过，展开明细后内容溢出一点就冒出滚动条，整页变窄 8px。
- GPT 和 Claude 来回切时窗口尺寸不变，靠的是两边版式相同，不是缓存。改用量页版式时两边要一起改，并按第 14 节
  第 19 条截图核对两边高度一致。
- `apple.css` 给 `.tab-panel` 设了 `scrollbar-gutter: stable both-edges`，滚动条出现与否都不改变内容宽度。
- 额度标题行右侧的明细按钮 `#quotaDetailsToggle` 平时透明，指针移到额度区域或用键盘聚焦时才显示，隐藏时仍占位，
  标题行不跳。桌面写在 `apple.css` 的 `@media (hover: hover)` 里；手机写在 `app.css` 的
  `@media (hover: hover) and (pointer: fine)` 里，所以触屏上一直显示。

关键交互约束：

- 点击面板外部关闭（全局点击由 Touch Bar helper 发出，见第 9 节）。
- 「跟随菜单栏收起」（`autoHideWithMenuBar`，默认开）开着时，不论是否全屏，光标离开面板和屏幕顶部 44px 的
  菜单栏区域持续 0.7 秒就收起，在面板或菜单栏区域内则保持；每 500ms（`PANEL_FOLLOW_MS`）检查一次，刚打开的
  850ms（`AUTO_HIDE_GRACE_MS`）内不收。
- 自动平台切换不得打开面板。
- 面板首次点击前已预创建和预热，避免冷启动卡顿。
- 用量页应完整显示且不产生多余纵向滚动。
- 雷达页和设置页允许滚动，并保留底部余白与回弹效果。

改动窗口尺寸或用量页任何区块的间距后，跑 `npm run qa:render`：它会按渲染层上报的
高度调整窗口再截图，并在用量页仍需滚动时直接失败。

## 9. Touch Bar

Touch Bar 使用私有 `DFRFoundation` API，因此由单独的 Swift helper 负责。主应用通过
`touchbar-state.json` 输出状态，通过 helper stdout 接收点击和前台事件。

主要协议（helper 的 stdout，每行一条）：

```text
touchbar-provider:<provider>
touchbar-open-panel
pointer-down
foreground-app:<bundleId>\t<name>\t<bundlePath>\t<pid>
```

- `touchbar-provider:`：点平台按钮，按手动选择切换平台。
- `touchbar-open-panel`：点额度块，打开面板（已开着就不动）并刷新当前平台。
- `pointer-down`：全局鼠标按下，主进程据此判断是否点到了面板外部。
- `foreground-app:`：前台应用变化（第 7 节）。

反方向只有一条 stdin 命令 `present`：每次打开面板时主进程发给 helper，让它重新呈现 Touch Bar；Mac 唤醒后
helper 也会自己重新呈现。

当前 UI 规则：

- 显示 5h/7d 剩余额度、进度条和重置倒计时（0.10.16 起；每一块是整条高度的灰色圆角块）。
- 额度条颜色跟用量节奏走（`quotaColor`）：剩余 ≤10% 一律红色；有节奏档位（`tier`）时 critical 红、serious 橙、
  warning 黄、其余绿；没有档位时按剩余比例，≤20% 红、≤50% 黄、其余绿。主进程只在节奏算得出（刚开窗时还
  算不出）或已是 critical 时才给 `tier`；附加平台没有节奏，一直按剩余比例。
- 平台切换按钮用平台色：GPT 蓝、CC 橙、Kimi 粉、GLM 紫、Qwen 青；只启用一个平台时是灰色。
- 有 IQ 数据的平台显示六个 IQ，每页三个，点 IQ 区翻页。Codex 第一页取各系列最新型号里版本最新的三个
  （每个优先 max 档），第二页固定为 sol medium、terra max、luna max 的最新版；其他平台按型号版本从新到旧取
  前六个（`createTouchBarProviderPayload`）。
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
- 监听地址：随设置里的访问范围（`mobileListenScope`）变。局域网（默认）听 `0.0.0.0`；Tailscale 和仅本机
  都只听 `127.0.0.1`，Tailscale 由 `tailscale serve` 转发进来，仅本机还会拒绝经代理转来的请求。改范围会重建服务
- 页面路径：`/mobile/`
- 状态接口：`/api/state`
- 实时更新：SSE
- 鉴权：URL token 首次验证后写入 HttpOnly Cookie

PWA manifest 的 `start_url` 必须保留访问 token，否则从主屏幕启动会提示密钥无效。
更换密钥时，服务器会断开已有 SSE 客户端。

Tailscale 只负责远程网络可达性。应用会优先提供 Tailscale 地址，但不会把 Codex 或
Claude 凭证发送到手机；手机只收到 `createMobilePayload()` 生成的只读脱敏数据。

页面样式（0.10.17 起）：

- 手机页面只加载 `src/mobile/app.css`，配色与桌面的 `src/apple.css` 一致，深浅色跟随手机系统
  （0.11 起，`prefers-color-scheme`）。同目录下的 `minimal.css` 只有桌面面板（`src/index.html`）加载，
  `light.css` 由桌面面板和设置窗口（`src/settings.html`）加载，都不属于手机页面，不要删。
- 同目录的 `usage-pace.js`、`token-week.js`、`cards.js` 桌面面板也加载，改它们要同时核对桌面和手机。
- 手机页面的文案在 `mobile.js` 的 `TEXT` 里，不读 `src/i18n.js`；两边都有的文案要一起改。
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

部署配置绑定 Cloudflare SQLite Durable Object `SYNC_ACCOUNTS`。公开版不预填地址（`src/main.js` 的
`DEFAULT_CLOUD_SYNC_SERVER_URL` 为空）：部署后在设置里填 Worker 地址，或首次启动时用环境变量
`CMM_SYNC_SERVER_URL` 预填。已经填过地址的设置不受影响。

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
| `settings.json` | 语言、外观、开机启动、平台开关、提醒与更新开关、手机访问密钥（2.0.0 起不含 API Key） |
| `usage-history.json` | 最近 30 天额度采样（最近 1 天是原始采样，更早的按 15 分钟合并） |
| `token-daily.json` | 每天的 token 分量汇总，最多 800 天（2.0.0） |
| `codex-archive-cache.json` | Codex 压缩会话的解析缓存（2.0.0） |
| `model-prices.json` | LiteLLM 价格表缓存（2.0.0） |
| `alert-state.json` | 已发过的提醒、重置卡到期提醒记录、新版本检查结果 |
| `radar-cache.json` | 雷达数据缓存 |
| `touchbar-state.json` | Touch Bar 脱敏显示状态 |
| `touchbar-helper.log` | helper 启停、点击和自动切换日志 |
| `claude-reconnect.command` | 「重新连接 Claude」时生成、交给「终端」打开的登录脚本 |

钥匙串里另有两类条目：`Codex Menu Meter Cloud Sync`（云同步密钥）和 `Codex Menu Meter API Key`（Kimi / GLM
的 Key，2.0.0 起）。

这些文件含本机设置或敏感字段，不能复制到源码仓库、开发交接 ZIP 或公开 issue。

调试环境变量：

| 变量 | 用途 |
| --- | --- |
| `CMM_USER_DATA_DIR` | 使用独立 Electron 数据目录 |
| `CMM_DISABLE_TOUCHBAR=1` | 不启动 Touch Bar helper |
| `CMM_DEBUG_STATE_PATH` | 每 2 秒输出一次主状态快照 |
| `CMM_SYNC_SERVER_URL` | 新安装时预填加密云同步 Worker 地址 |
| `CMM_DEBUG_EVENTS=1` | 在控制台打印前台切换、面板开关等事件 |
| `KIMI_API_KEY` / `KIMI_CODING_API_KEY` | 钥匙串和设置里都没有 Kimi Key 时使用 |
| `GLM_API_KEY` / `ZHIPU_API_KEY` | 钥匙串和设置里都没有 GLM Key 时使用 |

## 12. 测试与视觉 QA

基础检查：

```bash
npm run lint
npm test
```

当前基线为 136 项单元测试。重点覆盖：

- Codex token 解析和子代理去重
- 5 小时/周 Token 周期边界与滚动窗口降级
- 增量会话读取
- 前台应用识别、手动覆盖和恢复自动切换
- 手机鉴权、SSE 断开和数据脱敏
- 平台配置升级兼容
- Claude 会话记录解析、去重和 token 口径
- Claude 凭据判断与官方额度解析、状态页解析、推送请求格式
- 面板窗口呈现与开关、用量节奏、四题榜单解析
- 云同步密钥派生、加解密、错误密钥拒绝与 HTTPS 校验
- Durable Object 首次绑定、鉴权、旧快照拒绝和删除
- Token 活动 7 天直方图的分色、分段、柱高和型号写法
- Codex `.jsonl.zst` 压缩会话的读取和缓存（2.0.0）
- 按天存档的分量记录、增量构建、合并、版本变化后重建和裁剪（2.0.0）
- 7 天和 1 年的分段、1 年折线的画法、周报的整理和排版、单日按小时分布和 5 小时窗口、存档与实时数据的拼接、环比的显示条件、额度去向的折算（`test/cards.test.js`，2.0.0）
- 周报的统计（上一个完整的自然周、最忙的一天和时段、模型和项目排名、周额度最低点）和 5 小时窗口的还原（`test/usage-recap.test.js`，2.0.0）
- LiteLLM 价格表的筛选、校验和 272K 分档（2.0.0）

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

`qa-render.js` 的常用环境变量：`CMM_QA_TOKEN_RANGE=week|month|year|recap` 切 Token 活动的范围，
`CMM_QA_OPEN_QUOTA=1` 展开额度明细，`CMM_QA_OPEN_TOKEN=1` 展开「统计详情」，`CMM_QA_MEASURE=1` 打印尺寸，
`CMM_QA_EVAL='<表达式>'` 截图前在页面里求值，`CMM_QA_APPEARANCE=dark` 深色。展开好几块明细时内容会超过面板上限，
脚本默认报「需要滚动」，加 `CMM_QA_ALLOW_SCROLL=1` 只截图。README 截图用 `scripts/make-demo-state.js` 生成的合成数据拍。

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

1. 跑 `npm run build:native`：Touch Bar helper 和 `panel-window.node` 比源码新、且已含双架构时直接复用，
   要强制重编加 `CMM_FORCE_NATIVE_REBUILD=1`。
2. 用 electron-builder 构建目标架构应用。
3. 清理 Finder 扩展属性。
4. 验证 ad-hoc 签名。
5. 用 ULMO/LZMA 生成体积更小的 DMG。

当前包是 ad-hoc 签名，没有 Apple Developer ID 公证。对外正式分发前，需要补充
Developer ID、hardened runtime、entitlements 和 notarization 流程。

版本升级时至少同步：

- `package.json`
- `package-lock.json` 顶部两个版本字段
- `README.md` 的版本表和版本历史
- `docs/RELEASE-<version>.md`（新版本的发布说明）
- 本手册第 1 节的当前基线版本

`scripts/qa-settings.js` 从 2.0.0 起直接读 `package.json` 的版本，不用再手改。

### 13.1 GitHub Actions（2.0.0）

`.github/workflows/ci.yml` 在推送到 `main`、提交 PR 和手动触发时运行：

- `test`（ubuntu-latest，Node 24）：`npm ci`（设 `ELECTRON_SKIP_BINARY_DOWNLOAD=1`，不下载 Electron）、
  `npm run lint`、`npm test`。
- `package-macos`（macos-15，和本机打包用的 Xcode 16 同一代工具链）：`npm run build:native`，用 electron-builder
  打 Apple Silicon 版 `.app`（`--dir`，不出 DMG）到 `$RUNNER_TEMP`，验证签名，再用 `scripts/smoke-test.sh` 冒烟测试。

`scripts/smoke-test.sh <应用路径>` 本机也能跑：它用一个临时数据目录启动应用，设置里关掉所有联网和提醒功能，
等应用写出 `provider`、`tokenActivity.status` 为 `ok`、`history.status` 为 `ready` 的状态快照才算通过。
超时默认 90 秒（`CMM_SMOKE_TIMEOUT`），`CMM_SMOKE_KEEP=1` 保留临时目录便于排查。

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
18. 版本号、README 版本表和版本历史、`docs/RELEASE-<version>.md`、本手册第 1 节都已同步。
19. 桌面 GPT/Claude × 四种时间范围（7 天 / 30 天 / 1 年 / 周报）× 额度明细收起/展开：同一状态下面板尺寸相同，切换不跳；手机三档屏高下四种范围都在一屏内。
20. `bash scripts/smoke-test.sh <应用路径>` 通过（把 `HOME` 指向空目录可模拟 CI）。
21. 安装包里 app.asar 的 `src/` 与仓库逐文件一致；`package.json` 只差 electron-builder 去掉的 `scripts`、`devDependencies`、`build`。
22. 从上一版覆盖安装后，首次启动的回填能走完（`token-daily.json` 里两个平台的 `backfilled` 都是 true），记下用时和主进程内存峰值。
23. 推送后 GitHub Actions 的两个任务都通过。

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
`pointer-down` 由 Touch Bar helper 发出；helper 没在跑（例如用了 `CMM_DISABLE_TOUCHBAR=1`）时，只能靠失焦收起。
「跟随菜单栏收起」开着时，光标离开面板和菜单栏区域 0.7 秒也会收起（第 8 节）。

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
5. 凭据失效或缺失（`claude-auth-expired`、`claude-no-creds`）时，面板显示「重新连接」卡片。点它会生成
   `claude-reconnect.command` 交给「终端」运行 `claude auth login --claudeai`，登录由用户在浏览器里完成。
   断连期间每 8 秒读一次本机凭据（不联网），发现重新登录后自动恢复。

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

## 18. 当前 2.0.0 验证状态

- JavaScript 语法检查：通过
- 单元测试：136/136 通过；另在 UTC、洛杉矶、基里蒂马蒂三个时区和模拟 Linux 平台下各跑过一遍
- 桌面面板（合成数据）：GPT/Claude × 四种时间范围（7 天 / 30 天 / 1 年 / 周报）× 额度明细收起/展开共 16 种组合，收起 522、展开 714，额度卡宽 185，Token 活动卡 378×214，无溢出；1 年折线的圆点和折线位置误差为 0，周报五行都没有截断；单日按小时分布两个平台都是 94px；深色外观、按钮悬停显示、强制出现滚动条时宽度不变都核对过
- 真实面板窗口：反复展开、收起，两个平台宽度不变；真实数据下展开后 GPT、Claude 一样高
- 手机页面：390×844、375×667、320×568 三档下四种范围都在一屏内，底边在各范围之间一致（725 / 548 / 472）；深色外观看过
- Touch Bar helper 和 `panel-window.node`：`x86_64 arm64`；Touch Bar helper 源码未变时会复用已校验的 universal 二进制，需强制重编译时设置 `CMM_FORCE_NATIVE_REBUILD=1`
- Intel 应用主程序 `x86_64`，Apple Silicon 应用主程序 `arm64`，两个都通过 `codesign --verify --deep --strict`
- 冒烟测试：打好的 Intel 版在空用户目录下 26 秒通过
- 本机从 1.1.1 覆盖安装：约 88 秒补完历史，主进程内存峰值约 400 MB，之后回落到约 190 MB；价格表取到 135 个型号；新版本检查正常
- API Key 钥匙串迁移：用测试 Key 验证过成功和失败两条路径
- 没验证：Apple Silicon 实机；真实 Kimi / GLM Key 的迁移；Apple 公证（安装包是 ad-hoc 签名）
- 前台自动切换、全屏菜单栏、Touch Bar 的实机检查：2.0.0 没有改 `foreground-provider.js`、`panel-window.js` 和 `native/`，本版没有重测，沿用 1.0.0 时的结论
