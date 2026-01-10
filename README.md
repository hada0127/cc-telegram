# cc-telegram

[![npm version](https://badge.fury.io/js/cc-telegram.svg)](https://www.npmjs.com/package/cc-telegram)
[![GitHub](https://img.shields.io/github/license/hada0127/cc-telegram)](https://github.com/hada0127/cc-telegram)

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

**GitHub**: [https://github.com/hada0127/cc-telegram](https://github.com/hada0127/cc-telegram)

---

Remote Claude Code execution via Telegram bot.

Control Claude Code from anywhere using your Telegram app. Create tasks, monitor progress, and receive completion notifications - all from your phone.

## Features

- **Remote Task Execution**: Send coding tasks to Claude Code via Telegram
- **Parallel Execution**: Run multiple tasks simultaneously (configurable)
- **Priority System**: Urgent, High, Normal, Low priority levels
- **Auto-Retry**: Automatic retry on failure with configurable attempts
- **Real-time Status**: Monitor task progress and Claude's output
- **Log Rotation**: Automatic cleanup of old logs and completed tasks

## Requirements

- Node.js 18.0.0 or higher
- [Claude Code CLI](https://claude.ai/claude-code) installed and authenticated
- Telegram account

## Installation

```bash
npx cc-telegram
```

Or install globally:

```bash
npm install -g cc-telegram
cc-telegram
```

## Initial Setup

On first run, cc-telegram will guide you through the setup process:

1. **Create a Telegram Bot**
   - Open Telegram and search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the prompts
   - Copy the bot token provided

2. **Enter Bot Token**
   - Paste your bot token when prompted
   - The tool will verify the token is valid

3. **Link Your Account**
   - Open your new bot in Telegram
   - Send `/start` to the bot
   - The CLI will detect your message and display your chat ID
   - Enter the chat ID to confirm

4. **Configure Settings**
   - Set default retry count (recommended: 15)
   - Enable/disable parallel execution
   - Set max concurrent tasks (if parallel enabled)

Your configuration is stored locally in `.cc-telegram/config.json` (encrypted).

## Usage

After setup, simply run:

```bash
npx cc-telegram
```

The bot will start and listen for commands from your Telegram account.

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/new` | Create a new task |
| `/list` | View pending and in-progress tasks |
| `/completed` | View completed tasks |
| `/failed` | View failed tasks |
| `/status` | Check current execution status and cancel running tasks |
| `/debug` | View system information |
| `/cancel` | Cancel task creation flow |
| `/reset` | Reset all data (with confirmation) |

## Creating Tasks

### Simple Tasks
For one-time execution without completion criteria:

1. Send `/new`
2. Select "Simple (no completion criteria, no retry)"
3. Enter your requirement
4. Task is queued immediately

### Complex Tasks
For tasks with completion criteria and auto-retry:

1. Send `/new`
2. Select "Complex (with completion criteria and retry)"
3. Enter your requirement
4. Enter completion criteria (e.g., "All tests pass")
5. Select priority level
6. Choose retry count (10 or custom)

## Task Priority

Tasks are executed in priority order:

| Priority | Icon | Description |
|----------|------|-------------|
| Urgent | :red_circle: | Execute first |
| High | :orange_circle: | High priority |
| Normal | :green_circle: | Default priority |
| Low | :blue_circle: | Execute when idle |

## Parallel Execution

When enabled during setup, multiple tasks can run simultaneously:

- Configure max concurrent tasks (1-10)
- Each task shows its ID prefix in console output
- `/status` shows all running tasks with stop buttons to cancel them
- Higher priority tasks still get slots first

### Canceling Running Tasks

You can cancel tasks that are currently running:

1. Send `/status` to view running tasks
2. Each running task displays a "Stop" button
3. Click the button to immediately terminate the task
4. The canceled task will be marked as failed

### Console Output (Parallel Mode)

```
[a1b2c3d4] Starting task...
[e5f6g7h8] Compiling project...
[a1b2c3d4] Tests passed!
```

## Configuration

Configuration is stored in `.cc-telegram/config.json`:

| Setting | Description | Default |
|---------|-------------|---------|
| `botToken` | Telegram bot token (encrypted) | - |
| `chatId` | Your Telegram chat ID (encrypted) | - |
| `debugMode` | Enable debug logging | `false` |
| `claudeCommand` | Custom Claude CLI command | `null` (auto-detect) |
| `logRetentionDays` | Days to keep log files | `7` |
| `defaultMaxRetries` | Default retry count | `15` |
| `parallelExecution` | Enable parallel execution | `false` |
| `maxParallel` | Max concurrent tasks | `3` |

### Custom Claude Command

If Claude CLI is installed in a non-standard location:

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## Directory Structure

```
.cc-telegram/
├── config.json      # Encrypted configuration
├── tasks.json       # Pending task index
├── completed.json   # Completed task index
├── failed.json      # Failed task index
├── tasks/           # Individual task files
├── completed/       # Completed task details
├── failed/          # Failed task details
└── logs/            # Daily log files
```

## Completion Detection

Claude Code signals task completion using special markers:

- `<promise>COMPLETE</promise>` - Task completed successfully
- `<promise>FAILED</promise>` - Task failed with reason

If no signal is detected, the system uses pattern matching to determine success or failure based on output content.

## Log Management

- Log files are created daily: `YYYY-MM-DD.log`
- Old logs are automatically deleted after `logRetentionDays`
- Completed/failed task files are cleaned up after 30 days

## Security

- Bot token and chat ID are encrypted using AES-256-GCM
- Only messages from your registered chat ID are processed
- All data is stored locally in your project directory

## Troubleshooting

### Bot not responding
- Ensure the bot is running (`npx cc-telegram`)
- Check if your chat ID matches the configured one
- Verify internet connection

### Claude Code not found
- Ensure Claude CLI is installed: `npm install -g @anthropic-ai/claude-code`
- Or set a custom command in config: `"claudeCommand": "npx @anthropic-ai/claude-code"`

### Tasks stuck in progress
- On restart, orphan tasks are automatically reset to "ready" status
- Use `/reset` to clear all data if needed

## License

MIT
