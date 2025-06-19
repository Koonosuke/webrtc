# WebRTCビデオ通話アプリ（FastAPI × Next.js）

**FastAPI（Python）** をバックエンド、**Next.js（React）** をフロントエンドに用いて、WebRTCを使った1対1のビデオ通話を実現するアプリケーション

## 起動方法

バックエンド
仮想環境有効化

.\venv\Scripts\activate

起動

uvicorn main:app --host 127.0.0.1 --port 8000 --reload

フロントエンド

npm run dev


## 現在の実装状況

### フロントエンド（Next.js）

- カメラ・マイクの取得（`getUserMedia()`）
- ローカル映像の表示
- RTCPeerConnectionの作成・STUNサーバ設定済み
- 音声・映像のトラック送信
- 相手の映像受信（`ontrack`）
- WebSocketでシグナリング（`ws://localhost:8000/ws`）

### バックエンド（FastAPI）

- WebSocketエンドポイント `/ws` を提供
- 複数クライアント間でメッセージ中継（全ブロードキャスト）
- 接続・切断管理

## ⚠ 制約・注意点

- ⚠ **2人専用（1対1）**：複数人に対応していません
- ⚠ **通話相手がいないと映像が届かない**：WebRTCはP2P通信なので、別タブや別デバイスから接続する必要があります
- ⚠ **WebSocketはブロードキャスト方式**：誰が誰に送っているかの識別がないため、ルーム分け未対応
- ⚠ **STUNのみ（TURN未使用）**：NAT環境下で通信がうまくいかない場合があります
- ⚠ **セキュリティなし**：HTTPS未対応、WSS未使用、CORS制限なし（開発用）

## 今後の改善案

| 項目 | 内容 |
|------|------|
| ルーム機能の導入 | 複数ユーザー間で接続先を識別できるようにする |
| WebSocketのWSS対応 | HTTPS環境でも通話可能に（ngrok や Cloudflare Tunnel 推奨） |
| TURNサーバの導入 | NAT越えでも通信可能に（`coturn` など） |
| UIの強化 | 通話状態の表示（例：接続中、切断済み、相手未接続など） |
| 本番環境へのデプロイ | FastAPI + nginx + Let's Encrypt + Next.js（Vercel など）

