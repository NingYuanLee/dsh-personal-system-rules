# 更新日志

## 0.6.0 — 2026-11-04

- 新增任务状态守卫：本轮的 todo 列表里还有 `in_progress` 项、且连续 `maxStaleTodoSteps` 步没有重写列表时，经 `agent/pre-step` 注入一条提醒；之后每再累积同样步数提醒一次。默认 6 步，`0` 关闭。
- 本轮没有 todo 列表（短任务可以主动跳过）或列表已全部 `completed` 时都不触发，避免把有意不写列表的任务也当成「没更新」。
- 设置页「守卫」卡片新增「任务状态」分组，阈值与文案都可在弹窗编辑，文案支持 `{count}`（未更新步数）与 `{inProgress}`（进行中项数）。
- 检测逻辑新增纯函数 `staleTodoSteps()`，`test/loop-guard.test.js` 与 `test/guards.test.js` 各有覆盖。

## 0.5.1 — 2026-11-04

- 声明并验证对 DeepSeek Harness 0.2.2 预发布版的支持：`settings.section` 与 `plugins.bundle.config` 的注册契约、`describe/mutate` 设置读写、locale 的 `register(ns, {zh, en})` 形式、`loader/volatile-update` 热更新路径在 0.2.2 均未变。`engines.dsh` 已覆盖该版本。
- 不使用 Session Projection、spill 策略或 `dsh-fs-observation-policy`，因此 0.2.2 对这几项的改动不命中本插件。无代码改动，已用 DSH 0.2.2-rc.1 内核验证加载与全部测试。

## 0.5.0 — 2026-10-31

- 新增循环检测守卫：连续执行完全相同的工具调用达到 `repeatLimit` 时，按 `repeatAction` 提醒或中止本轮。
- 静默提醒与循环检测合并到同一个 `agent/pre-step` 钩子和同一个「守卫」设置卡片，一次保存全部守卫参数。
- 检测逻辑独立为 `loop-guard.js`，新增 `test/loop-guard.test.js` 与 `test/guards.test.js`。

## 0.4.6 — 2026-10-31

- 静默提醒的提醒文案改为紧凑的自动增高多行输入框，长文案和占位符完整可见。

## 0.4.5 — 2026-10-31

- 提醒文案改为单行输入，去掉「默认文案：」前缀；规则正文编辑框恢复 280px 高度。

## 0.4.4 — 2026-10-31

- 默认规则文件改名为 `PERSONAL-SYSTEM-RULES.md`，与包名对应；默认 `file`、header、路径提示与文档同步。

## 0.4.3 — 2026-10-31

- 去掉设置页的文件路径输入，路径固定为 `$DSH_HOME/PERSONAL-SYSTEM-RULES.md`；`Config.file` 改为普通配置。
- 页面简化为「规则正文 + 守卫」两块。

## 0.4.2 — 2026-10-31

- 插件详情页与设置弹窗统一为同一个完整页面。

## 0.4.1 — 2026-10-31

- 分层语义调整：`AGENTS.md` 保持 dsh 出厂 user 基线，`PERSONAL-SYSTEM-RULES.md` 由本插件注入系统层。

## 0.4.0 — 2026-10-31

- 显示名改为「个性化规则」；新增设置弹窗分区，规则正文、文件路径、守卫参数可编辑并热更新。

## 0.3.x — 2026-10

- 0.3.0 首个带插件详情页编辑区的版本；0.3.3/0.3.4 完成分层与包名迁移。
