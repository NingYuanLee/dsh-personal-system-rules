# 更新日志

## 0.7.1 — 2026-11-06

- 补齐 GitHub 发布：`v0.6.0`、`v0.7.0` 两个 tag、对应 Release 与 tgz 安装包此前都缺失，只补了 `v0.5.0`；本次补推两个 tag，并更新 README 的安装示例指向 `v0.7.0`（原先写的 `v0.6.0` 链接当时是死链）。
- `0.6.1` 从未作为独立版本发布到 npm，其修复随 `0.7.0` 一同发布，CHANGELOG 标题补注说明，避免版本序列误导。
- 无代码变更：功能与 `0.7.0` 相同。

## 0.7.0 — 2026-11-05

- 静默守卫从「步数」改为「时长」：新增 `maxSilentSeconds`（默认 60 秒，`0` 关闭），按最后一条可见文字消息到当前时刻的间隔判定，同一段沉默每再满一个阈值提醒一次。提醒文案的 `{count}` 现在是秒数。
- 原因（会话 `session-2debd25a` 实测 258 个 step、43 次提醒）：43 次里有 41 次发生在距上次说明不足 60 秒（中位 18 秒、最小 7 秒），而 18 个「已沉默 ≥60 秒」的 step 中有 16 个完全没提醒，最长沉默 629 秒。步数口径既太快打断，也看不见单步长耗时造成的长时间沉默。
- 新增纯函数 `silentMs(agent, now)`（读 surface 事件自带的时间戳，无可见文字时回落到本轮起点），`test/loop-guard.test.js` 覆盖测量与回落，`test/guards.test.js` 覆盖阈值、重置与分段提醒。
- 设置页字段改为「多久没有可见输出就提醒（秒）」，中英文案、README、locale 描述同步。
- 旧的 `maxSilentSteps` 键保留在 profile 里也无害（schemastery 不报未知键），但不再生效；迁移时换成期望的秒数。

## 0.6.1 — 2026-11-05（未单独发布，修复随 0.7.0 一同发布到 npm）

- 修复任务状态守卫从不触发的问题：`staleTodoSteps()` 原先在 `session.surface.nodes` 里查找 `todo/write` 事件，但 surface 只承载消息类事件（`system`/`developer`/`user`/`assistant` 消息与 `tool/result`），`todo/write` 是仅落日志的事件，永远不会出现在 surface 上，于是每步都被判成「本轮没写列表」，守卫一直静默。
- 改为读取 assistant 消息里模型自己的 `todo_write` 工具调用（`arguments.todos`）作为列表来源，步数从最近一次该调用算起；日志里的 `todo/write` 事件不再参与判断。
- 回放会话 `session-2debd25a` 的真实 surface：修复前注入 0 次，修复后在第 6/12/18/24/30/36 步各注入一次。
- `test/loop-guard.test.js`、`test/guards.test.js` 的用例改为真实形状（`todo_write` 工具调用），并新增「仅落日志的 `todo/write` 事件不构成列表」「以最近一次调用为准」「非法 arguments 不误判」三个回归用例。

## 0.6.0 — 2026-11-04

- 新增任务状态守卫：本轮的 todo 列表里还有 `in_progress` 项、且连续 `maxStaleTodoSteps` 步没有重写列表时，经 `agent/pre-step` 注入一条提醒；之后每再累积同样步数提醒一次。默认 6 步，`0` 关闭。
- 本轮没有 todo 列表（短任务可以主动跳过）或列表已全部 `completed` 时都不触发，避免把有意不写列表的任务也当成「没更新」。
- 设置页「守卫」卡片新增「任务状态」分组，阈值与文案都可在弹窗编辑，文案支持 `{count}`（未更新步数）与 `{inProgress}`（进行中项数）。
- 检测逻辑新增纯函数 `staleTodoSteps()`，`test/loop-guard.test.js` 与 `test/guards.test.js` 各有覆盖。
- 声明并验证对 DeepSeek Harness 0.2.2 预发布版的支持：`settings.section` 与 `plugins.bundle.config` 的注册契约、`describe/mutate` 设置读写、locale 的 `register(ns, {zh, en})` 形式、`loader/volatile-update` 热更新路径在 0.2.2 均未变。`engines.dsh` 已覆盖该版本。
- 不使用 Session Projection、spill 策略或 `dsh-fs-observation-policy`，因此 0.2.2 对这几项的改动不命中本插件。已用 DSH 0.2.2-rc.1 内核验证加载与全部测试。

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
