# cc-telegram

[![npm version](https://badge.fury.io/js/cc-telegram.svg)](https://www.npmjs.com/package/cc-telegram)
[![GitHub](https://img.shields.io/github/license/hada0127/cc-telegram)](https://github.com/hada0127/cc-telegram)

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

**GitHub**: [https://github.com/hada0127/cc-telegram](https://github.com/hada0127/cc-telegram)

**[Version History](VERSION_HISTORY.md)**

---

通过 Telegram 机器人远程执行 Claude Code

使用 Telegram 应用从任何地方控制 Claude Code。创建任务、监控进度并接收完成通知 - 一切都可以在手机上完成。

## 功能

- **远程任务执行**：通过 Telegram 向 Claude Code 发送编码任务
- **并行执行**：同时运行多个任务（可配置）
- **优先级系统**：紧急、高、普通、低优先级级别
- **自动重试**：失败时自动重试，可配置尝试次数
- **实时状态**：监控任务进度和 Claude 的输出
- **日志轮换**：自动清理旧日志和已完成的任务

## 要求

- Node.js 18.0.0 或更高版本
- [Claude Code CLI](https://claude.ai/claude-code) 已安装并认证
- Telegram 账户

## 安装

```bash
npx cc-telegram
```

或全局安装：

```bash
npm install -g cc-telegram
cc-telegram
```

## 初始设置

首次运行时，cc-telegram 将引导您完成设置过程：

1. **创建 Telegram 机器人**
   - 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
   - 发送 `/newbot` 并按照提示操作
   - 复制提供的机器人令牌

2. **输入机器人令牌**
   - 在提示时粘贴您的机器人令牌
   - 工具将验证令牌是否有效

3. **链接您的账户**
   - 在 Telegram 中打开您的新机器人
   - 向机器人发送 `/start`
   - CLI 将检测您的消息并显示您的 chat ID
   - 输入 chat ID 进行确认

4. **配置设置**
   - 设置默认重试次数（推荐：15）
   - 启用/禁用并行执行
   - 设置最大并发任务数（如果启用并行）

您的配置存储在本地的 `.cc-telegram/config.json`（已加密）。

## 使用方法

设置完成后，只需运行：

```bash
npx cc-telegram
```

机器人将启动并监听来自您 Telegram 账户的命令。

## Telegram 命令

| 命令 | 描述 |
|------|------|
| `/new` | 创建新任务 |
| `/list` | 查看待处理和进行中的任务 |
| `/completed` | 查看已完成的任务 |
| `/failed` | 查看失败的任务 |
| `/status` | 检查当前执行状态并取消正在运行的任务 |
| `/debug` | 查看系统信息 |
| `/cancel` | 取消任务创建流程 |
| `/reset` | 重置所有数据（需确认） |

## 创建任务

### 简单任务
一次性执行，无完成条件：

1. 发送 `/new`
2. 选择"简单（无完成条件，不重试）"
3. 输入您的需求
4. 任务立即加入队列

### 复杂任务
带有完成条件和自动重试的任务：

1. 发送 `/new`
2. 选择"复杂（有完成条件和重试）"
3. 输入您的需求
4. 输入完成条件（例如："所有测试通过"）
5. 选择优先级级别
6. 选择重试次数（10次或自定义）

**Plan 模式**：复杂任务会自动以 plan 模式（`--permission-mode plan` 选项）运行 Claude。这使 Claude 能够在执行前设计实现方案，从而为复杂需求获得更好的结果。

### 文件附件

创建任务时，您可以在需求或完成条件中附加文件：

1. 在输入需求/完成条件时，先发送文件（图片、文档等）
2. 每个附件都会显示确认消息
3. 然后以文字输入需求/完成条件
4. 附加的文件将与任务一起传递给Claude

**注意**: 附件在任务完成/失败/取消时会自动删除。

## 任务优先级

任务按优先级顺序执行：

| 优先级 | 图标 | 描述 |
|--------|------|------|
| 紧急 | 🔴 | 最先执行 |
| 高 | 🟠 | 高优先级 |
| 普通 | 🟢 | 默认优先级 |
| 低 | 🔵 | 空闲时执行 |

## 并行执行

在设置期间启用后，可以同时运行多个任务：

- 配置最大并发任务数（1-10）
- 每个任务在控制台输出中显示其 ID 前缀
- `/status` 显示所有正在运行的任务（可通过停止按钮取消）
- 高优先级任务仍然优先获得槽位

### 取消正在运行的任务

您可以取消当前正在运行的任务：

1. 发送 `/status` 查看正在运行的任务
2. 每个运行中的任务会显示"停止"按钮
3. 点击按钮立即终止任务
4. 被取消的任务将被标记为失败

### 控制台输出（并行模式）

```
[a1b2c3d4] 开始任务...
[e5f6g7h8] 编译项目...
[a1b2c3d4] 测试通过！
```

## 配置

配置存储在 `.cc-telegram/config.json`：

| 设置 | 描述 | 默认值 |
|------|------|--------|
| `botToken` | Telegram 机器人令牌（已加密） | - |
| `chatId` | 您的 Telegram chat ID（已加密） | - |
| `debugMode` | 启用调试日志 | `false` |
| `claudeCommand` | 自定义 Claude CLI 命令 | `null`（自动检测） |
| `logRetentionDays` | 日志文件保留天数 | `7` |
| `defaultMaxRetries` | 默认重试次数 | `15` |
| `parallelExecution` | 启用并行执行 | `false` |
| `maxParallel` | 最大并发任务数 | `3` |

### 自定义 Claude 命令

如果 Claude CLI 安装在非标准位置：

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## 目录结构

```
.cc-telegram/
├── config.json      # 加密的配置
├── tasks.json       # 待处理任务索引
├── completed.json   # 已完成任务索引
├── failed.json      # 失败任务索引
├── tasks/           # 单个任务文件
├── completed/       # 已完成任务详情
├── failed/          # 失败任务详情
└── logs/            # 每日日志文件
```

## 完成检测

Claude Code 使用特殊标记发出任务完成信号：

- `<promise>COMPLETE</promise>` - 任务成功完成
- `<promise>FAILED</promise>` - 任务失败（附原因）

如果未检测到信号，系统将根据输出内容使用模式匹配来确定成功或失败。

## 日志管理

- 日志文件每天创建：`YYYY-MM-DD.log`
- `logRetentionDays` 后自动删除旧日志
- 已完成/失败的任务文件在30天后清理

## 安全性

- 机器人令牌和 chat ID 使用 AES-256-GCM 加密
- 只处理来自您注册的 chat ID 的消息
- 所有数据都存储在您的项目目录本地

## 故障排除

### 机器人无响应
- 确保机器人正在运行（`npx cc-telegram`）
- 检查您的 chat ID 是否与配置的匹配
- 验证互联网连接

### 找不到 Claude Code
- 确保已安装 Claude CLI：`npm install -g @anthropic-ai/claude-code`
- 或在配置中设置自定义命令：`"claudeCommand": "npx @anthropic-ai/claude-code"`

### 任务卡在进行中
- 重启时，孤立任务会自动重置为"ready"状态
- 如果需要，使用 `/reset` 清除所有数据

## 许可证

MIT
