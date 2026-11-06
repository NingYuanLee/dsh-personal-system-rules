# dsh-personal-system-rules

[![CI](https://github.com/NingYuanLee/dsh-personal-system-rules/actions/workflows/ci.yml/badge.svg)](https://github.com/NingYuanLee/dsh-personal-system-rules/actions/workflows/ci.yml) [![CI](https://img.shields.io/github/actions/workflow/status/NingYuanLee/dsh-personal-system-rules/ci.yml?label=CI)](https://github.com/NingYuanLee/dsh-personal-system-rules/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/dsh-personal-system-rules.svg)](https://www.npmjs.com/package/dsh-personal-system-rules) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE) [![Node >=22.19](https://img.shields.io/badge/node-%3E%3D22.19.0-339933.svg)](#兼容性) [![dsh](https://img.shields.io/badge/dsh-%3E%3D0.2.1--rc.2%20%3C0.3.0--0%20%7C%7C%20%3E%3D0.2.2--0%20%3C0.3.0--0-6f42c1)](#兼容性) [![topic: dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-6f42c1.svg)](https://github.com/topics/dsh-plugin) [![powered by dsh](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)

把个性化规则文件注入 DeepSeek Harness（dsh）的**系统提示**，并提供**静默提醒**、**重复操作循环检测**与**任务状态守卫**；规则正文与守卫参数都能在设置弹窗「个性化规则」里编辑。

A dsh plugin that injects a personal rules file as a system-prompt section and adds a silent (elapsed-time) reminder, a repeated-action loop guard and a stale-todo guard. The rules body and guard options are editable from the dsh settings dialog.

## 功能

1. **系统提示段**：把 `~/.dsh/PERSONAL-SYSTEM-RULES.md`（或 `config.file` 指定文件）注册成段 `user:agents-md`，order 默认 10150，原样注入；`watchFile` 1 秒轮询，改完下一次模型请求生效，不用重启。
2. **静默提醒**：距离上一次**可见文字**超过 `maxSilentSeconds`（默认 60 秒）时，注入一条提醒要求模型说明进展；同一段沉默每再满一个阈值提醒一次，`0` 关闭。判定用时长而不是步数：单个长耗时步骤不会再掩盖十分钟的沉默，两步之间的十几秒也不会提前打断。
3. **循环检测**：连续 `repeatLimit` 步执行**完全相同**的工具调用（工具名 + 归一化参数）时触发，`repeatAction` 可选 `remind`（提醒）或 `stop`（像用户点停止一样中止本轮并保留排队输入）；默认 0 关闭。
4. **任务状态守卫**：本轮的 todo 列表里还有 `in_progress` 项、且连续 `maxStaleTodoSteps`（默认 6）步没有重写列表时提醒一次，之后再每隔同样步数提醒；本轮没建列表（短任务）时不打扰，全部完成时也不触发。`0` 关闭。
5. **设置弹窗页面**：`设置 → 个性化规则` 与插件详情页是同一个页面，含「规则正文」和「守卫」两块；保存经官方 `settings` 机制写回 profile patch 并热更新。

三个守卫共用同一个 `agent/pre-step` 钩子；检测逻辑是纯函数，独立测试。

## 安装

**从 npm（推荐）：**

```powershell
dsh --profile my-profile --from-default-profile web --dump-config
dsh plugin --profile my-profile add dsh-personal-system-rules
```

**从 git（固定 tag）：**

```powershell
dsh plugin --profile my-profile add "git+https://github.com/NingYuanLee/dsh-personal-system-rules.git#v0.7.0"
```

**从 GitHub Release tarball：**

```powershell
dsh plugin --profile my-profile add "https://github.com/NingYuanLee/dsh-personal-system-rules/releases/download/v0.7.0/dsh-personal-system-rules-0.7.0.tgz"
```

包没有 `prepare` / `postinstall` 脚本，安装不执行构建代码。

## 配置

```yaml
- id: system-agents-md
  name: dsh-personal-system-rules
  config:
    # file 缺省为 $DSH_HOME/PERSONAL-SYSTEM-RULES.md
    header: |
      # 用户全局系统层规则
      以下内容来自用户全局 PERSONAL-SYSTEM-RULES.md，是系统层指令，必须遵守。
    maxSilentSeconds: 60
    silentReminder: ''
    repeatLimit: 0
    repeatAction: remind
    repeatReminder: ''
    maxStaleTodoSteps: 6
    staleTodoReminder: ''
```

- `maxSilentSeconds`、`silentReminder`、`repeatLimit`、`repeatAction`、`repeatReminder`、`maxStaleTodoSteps`、`staleTodoReminder` 是 `volatile()` 字段，可在设置弹窗编辑并热更新。
- 0.7.0 起静默提醒按秒判定，旧的 `maxSilentSteps` 键不再生效（仍可留在 patch 里，会被忽略）；把阈值换成期望的秒数即可。
- `file`、`header`、`order` 是普通配置，只在 `cordis.patch.yml` 里改；改 `file` 后需要重载插件。
- `repeatLimit: 0` 关闭循环检测；文本回复或新用户轮次会重置重复计数。
- `maxStaleTodoSteps: 0` 关闭任务状态守卫；提醒文案可含 `{count}`（未更新的步数）与 `{inProgress}`（进行中的项数）。
- 设置弹窗保存会写回 profile 的 `cordis.patch.yml`。

## 兼容性

- Node.js `>=22.19.0`。
- dsh `>=0.2.1-rc.2 <0.3.0-0 || >=0.2.2-0 <0.3.0-0`。
- 已在 dsh `0.2.2-rc.1` 上验证加载与全部测试。
- 极简预设不生效（该预设把系统提示截成一句）；插件停用或加载失败时不注入任何内容。

## 开发

```powershell
git clone https://github.com/NingYuanLee/dsh-personal-system-rules.git
cd dsh-personal-system-rules
npm install --ignore-scripts
npm test
npm run check
npm run build   # 重新生成 client.js，需提交
```

`client.js` 是构建产物（web 模块加载器信封），修改 `client-src.js` 后必须重新构建并提交。

## 说明与限制

- 循环检测只识别「工具名 + 参数完全相同」的连续工具调用；参数变化、文本步骤、新用户轮次都会重置。
- `stop` 走 `agent.cancel({ kind: 'user' }, { keepInbox: true })`，与用户停止同一条取消路径，不是强制杀进程。
- 安装任何 dsh 插件都会以用户权限运行第三方代码；请先阅读源码。

## License

[MIT](LICENSE) © 2026 NingYuanLee
