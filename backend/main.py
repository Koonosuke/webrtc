from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List, Tuple
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番は制限する
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms: Dict[str, List[Tuple[WebSocket, str]]] = {}
pending_messages: Dict[str, List[str]] = {}

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
    try:
        init_data = await websocket.receive_text()
        data = json.loads(init_data)
        user_name = data.get("user", "anonymous")

        if room_id not in rooms:
            rooms[room_id] = []
        if not any(ws == websocket for ws, _ in rooms[room_id]):
            rooms[room_id].append((websocket, user_name))

        await broadcast_user_list(room_id)

        if room_id in pending_messages:
            for msg in pending_messages[room_id]:
                await websocket.send_text(msg)
            pending_messages[room_id] = []

        while True:
            msg = await websocket.receive_text()
            alive_conns = rooms.get(room_id, [])
            if len(alive_conns) <= 1:
                pending_messages.setdefault(room_id, []).append(msg)
            else:
                for conn, _ in alive_conns:
                    await conn.send_text(msg)

    except WebSocketDisconnect:
        rooms[room_id] = [entry for entry in rooms[room_id] if entry[0] != websocket]
        if rooms[room_id]:
            await broadcast_user_list(room_id)
        else:
            del rooms[room_id]
    except Exception as e:
        print(f"エラー: {e}")
        rooms[room_id] = [entry for entry in rooms[room_id] if entry[0] != websocket]
        if rooms.get(room_id):
            await broadcast_user_list(room_id)
        else:
            rooms.pop(room_id, None)
