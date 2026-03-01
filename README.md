# 🎮 Splatoon Role Bot (Serverless Edition)

スプラトゥーン向け Discord ロール管理Bot。  
Vercel サーバーレス関数（Interactions Webhook）として動作し、常時稼働サーバー不要で24時間運用が可能です。メンバーがボタンを押すだけでロール（役職）を付け外しでき、スプラトゥーン3のスケジュール情報を自動＆手動で確認できます。

## 機能

### ロール管理
- **武器種ロール**: シューター、ローラー、チャージャー、スロッシャー、スピナー、マニューバー、シェルター、ブラスター、フデ、ストリンガー、ワイパー（11種）
- **モードロール**: バンカラマッチ、Xマッチ、サーモンラン（3種）
- **トグル形式**: ボタンを押すとロール付与、もう一度押すとロール解除
- **シームレストグル**: ボタン操作時にメッセージ通知を行わず、スピーディーに切り替え
- **自動ロール作成**: サーバーにロールが存在しない場合は自動作成
- **管理者限定**: パネル設置(`/setup_roles`)は管理者のみ実行可能

### スケジュール表示
- **`/schedule` コマンド**: 現在と次回のスケジュールをEmbedで表示（ナワバリ、バンカラ、Xマッチ、サーモンラン）
- **日本語表示**: 武器名・ステージ名・ルール名を日本語で表示（splatoon3.ink ロケールAPI使用）
- **自動送信 (Vercel Cron)**: 奇数時の1分（例: 1:01, 3:01...）に指定チャンネルへスケジュールを定時送信します。

## セットアップ手順

### 1. Discord Developer Portal での準備

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成
2. **Bot** タブで Bot を追加し、トークンをコピー
3. **General Information** タブから **Public Key** と **Application ID** をコピー
4. **OAuth2** → **URL Generator** で以下を選択:
   - **Scopes**: `bot`, `applications.commands`
   - **Bot Permissions**: `Manage Roles`, `Send Messages`, `Use Slash Commands`
5. 生成された URL でサーバーに Bot を招待

### 2. プロジェクトの準備とデプロイ

```bash
# リポジトリをクローン
git clone <このリポジトリのURL>
cd Discord-Bot

# 依存パッケージをインストール
npm install
```

#### Vercel へのデプロイ
本プロジェクトは Vercel にデプロイしてWebhookとして動かします。

1. [Vercel](https://vercel.com/) にログインし、GitHub等からこのリポジトリをインポートします。
2. デプロイ時の **Environment Variables (環境変数)** に以下を設定します:
   - `DISCORD_TOKEN`: Botのトークン
   - `CLIENT_ID`: アプリケーションID
   - `DISCORD_PUBLIC_KEY`: General InformationにあるPublic Key（署名検証に必須）
   - `SCHEDULE_CHANNEL_ID`: スケジュールを自動送信したいチャンネルID
   - `CRON_SECRET`: Vercel Cron実行用の任意のシークレット文字列（例: `my_secret_cron_key`）
3. デプロイを実行し、発行されたドメイン（例: `https://your-bot.vercel.app`）をメモします。

### 3. Interactions Endpoint URL の設定

1. Discord Developer Portal の **General Information** に戻ります。
2. **Interactions Endpoint URL** に以下を入力して保存します。
   `https://[あなたのVercelドメイン]/api/interactions`
3. 保存が成功すれば、DiscordからBotへの疎通確認完了です。

### 4. スラッシュコマンドの登録

自分のPC上で1回だけコマンド登録スクリプトを実行します。
（`.env` ファイルを作成し、`DISCORD_TOKEN` と `CLIENT_ID` を記載しておいてください）

```bash
npm run register_commands
```

これで Discord サーバー上で `/setup_roles` や `/schedule` が使えるようになります。

## 使い方

- **ロールパネルの設置**:
  Bot を招待したサーバーのチャンネルで管理者が `/setup_roles` を実行します。パネルが設置され、ボタンからロールを取得できます。
  **注意**: Botのロール（役職）が、付与するロールより上の位置にある必要があります。サーバー設定からBotのロール位置を上に移動してください。

- **スケジュールの手動確認**:
  任意のチャンネルで `/schedule` を実行します。

- **スケジュールの自動送信**:
  Vercel Cron により、2時間おきに自動送信が行われます。

## プロジェクト構造

```
├── api/
│   ├── interactions.js     # Discord Webhook エンドポイント (Vercel Serverless Function)
│   └── cron.js             # スケジュール自動送信エンドポイント (Vercel Cron)
├── src/
│   ├── index.js            # スラッシュコマンド登録スクリプト
│   ├── roles.js            # ロール定義データ
│   ├── panels.js           # パネル生成ロジック
│   ├── interactions.js     # ボタン処理ロジック
│   └── schedule.js         # スケジュール取得・Embed生成
├── vercel.json             # Vercel Cron の設定ファイル
├── package.json
└── README.md
```

## ライセンス
ISC
