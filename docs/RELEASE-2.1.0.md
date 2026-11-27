# Codex Menu Meter 2.1.0

> [!IMPORTANT]
> **本 APP 由 Claude Fable 5.2 及 GPT6 Astra 开发完成。**

开发者：**Jerry Wong** · 版本日期：**2026-11-28**

2.1.0 的重点是**新增 Google Antigravity 支持**。Antigravity 和 GPT、Claude 并列成为第三个完整平台，额度卡、重置倒计时、额度曲线、Token 活动、提醒、Touch Bar 和手机页面都有。面板默认三栏，从左到右是 GPT、Claude、Google，主题色分别是蓝、橙、绿。这一版还修了手机页面的五个问题。2.0.0 的内容见 [2.0.0 发布记录](RELEASE-2.0.0.md)。

## 主要更新

### 新增 Google Antigravity

- **和 GPT / Claude 同一套界面**：
  - 面板里多了「Google」一栏，额度卡、重置倒计时、近 24 小时 / 7 天额度曲线和触顶预估都有。
  - Token 活动的 7 天、30 天、1 年和周报四档都能看，单日明细里也有按小时分布和 5 小时窗口。
  - 额度提醒、额度去向、菜单栏、Touch Bar、手机页面和云同步都包括 Google。自己部署了云同步服务的用户，要重新运行 `npm run sync:deploy`，云端的手机页面才会显示 Google。
  - 菜单栏标题写成 `GA 5h：… 周：…`，格式和 GPT、Claude 一样。
- **按 Antigravity 自己的额度分组显示**：Antigravity 把额度分成 Gemini 和 Claude/GPT 两组，两组的 5 小时、一周额度各算各的。
  - 「一周」卡的大数字是 Gemini 的一周额度。Claude/GPT 组的一周额度并进同一张卡，画成第二道进度条，和 Claude 面板里 Fable 的显示方式一样。
  - 「5 小时」卡显示 Gemini 的 5 小时额度。免费档没有这一项，就改为显示 Claude/GPT 组的 5 小时额度。卡片右上角写着这个额度属于哪一组。
  - 标题后面显示套餐名，例如「Google 额度 · Starter」。还没开始计时的额度写「使用后开始计时」。
- **Token 活动只看本机记录**：
  - 读取 Antigravity 在本机保存的会话记录，统计输入、缓存读写和输出。
  - 「同周期 Token」按额度分组统计：Gemini 额度只算 Gemini 型号的用量，Claude/GPT 额度只算其余型号。
  - 口径和 Claude 相同：总量包含缓存读取，读写量不含缓存读取，命中率是缓存读取占全部输入的比例。
- **Gemini 暂不折算费用**：价格表里还没有 Gemini 型号，这些用量显示为「未定价」，额度去向也会说明这一点。价格表里有的型号照常折算。Gemini 的命中率暂不分红黄绿。
- **只在本机读取，不连外网**：
  - 额度向 Antigravity 在本机（`127.0.0.1`）运行的语言服务请求。鉴权令牌只在内存里使用，不写进任何文件。
  - 返回内容里的账号邮箱和姓名既不使用也不保存。
  - 会话记录先复制到临时目录再读，不改动 Antigravity 的原文件。
  - 详见 README 的「数据与隐私」。
- **其他细节**：
  - Antigravity 进入前台时，「跟随前台应用」会把菜单栏和 Touch Bar 切到 Google。
  - Antigravity 没开时，提示「Antigravity 没在运行，打开后自动读取额度」，并保留上一次读到的额度。
  - Google 没有模型雷达，切到 Google 时雷达切换按钮会隐藏。

### 三栏和配色

- 新装用户的面板默认显示 GPT、Claude、Google 三栏。
- 从旧版升级的用户也会自动多出 Google 一栏。设置里新增了 Google 开关，没有安装 Antigravity 的话可以在这里关掉。
- 主题色改为 GPT 蓝、Claude 橙、Google 绿（GPT 以前是绿色），桌面面板、手机页面和 Touch Bar 一致。

### 手机页面修复

- **「▲偏快」标记被挤没**：一周卡并入专项额度（如 Fable）后，用量偏快的标记会被压成半个三角，文字完全看不见。现在这种卡片只显示完整的 ▲。
- **英文、日文下标题被截断**：Token 活动的标题和更新时间会被时间范围切换按钮挤掉。现在英文的「Weekly」改为「Recap」，日文标题改为「トークン活動」，标题不再被压缩。
- **换了访问密钥后只显示「Mac 已离线」**：页面会一直重连，不提示密钥失效。现在连接失败时会先确认原因，密钥失效就直接提示，并停止重连。
- **型号名和金额写法与桌面不一致**：雷达页的模型消耗以前写成「claude opus 5 5」「US$128.4」，现在和桌面一样写成「Opus 5.5」「$128」。
- **页面标题写死中文**：浏览器标题、页首标题和导航的无障碍标签现在会跟着界面语言变。

### 其他

- README 换上了三栏的新截图，并新增 Google 面板截图。截图仍用合成演示数据，`scripts/make-demo-state.js` 新增了 Google 的演示数据。
- 维护手册新增 Google（Antigravity）一节（第 6.7 节），写明数据来源、字段含义和卡片映射。

## 下载与安装

- Intel：`Codex-Menu-Meter-macOS26-Intel-2.1.0.dmg`
- Apple Silicon（M 系列）：`Codex-Menu-Meter-macOS26-AppleSilicon-2.1.0.dmg`

先退出旧版，再把 DMG 里的应用拖进「应用程序」文件夹覆盖安装，然后重新打开，本机设置会保留。要看 Google 额度，需要先打开 Antigravity 并登录；Token 活动只要本机有 Antigravity 的会话记录就能统计。

安装包使用 ad-hoc 签名，没有经过 Apple 公证。首次打开时，可能需要在 macOS「隐私与安全性」里允许打开。

## 验证情况

- 145 项单元测试全部通过，JavaScript 语法检查通过。新增的 8 项测试覆盖额度分组映射（免费档和模拟的付费档）、本机服务发现、会话记录解析、去重和型号名写法。
- 在开发者本机用免费档（Starter）的真实 Antigravity 数据跑通了全流程：额度、套餐名、Token 活动、按天存档和周报都正常生成。
- 桌面面板：
  - GPT、Claude、Google 三栏在浅色和深色外观下都截图核对过。
  - 收起时三栏高度相同，切换平台时窗口高度不变；展开明细后三栏也一样高。
- 手机页面：
  - 三个平台在 390×844、375×667、320×568 三种屏幕尺寸下，四种时间范围都在一屏内，没有横向溢出，控制台没有报错。
  - 英文和日文界面也看过。
  - 自带的手机页面 QA 脚本全部通过。
- Touch Bar：离线渲染出的图里，Google 显示为绿色的 GA 按钮。
- 打包：
  - 两个 DMG 中的应用都通过 `codesign --verify --deep --strict`，主程序分别是 x86_64 和 arm64，Touch Bar helper 和面板原生模块都含双架构。
  - 安装包里的 `src/` 和仓库逐文件一致。
  - 打好的 Intel 版在空用户目录下用 `scripts/smoke-test.sh` 跑，约 25 秒通过。这个环境里没有 Antigravity，Google 一栏正常显示「没在运行」。
- 在开发者本机从 2.0.0 覆盖安装：设置保留，三栏都在，Google 的额度和 Token 活动都读到了。
- 没有验证的：
  - Apple Silicon 实机、iPhone 真机、Touch Bar 实机。
  - 付费档的 Antigravity 账号：额度分组按接口结构做了适配，只有单元测试里的模拟数据。
- Antigravity 的本机接口和会话记录格式没有公开文档，Antigravity 升级后可能需要跟着调整。

本项目为独立第三方工具，与 OpenAI、Anthropic、Google 无隶属关系。
