# 开发历史时间线

本 APP 由Claude Fable5.2及GPT6 Astra开发完成。

本页于 2026 年 11 月 18 日整理，依据维护者确认的 26 份本机应用快照，补录 22 个版本的历史提交。时间范围为 2026 年 7 月 20 日至 11 月 17 日，以下时间均为日本时间（Asia/Tokyo，UTC+09:00）。

## 补录方式

- 每份快照对应一条提交，保留该版本实际的应用代码、资源与包元数据；同一天的多次 1.0.0 修订分别记录。
- 作者日期与提交者日期采用维护者确认的快照时间。提交说明和快照内的 `HISTORICAL-SNAPSHOT.md` 明确标注补录时间及来源；历史日期不表示当时已推送或发布到 GitHub。
- 历史分支通过一次合并接入 `main`，保留原有公开提交、当前应用代码及 `v1.0.0`、`v1.0.1` 发布标签。`history/` 前缀的标签只用于定位历史快照，不对应新增安装包发布。
- 从 `app.asar` 恢复的范围为 `package.json`、`src/`、`assets/icon.icns`。安装包未保留的测试、构建脚本、原生助手源码和云端源码没有用后来版本补造，因此历史快照不是完整的原始开发仓库。
- 15 份旧快照中内置的私人云同步地址已清空，保留自行配置入口；其余应用文件与备份逐字节一致。未纳入第三方依赖、个人配置或凭据。
- 未找到快照的版本没有补造，表中版本号存在间隔。

## 快照与提交

| 版本 | 快照日期（JST） | 应用文件数 | 相比前一快照变动文件数 | 历史提交 |
|---|---|---:|---:|---|
| 0.8.3 | 2026-07-20 20:34:57 | 13 | 13 | [`2b145c8e`](https://github.com/WZR0821/Codex-Menu-Meter/commit/2b145c8e73f23291ff67ad5652bef06abc9eab5a) |
| 0.9.0 | 2026-07-23 14:40:04 | 19 | 13 | [`72dca1da`](https://github.com/WZR0821/Codex-Menu-Meter/commit/72dca1da52f372cdfe676a3ff588e410c65aa50d) |
| 0.9.1 | 2026-07-23 15:15:40 | 19 | 5 | [`c20339a0`](https://github.com/WZR0821/Codex-Menu-Meter/commit/c20339a0aba163f5cec101e6cfd680d7e3c32565) |
| 0.9.2 | 2026-07-23 16:12:31 | 19 | 5 | [`1d522286`](https://github.com/WZR0821/Codex-Menu-Meter/commit/1d5222864e95869f7c2666fa30512bd1cf2e0d50) |
| 0.9.3 | 2026-07-23 16:40:51 | 19 | 8 | [`2e0cc652`](https://github.com/WZR0821/Codex-Menu-Meter/commit/2e0cc652895ae412d1c0423b0ca003bdbbc5c0da) |
| 0.9.4 | 2026-07-23 17:04:08 | 19 | 6 | [`3fc2494c`](https://github.com/WZR0821/Codex-Menu-Meter/commit/3fc2494c9a537952f5052f0cdd62879c146297dc) |
| 0.9.5 | 2026-07-26 16:54:40 | 19 | 3 | [`4f22efd1`](https://github.com/WZR0821/Codex-Menu-Meter/commit/4f22efd1d1ba17a93b34c5f60991673dbcb39503) |
| 0.9.6 | 2026-07-26 17:17:40 | 20 | 5 | [`da0eebe9`](https://github.com/WZR0821/Codex-Menu-Meter/commit/da0eebe99c25537365f5f5595a2ccabdb195aa83) |
| 0.9.7 | 2026-07-26 20:51:29 | 20 | 3 | [`1801da57`](https://github.com/WZR0821/Codex-Menu-Meter/commit/1801da5738202f956ab736e8b83dd44a9e37f353) |
| 0.9.9 | 2026-07-29 14:00:50 | 21 | 7 | [`1f7d6f3f`](https://github.com/WZR0821/Codex-Menu-Meter/commit/1f7d6f3f01f6d7567a8040ed8d04ed11b28135ff) |
| 0.10.0 | 2026-07-30 00:35:28 | 23 | 13 | [`9bf1e68b`](https://github.com/WZR0821/Codex-Menu-Meter/commit/9bf1e68be2b3c000d53df059f427578fd3d60ab8) |
| 0.10.1 | 2026-08-02 14:08:38 | 23 | 9 | [`fa1cb191`](https://github.com/WZR0821/Codex-Menu-Meter/commit/fa1cb1910f26f13606c09627a9b60f2e0e3df64d) |
| 0.10.2 | 2026-08-02 16:51:39 | 24 | 9 | [`d718487a`](https://github.com/WZR0821/Codex-Menu-Meter/commit/d718487a073fda84c098b61e58ec084712f2cdb2) |
| 0.10.3 | 2026-08-02 18:11:52 | 24 | 11 | [`358c523c`](https://github.com/WZR0821/Codex-Menu-Meter/commit/358c523cdbcb4646f0bd3b1e74f9025185a57bcd) |
| 0.10.4 | 2026-08-02 18:26:29 | 24 | 3 | [`7bab2690`](https://github.com/WZR0821/Codex-Menu-Meter/commit/7bab26907db57e3dd1675509b8b227affb7f3945) |
| 0.10.5 | 2026-08-03 13:23:15 | 25 | 3 | [`2efd8234`](https://github.com/WZR0821/Codex-Menu-Meter/commit/2efd8234cb9e311042f800b5c133ee9abebdf0d8) |
| 0.10.13 | 2026-10-17 18:17:13 | 29 | 17 | [`88b20207`](https://github.com/WZR0821/Codex-Menu-Meter/commit/88b20207e47524fc1191ecd131b1cff16950b89c) |
| 0.10.14 | 2026-11-10 19:38:14 | 32 | 10 | [`6c57c77e`](https://github.com/WZR0821/Codex-Menu-Meter/commit/6c57c77edb851effab372f5cdb23409fc3d4d5ef) |
| 0.10.15 | 2026-11-12 10:50:33 | 33 | 9 | [`1fd32138`](https://github.com/WZR0821/Codex-Menu-Meter/commit/1fd321382ff93989b090ae64092b9ac690a78d99) |
| 0.11.0 | 2026-11-13 20:43:43 | 41 | 26 | [`b784c711`](https://github.com/WZR0821/Codex-Menu-Meter/commit/b784c7116a9d46b4af4d8452a61f9c1d60085aeb) |
| 0.11.1 | 2026-11-15 20:27:07 | 41 | 2 | [`d073a1e4`](https://github.com/WZR0821/Codex-Menu-Meter/commit/d073a1e4cf03ff89fc711baf91306323b20b0919) |
| 1.0.0 | 2026-11-17 14:35:17 | 41 | 2 | [`082276ad`](https://github.com/WZR0821/Codex-Menu-Meter/commit/082276ad403e24ff363ed2caf1f0056973e2496a) |
| 1.0.0 | 2026-11-17 20:19:56 | 41 | 1 | [`16d43eaa`](https://github.com/WZR0821/Codex-Menu-Meter/commit/16d43eaa576002fe4e278728af1949383c564e09) |
| 1.0.0 | 2026-11-17 21:11:10 | 41 | 2 | [`85caa6c4`](https://github.com/WZR0821/Codex-Menu-Meter/commit/85caa6c416b9497955ca49d3c513b650bbea8612) |
| 1.0.0 | 2026-11-17 21:37:17 | 41 | 1 | [`0849b7e0`](https://github.com/WZR0821/Codex-Menu-Meter/commit/0849b7e0b64c8603b51167f11dede1ba0cfb6f73) |
| 1.0.0 | 2026-11-17 22:56:56 | 41 | 13 | [`593ce973`](https://github.com/WZR0821/Codex-Menu-Meter/commit/593ce9737d5234c66383c596eecc676c87cc0f25) |

## 核对依据

完整的快照名称、原始归档 SHA-256、还原文件 SHA-256、公开前清理记录与标签见 [历史快照清单](historical-snapshots.json)。每份快照的应用文件均已与原始备份核对，并检查作者日期、提交者日期、父提交关系和标签指向。

可直接浏览 [历史分支的提交列表](https://github.com/WZR0821/Codex-Menu-Meter/commits/codex/reconstructed-history/)；当前应用的安装与构建说明见 [项目首页](../README.md)。
