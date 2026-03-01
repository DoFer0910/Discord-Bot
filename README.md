# 🎮 Splatoon Role Bot

スプラトゥーン向け Discord ロール管理Bot。  
メンバーがボタンを押すだけでロール（役職）を付け外しできます。

## 機能

- **武器種ロール**: シューター、ローラー、チャージャー、スロッシャー、スピナー、マニューバー、シェルター、ブラスター、フデ、ストリンガー、ワイパー（11種）
- **モードロール**: バンカラマッチ、Xマッチ、サーモンラン（3種）
- **トグル形式**: ボタンを押すとロール付与、もう一度押すとロール解除
- **通知の整理**: パネル操作時の通知メッセージ（ロール付与・解除通知）は最新5件のみ表示され、古いものは自動的に削除されます
- **自動再読み込み（ホットリロード）**: ソースコードを変更して保存すると、自動的にBotが再起動して最新のコードが反映されます
- **自動ロール作成**: サーバーにロールが存在しない場合は自動作成
- **管理者限定**: パネル設置は管理者のみ実行可能

## セットアップ

### 1. Discord Developer Portal での準備

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリケーションを作成
2. **Bot** タブで Bot を追加し、トークンをコピー
3. **Bot** タブで以下の Privileged Gateway Intents を有効化:
   - `SERVER MEMBERS INTENT`
4. **OAuth2** → **URL Generator** で以下を選択:
   - **Scopes**: `bot`, `applications.commands`
   - **Bot Permissions**: `Manage Roles`, `Send Messages`, `Use Slash Commands`
5. 生成された URL でサーバーに Bot を招待

### 2. Bot のインストール

```bash
# リポジトリをクローン
git clone <このリポジトリのURL>
cd chrono-shuttle

# 依存パッケージをインストール
npm install

# .env ファイルを作成
cp .env.example .env
```

### 3. 環境変数の設定

`.env` ファイルを編集して、以下の値を設定:

```env
DISCORD_TOKEN=ここにBotトークンを貼り付け
CLIENT_ID=ここにアプリケーションIDを貼り付け
```

### 4. Bot の起動

```bash
npm start
```

## 使い方

1. Bot が起動したら、ロールパネルを設置したいチャンネルで `/setup_roles` コマンドを実行
2. 武器種とモードの2つのパネルが表示されます
3. メンバーはボタンを押してロールを取得／解除できます

> **注意**: Botのロールが、付与するロールより上の位置にある必要があります。  
> サーバー設定 → ロールで、Bot のロールを上に移動してください。

## プロジェクト構造

```
├── src/
│   ├── index.js          # メインエントリーポイント
│   ├── roles.js          # ロール定義データ
│   ├── panels.js         # パネル生成
│   └── interactions.js   # ボタン処理
├── .env.example          # 環境変数テンプレート
├── .gitignore
├── package.json
└── README.md
```

## ライセンス

ISC
