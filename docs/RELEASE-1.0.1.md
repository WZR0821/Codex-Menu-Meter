# Codex Menu Meter 1.0.1

> **本 APP 由Claude Fable5.2及GPT6 Astra开发完成。**

开发者：**Jerry Wong** · 发布日期：**2026-11-18**

本次修复 macOS 全屏应用挡住用量面板的问题。点击菜单栏、使用快捷键或通过 Touch Bar 打开时，面板采用可加入其他应用全屏空间的原生悬浮窗行为。

## 修复内容

- 在 macOS 13 及以上系统明确设置 AppKit 的 `canJoinAllApplications`，并将面板设为瞬态窗口，防止它按普通桌面窗口参与 Spaces 管理。旧系统保留跨空间与全屏辅助窗口设置。
- 显示和取得键盘焦点后重新应用悬浮属性与窗口层级，覆盖菜单栏收回及 Space 切换期间的窗口状态变化。
- 在打开后的 120 / 300 / 650 毫秒进行有限次置顶恢复；不因窗口被遮挡而跳过恢复，也不反复抢占键盘焦点。
- 面板收起、销毁或重新打开时取消旧的恢复操作，避免已经关闭的面板再次弹出。
- 区分「窗口可见」和「窗口位于当前 Space」，避免把另一空间中的面板误当成当前面板而直接关闭。

## 原有功能

继续提供 Codex / Claude 额度与重置倒计时、本地 Token 活动、额度曲线和提醒、模型雷达、Touch Bar、手机查看及可选加密云同步。平台支持范围、界面截图和首次配置方法见 [完整功能介绍](https://github.com/WZR0821/Codex-Menu-Meter/blob/main/docs/RELEASE-1.0.0.md)。

公开版不内置云同步服务地址，新用户自行部署并配置；已有用户覆盖安装保留本机设置。安装包不包含个人配置、凭据或会话日志。

## 下载与升级

- Intel：`Codex-Menu-Meter-macOS26-Intel-1.0.1.dmg`
- Apple Silicon（M 系列）：`Codex-Menu-Meter-macOS26-AppleSilicon-1.0.1.dmg`

退出旧版后，将 DMG 中的应用拖入 Applications 覆盖安装并重新打开。本次新增的原生模块已经包含在安装包中，无需额外安装 Node.js 或编译工具。源码开发者应先执行 `npm ci` 和 `npm run build:native`。

安装包使用 ad-hoc 签名，未经过 Apple Developer ID 公证；首次打开可能需要通过 macOS「隐私与安全性」确认。Release 附带源码 ZIP 与 SHA256 校验文件。

## 验证范围

- 96 项自动测试及 JavaScript 语法检查通过。
- Electron / AppKit 实际窗口检查覆盖跨应用标志、当前 Space、窗口层级、重复打开、关闭后不再弹出，以及无效和已销毁的窗口句柄。
- 在 Intel Mac 的独立原生全屏测试窗口上检查首次打开和收起后重开，系统窗口顺序显示面板位于全屏窗口之上。
- 双架构原生模块已构建；Apple Silicon 实机与多显示器组合仍需后续实机验证。

本项目为独立第三方工具，与 OpenAI、Anthropic 无隶属关系。
