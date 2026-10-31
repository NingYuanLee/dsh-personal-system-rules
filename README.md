# dsh-personal-system-rules

[![CI](https://github.com/NingYuanLee/dsh-personal-system-rules/actions/workflows/ci.yml/badge.svg)](https://github.com/NingYuanLee/dsh-personal-system-rules/actions/workflows/ci.yml) [![npm](https://img.shields.io/npm/v/dsh-personal-system-rules.svg)](https://www.npmjs.com/package/dsh-personal-system-rules) [![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

把个性化规则文件注入 DeepSeek Harness（dsh）的**系统提示**，并提供**静默提醒**与**重复操作循环检测**；规则正文与守卫参数都能在设置弹窗「个性化规则」里编辑。

A dsh plugin that injects a personal rules file as a system-prompt section and adds silent-step / repeated-action loop guards. The rules body and guard options are editable from the dsh settings dialog.

## 功能

1. **系统提示段**：把 `~/.dsh/PERSONAL-SYSTEM-RULES.md`（或 `config.file` 指定文件）注册成段 `user:agents-md`，order 默认 10150，原样注入；`watchFile` 1 秒轮询，改完下一次模型请求生效，不用重启。
2. **静默提醒**：连续 `maxSilentSteps`（默认 2）步没有可见文本时，注入一条提醒要求模型说明进展；同一条链只提醒一次，`0` 关闭。
3. **循环检测**：连续 `repeatLimit` 步执行**完全相同**的工具调用（工具名 + 归一化参数）时触发，`repeatAction` 可选 `remind`（提醒）或 `stop`（像用户点停止一样中止本轮并保留排队输入）；默认 0 关闭。
4. **设置弹窗页面**：`设置 → 个性化规则` 与插件详情页是同一个页面，含「规则正文」和「守卫」两块；保存经官方 `settings` 机制写回 profile patch 并热更新。

静默提醒与循环检测共用同一个 `agent/pre-step` 钩子；检测逻辑是纯函数，独立测试。

## 安装

**从 npm（推荐）：**

```powershell
dsh --profile my-profile --from-default-profile web --dump-config
dsh plugin --profile my-profile add dsh-personal-system-rules
```

**从 git（固定 tag）：**

```powershell
dsh plugin --profile my-profile add "git+https://github.com/NingYuanLee/dsh-personal-system-rules.git#v0.5.0"
```

**从 GitHub Release tarball：**

```powershell
dsh plugin --profile my-profile add "https://github.com/NingYuanLee/dsh-personal-system-rules/releases/download/v0.5.0/dsh-personal-system-rules-0.5.0.tgz"
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
    maxSilentSteps: 2
    silentReminder: ''
    repeatLimit: 0
    repeatAction: remind
    repeatReminder: ''
```

- `maxSilentSteps`、`silentReminder`、`repeatLimit`、`repeatAction`、`repeatReminder` 是 `volatile()` 字段，可在设置弹窗编辑并热更新。
- `file`、`header`、`order` 是普通配置，只在 `cordis.patch.yml` 里改；改 `file` 后需要重载插件。
- `repeatLimit: 0` 关闭循环检测；文本回复或新用户轮次会重置重复计数。
- 设置弹窗保存会写回 profile 的 `cordis.patch.yml`。

## 兼容性

- Node.js `>=22.19.0`。
- dsh `>=0.2.1-rc.2 <0.3.0-0`。
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
