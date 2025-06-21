from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番では適切に制限する
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms: Dict[str, List[WebSocket]] = {}
pending_messages: Dict[str, List[str]] = {}  # 🔸追加：未送信メッセージを保存するバッファ

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    print(f"✅ 接続: room={room_id}")

    # 初期化
    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(websocket)
    print(f"📡 現在の接続数（{room_id}）: {len(rooms[room_id])}")

    # 🔸追加：保存されていたメッセージを送信
    if room_id in pending_messages:
        print(f"📦 保留中メッセージ {len(pending_messages[room_id])} 件送信")
        for msg in pending_messages[room_id]:
            try:
                await websocket.send_text(msg)
            except Exception as e:
                print(f"⚠️ 保留メッセージ送信失敗: {e}")
        pending_messages[room_id] = []

    try:
        while True:
            data = await websocket.receive_text()
            print(f"📩 受信 from {room_id}: {data[:100]}...")

            # 🔸メッセージ中継 or 保留
            alive_conns = rooms.get(room_id, [])
            if len(alive_conns) <= 1:
                # 1人だけ → 保留（自分には送らない）
                print(f"💤 送信先不在 → メッセージ保留")
                pending_messages.setdefault(room_id, []).append(data)
            else:
                for conn in alive_conns:
                    await conn.send_text(data)

    except WebSocketDisconnect:
        print(f"❌ 切断: room={room_id}")
        rooms[room_id].remove(websocket)
        if not rooms[room_id]:
            del rooms[room_id]
            print(f"🗑️ 空のルーム削除: {room_id}")

    except Exception as e:
        print(f"🚨 エラー: {e}")
        if websocket in rooms.get(room_id, []):
            rooms[room_id].remove(websocket)
        if not rooms.get(room_id):
            rooms.pop(room_id, None)
