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