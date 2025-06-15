'use client';

import { useRef, useState } from 'react';

export default function CallPage() {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const [started, setStarted] = useState(false);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo.current) localVideo.current.srcObject = stream;

    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    stream.getTracks().forEach((track) => {
      pc.current?.addTrack(track, stream);
    });

    pc.current.ontrack = (event) => {
      if (remoteVideo.current) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    ws.current = new WebSocket('ws://localhost:8000/ws');

    // 🔒 接続確立後に送信
    ws.current.onopen = async () => {
      const offer = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offer);
      ws.current!.send(JSON.stringify(offer));
    };

    // 🔄 相手からのデータ受信
    ws.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'offer') {
        await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.current?.createAnswer();
        await pc.current?.setLocalDescription(answer!);
        ws.current?.send(JSON.stringify(pc.current?.localDescription));
      } else if (data.type === 'answer') {
        await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
      } else if (data.candidate) {
        await pc.current?.addIceCandidate(new RTCIceCandidate(data));
      }
    };

    // 🔄 ICE候補を安全に送信（OPEN状態だけ）
    pc.current.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(event.candidate));
      }
    };

    setStarted(true);
  };

  return (
    <main className="flex flex-col items-center p-8 gap-4">
      <h1 className="text-2xl font-bold">WebRTC 通話モック</h1>
      <video ref={localVideo} autoPlay muted playsInline className="w-80 border" />
      <video ref={remoteVideo} autoPlay playsInline className="w-80 border" />
      {!started && (
        <button
          onClick={start}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          通話開始
        </button>
      )}
    </main>
  );
}

