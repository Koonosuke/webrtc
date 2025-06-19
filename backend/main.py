from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番では適切に制限するらしい
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms: Dict[str, List[WebSocket]] = {}

@app.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    print(f" 接続: room={room_id}")

    if room_id not in rooms:
        rooms[room_id] = []
    rooms[room_id].append(websocket)
    print(f"現在の接続数（{room_id}）: {len(rooms[room_id])}")

    try:
        while True:
            data = await websocket.receive_text()
            print(f"受信 from {room_id}: {data[:100]}...")  # 長すぎると切れるので短縮表示

            for conn in rooms[room_id]:
                # 送信元も含めて全員に中継（WebRTCに必要）
                await conn.send_text(data)

    except WebSocketDisconnect:
        print(f"切断: room={room_id}")
        rooms[room_id].remove(websocket)
        if not rooms[room_id]:
            del rooms[room_id]
            print(f"空のルーム削除: {room_id}")

    except Exception as e:
        print(f"エラー: {e}")
        if websocket in rooms.get(room_id, []):
            rooms[room_id].remove(websocket)
        if not rooms.get(room_id):
            rooms.pop(room_id, None)
