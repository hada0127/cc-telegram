# cc-telegram

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

---

Telegramボットを介したリモートClaude Code実行

Telegramアプリを使用して、どこからでもClaude Codeを制御できます。タスクを作成し、進捗を監視し、完了通知を受け取る - すべてスマートフォンから可能です。

## 機能

- **リモートタスク実行**：TelegramからClaude Codeにコーディングタスクを送信
- **並列実行**：複数のタスクを同時に実行（設定可能）
- **優先度システム**：緊急、高、通常、低の優先度レベル
- **自動リトライ**：失敗時に自動リトライ（試行回数設定可能）
- **リアルタイムステータス**：タスクの進捗とClaudeの出力を監視
- **ログローテーション**：古いログと完了したタスクを自動クリーンアップ

## 要件

- Node.js 18.0.0以上
- [Claude Code CLI](https://claude.ai/claude-code)のインストールと認証完了
- Telegramアカウント

## インストール

```bash
npx cc-telegram
```

またはグローバルインストール：

```bash
npm install -g cc-telegram
cc-telegram
```

## 初期設定

初回実行時、cc-telegramがセットアッププロセスを案内します：

1. **Telegramボットを作成**
   - Telegramで[@BotFather](https://t.me/BotFather)を検索
   - `/newbot`を送信し、プロンプトに従う
   - 提供されたボットトークンをコピー

2. **ボットトークンを入力**
   - プロンプトでボットトークンを貼り付け
   - ツールがトークンの有効性を確認

3. **アカウントをリンク**
   - Telegramで新しいボットを開く
   - ボットに`/start`を送信
   - CLIがメッセージを検出し、chat IDを表示
   - chat IDを入力して確認

4. **設定を構成**
   - デフォルトリトライ回数を設定（推奨：15）
   - 並列実行を有効化/無効化
   - 最大同時タスク数を設定（並列有効時）

設定は`.cc-telegram/config.json`にローカルで暗号化保存されます。

## 使用方法

セットアップ後、以下を実行するだけです：

```bash
npx cc-telegram
```

ボットが起動し、Telegramアカウントからのコマンドを待機します。

## Telegramコマンド

| コマンド | 説明 |
|----------|------|
| `/new` | 新しいタスクを作成 |
| `/list` | 保留中および進行中のタスクを表示 |
| `/completed` | 完了したタスクを表示 |
| `/failed` | 失敗したタスクを表示 |
| `/status` | 現在の実行状態を確認 |
| `/debug` | システム情報を表示 |
| `/cancel` | タスク作成フローをキャンセル |
| `/reset` | すべてのデータをリセット（確認必要） |

## タスクの作成

### シンプルタスク
完了条件なしの1回実行：

1. `/new`を送信
2. 「シンプル（完了条件なし、リトライなし）」を選択
3. 要件を入力
4. タスクは即座にキューに追加

### 複雑なタスク
完了条件と自動リトライ付きのタスク：

1. `/new`を送信
2. 「複雑（完了条件とリトライあり）」を選択
3. 要件を入力
4. 完了条件を入力（例：「すべてのテストが通過」）
5. 優先度レベルを選択
6. リトライ回数を選択（10回またはカスタム）

## タスク優先度

タスクは優先度順に実行されます：

| 優先度 | アイコン | 説明 |
|--------|----------|------|
| 緊急 | 🔴 | 最初に実行 |
| 高 | 🟠 | 高優先度 |
| 通常 | 🟢 | デフォルト優先度 |
| 低 | 🔵 | アイドル時に実行 |

## 並列実行

セットアップ中に有効にすると、複数のタスクを同時に実行できます：

- 最大同時タスク数を設定（1-10）
- 各タスクはコンソール出力でIDプレフィックスを表示
- `/status`で実行中のすべてのタスクを表示
- 高優先度タスクは引き続き優先的にスロットを取得

### コンソール出力（並列モード）

```
[a1b2c3d4] タスク開始...
[e5f6g7h8] プロジェクトをコンパイル中...
[a1b2c3d4] テスト合格！
```

## 設定

設定は`.cc-telegram/config.json`に保存されます：

| 設定 | 説明 | デフォルト |
|------|------|------------|
| `botToken` | Telegramボットトークン（暗号化） | - |
| `chatId` | Telegram chat ID（暗号化） | - |
| `debugMode` | デバッグログを有効化 | `false` |
| `claudeCommand` | カスタムClaude CLIコマンド | `null`（自動検出） |
| `logRetentionDays` | ログファイル保持日数 | `7` |
| `defaultMaxRetries` | デフォルトリトライ回数 | `15` |
| `parallelExecution` | 並列実行を有効化 | `false` |
| `maxParallel` | 最大同時タスク数 | `3` |

### カスタムClaudeコマンド

Claude CLIが非標準の場所にインストールされている場合：

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## ディレクトリ構造

```
.cc-telegram/
├── config.json      # 暗号化された設定
├── tasks.json       # 保留タスクインデックス
├── completed.json   # 完了タスクインデックス
├── failed.json      # 失敗タスクインデックス
├── tasks/           # 個別タスクファイル
├── completed/       # 完了タスクの詳細
├── failed/          # 失敗タスクの詳細
└── logs/            # 日別ログファイル
```

## 完了検出

Claude Codeは特別なマーカーを使用してタスク完了を通知します：

- `<promise>COMPLETE</promise>` - タスクが正常に完了
- `<promise>FAILED</promise>` - タスクが失敗（理由付き）

シグナルが検出されない場合、システムは出力内容に基づいてパターンマッチングで成功/失敗を判断します。

## ログ管理

- ログファイルは毎日作成：`YYYY-MM-DD.log`
- `logRetentionDays`後に古いログを自動削除
- 完了/失敗タスクファイルは30日後にクリーンアップ

## セキュリティ

- ボットトークンとchat IDはAES-256-GCMで暗号化
- 登録されたchat IDからのメッセージのみ処理
- すべてのデータはプロジェクトディレクトリにローカル保存

## トラブルシューティング

### ボットが応答しない
- ボットが実行中か確認（`npx cc-telegram`）
- chat IDが設定と一致するか確認
- インターネット接続を確認

### Claude Codeが見つからない
- Claude CLIのインストールを確認：`npm install -g @anthropic-ai/claude-code`
- または設定でカスタムコマンドを設定：`"claudeCommand": "npx @anthropic-ai/claude-code"`

### タスクが進行中のまま止まっている
- 再起動時、孤立したタスクは自動的に「ready」状態にリセット
- 必要に応じて`/reset`ですべてのデータをクリア

## ライセンス

MIT
