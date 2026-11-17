# Codex Menu Meter 1.0.0

**主要由 Claude Fable5.2 和 GPT6-Astra 生成。开发者：Jerry Wong。**

首次 GitHub 发布，2026-11-17。

## 修复

- Codex 重复播报相同累计 Token 快照时不再重复计数；没有累计快照时仍保留独立调用。
- Claude 官方接口返回空对象或无效百分比时，不再误报剩余 100%，并可回退到有效的 `limits[]` 窗口。
- 日志缓存即使文件没有新增内容，也会按 30 天窗口清理过期数据；乱序的历史条目同样会被过滤。
- 日志文件被替换后从头解析，避免把旧文件的统计混入新文件；读取失败不会提前推进缓存解析状态。

## 图标与发布设置

- 新图标融合蓝紫色 Codex 云形终端与橙色 Claude 星芒；Mac 图标与手机主屏图标统一。
- 新安装不再内置私人云同步地址。已有本机设置和配对保持兼容。
- 源码不含用户登录信息、API Key、本机会话日志、设置文件、交接记录和历史安装包。

## 下载与安装

- Intel Mac：`Codex-Menu-Meter-macOS26-Intel-1.0.0.dmg`
- Apple Silicon：`Codex-Menu-Meter-macOS26-AppleSilicon-1.0.0.dmg`
- SHA-256 校验值随 Release 的 `SHA256SUMS.txt` 提供。

挂载 DMG，将 Codex Menu Meter 拖入 Applications。该版本采用 ad-hoc 签名，未经过 Apple Developer ID 公证。首次打开可能需要在「系统设置 → 隐私与安全性」中选择「仍要打开」。文件名沿用历史 macOS26 命名，不代表完成了所有系统版本的兼容测试。

## 验证

- 91 项自动测试通过，JavaScript 语法检查通过。新增用例在修复前复现了重复统计、无效百分比、缓存保留与文件替换问题。
- 桌面 GPT / Claude 用量、Claude 雷达、浅色和深色、设置页通过布局检查及截图审阅。
- 手机 390×844、375×667、320×568 用量页通过溢出与裁切检查。
- 本地 Cloudflare Worker 的加密快照、首次配对、URL fragment 清除和重新载入配对验证通过。
- 生产依赖 `npm audit --omit=dev`：0 个已知漏洞。

实机验证仅覆盖当前 Intel Mac；Apple Silicon 构建通过架构及签名检查，尚未在 Apple Silicon 实机启动。外部官方 API、雷达服务及用户自建云服务的可用性取决于各自服务。真实手机 Safari、Touch Bar 硬件与开机启动没有进行完整回归。

本项目为独立第三方工具，与 OpenAI、Anthropic 无隶属关系。仓库没有指定开源许可证。
