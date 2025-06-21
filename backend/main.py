from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Tuple
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では制限してください
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 各ルームごとに (WebSocket, userName) のリストを保持
rooms: Dict[str, List[Tuple[WebSocket, str]]] = {}

# 保留中のメッセージ（相手がいない場合の保存用）
pending_messages: Dict[str, List[str]] = {}

# 現在のユーザー一覧を全員にブロードキャストする関数
async def broadcast_user_list(room_id: str):
    if room_id not in rooms:
        return
    user_list = [user for _, user in rooms[room_id]]
    message = json.dumps({ "type": "userList", "users": user_list })
    for conn, _ in rooms[room_id]:
        try:
            await conn.send_text(message)
        except Exception as e:
            print(f"⚠️ ユーザー一覧送信失敗: {e}")

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    print(f"✅ 接続: room={room_id}")

    try:
        # クライアントから初回に送られてくるユーザー名を取得
        init_data = await websocket.receive_text()
        data = json.loads(init_data)
        user_name = data.get("user", "anonymous")

        if room_id not in rooms:
            rooms[room_id] = []

        # 同じユーザー名+ソケットの重複登録を防止
        if not any(ws == websocket for ws, _ in rooms[room_id]):
            rooms[room_id].append((websocket, user_name))
            print(f"🙋‍♂️ 参加: {user_name} in room={room_id}")

        await broadcast_user_list(room_id)

        # 保留中メッセージを送信
        if room_id in pending_messages:
            for msg in pending_messages[room_id]:
                try:
                    await websocket.send_text(msg)
                except Exception as e:
                    print(f"⚠️ 保留メッセージ送信失敗: {e}")
            pending_messages[room_id] = []

        # メッセージループ
        while True:
            msg = await websocket.receive_text()
            print(f"📩 メッセージ受信 from {user_name}: {msg[:100]}...")

            alive_conns = rooms.get(room_id, [])
            if len(alive_conns) <= 1:
                print("💤 相手不在 → 保留メッセージに追加")
                pending_messages.setdefault(room_id, []).append(msg)
            else:
                for conn, _ in alive_conns:
                    await conn.send_text(msg)

    except WebSocketDisconnect:
        print(f"❌ 切断: {user_name} from room={room_id}")
        # 切断されたソケットを削除
        rooms[room_id] = [entry for entry in rooms[room_id] if entry[0] != websocket]
        if rooms[room_id]:
            await broadcast_user_list(room_id)
        else:
            del rooms[room_id]
            print(f"🗑️ 空のルーム削除: {room_id}")

    except Exception as e:
        print(f"🚨 エラー: {e}")
        rooms[room_id] = [entry for entry in rooms[room_id] if entry[0] != websocket]
        if rooms.get(room_id):
            await broadcast_user_list(room_id)
        else:
            rooms.pop(room_id, None)
