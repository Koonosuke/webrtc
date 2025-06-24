from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Tuple
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では適切に制限
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 接続ルームと保留メッセージの構造
rooms: Dict[str, List[Tuple[WebSocket, str]]] = {}
pending_messages: Dict[str, List[str]] = {}

async def broadcast_user_list(room_id: str):
    if room_id not in rooms:
        print(f"⚠️ broadcast_user_list: 無効なルーム: {room_id}")
        return

    user_list = [user for _, user in rooms[room_id]]
    print(f"📡 ブロードキャスト: {room_id} のユーザー一覧: {user_list}")

    message = json.dumps({ "type": "userList", "users": user_list })
    for conn, _ in rooms[room_id]:
        try:
            await conn.send_text(message)
        except Exception as e:
            print(f"⚠️ ユーザー一覧送信失敗: {e}")

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    print(f"✅ WebSocket接続: room={room_id}, client={websocket.client}")

    try:
        init_data = await websocket.receive_text()
        print(f"📥 初期データ受信: {init_data}")

        data = json.loads(init_data)
        user_name = data.get("user", "anonymous") if data.get("type") == "join" else "anonymous"
        print(f"🙋‍♂️ ユーザー名: {user_name}")

        # ルームに追加
        if room_id not in rooms:
            rooms[room_id] = []
        if not any(ws == websocket for ws, _ in rooms[room_id]):
            rooms[room_id].append((websocket, user_name))
            print(f"✅ {user_name} を {room_id} に追加")

        await broadcast_user_list(room_id)

        # 保留メッセージ送信
        if room_id in pending_messages:
            for msg in pending_messages[room_id]:
                await websocket.send_text(msg)
            pending_messages[room_id] = []

        # メッセージ受信ループ
        while True:
            msg = await websocket.receive_text()
            print(f"💬 {user_name} からメッセージ: {msg}")
            alive_conns = rooms.get(room_id, [])
            if len(alive_conns) <= 1:
                print(f"🕓 保留メッセージとして保存（他に接続者なし）")
                pending_messages.setdefault(room_id, []).append(msg)
            else:
                for conn, _ in alive_conns:
                    await conn.send_text(msg)

    except WebSocketDisconnect:
        print(f"🔌 切断検知: {user_name}")
        rooms[room_id] = [entry for entry in rooms[room_id] if entry[0] != websocket]
        if rooms[room_id]:
            await broadcast_user_list(room_id)
        else:
            del rooms[room_id]
            print(f"🧹 {room_id} を削除（空になった）")

    except Exception as e:
        print(f"❌ エラー: {e}")
        rooms[room_id] = [entry for entry in rooms[room_id] if entry[0] != websocket]
        if rooms.get(room_id):
            await broadcast_user_list(room_id)
        else:
            rooms.pop(room_id, None)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"status": "ok"}
