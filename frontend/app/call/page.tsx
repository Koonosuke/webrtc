'use client';

import { useRef, useState } from 'react';

export default function CallPage() {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const ws = useRef<WebSocket | null>(null);

  const [started, setStarted] = useState(false);
  const [users, setUsers] = useState<string[]>([]); // 👈 ユーザー一覧の状態追加

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const roomId = urlParams?.get('room') || 'default';
  const isOfferer = urlParams?.get('offer') === 'true';

  const getUserName = () => {
    return localStorage.getItem('userName') || `User${Math.floor(Math.random() * 1000)}`;
  };

  const getWebSocketURL = () => {
    const hostname = location.hostname;
    const isTunnel = hostname.includes('ngrok-free.app') || hostname.includes('trycloudflare.com');
    const fastapiHost = 'upgrading-lean-interesting-americans.trycloudflare.com';
    const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = isTunnel ? `${wsProtocol}://${fastapiHost}` : `${wsProtocol}://${location.host}`;
    return `${wsHost}/ws/${roomId}`;
  };

  const start = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('このブラウザはカメラ・マイクをサポートしていません。');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo.current) localVideo.current.srcObject = stream;

    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });

    stream.getTracks().forEach((track) => {
      pc.current?.addTrack(track, stream);
    });

    pc.current.ontrack = (event) => {
      if (remoteVideo.current && !remoteVideo.current.srcObject) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    ws.current = new WebSocket(getWebSocketURL());

    ws.current.onopen = async () => {
      // 👇 ユーザー名送信（最初に1回だけ）
      const userName = getUserName();
      ws.current!.send(JSON.stringify({ type: 'join', user: userName }));

      if (isOfferer) {
        const offer = await pc.current!.createOffer();
        await pc.current!.setLocalDescription(offer);
        ws.current!.send(JSON.stringify(offer));
      }
    };

    const iceCandidateQueue: RTCIceCandidate[] = [];

    ws.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket 受信:', data);

      if (data.type === 'userList') {
        console.log('🧑‍🤝‍🧑 ユーザー一覧:', data.users);
        setUsers(data.users);
      } else if (data.type === 'offer') {
        if (!isOfferer) {
          await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.current?.createAnswer();
          await pc.current?.setLocalDescription(answer!);
          ws.current?.send(JSON.stringify(pc.current?.localDescription));
        }
      } else if (data.type === 'answer') {
        if (isOfferer) {
          await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
          while (iceCandidateQueue.length > 0) {
            const candidate = iceCandidateQueue.shift();
            try {
              await pc.current?.addIceCandidate(candidate!);
            } catch (e) {
              console.warn('ICE追加エラー:', e);
            }
          }
        }
      } else if (data.candidate) {
        const candidate = new RTCIceCandidate(data);
        if (pc.current?.remoteDescription && pc.current.remoteDescription.type) {
          try {
            await pc.current.addIceCandidate(candidate);
          } catch (e) {
            console.warn('ICE candidate 追加失敗:', e);
          }
        } else {
          iceCandidateQueue.push(candidate);
        }
      }
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(event.candidate));
      }
    };

    ws.current.onerror = () => {
      alert('WebSocket エラーが発生しました。');
    };

    ws.current.onclose = () => {
      alert('WebSocket 接続が切断されました。');
    };

    setStarted(true);
  };

  return (
    <main className="flex flex-col items-center p-8 gap-4">
      <h1 className="text-2xl font-bold">WebRTC 通話モック</h1>

      <video ref={localVideo} autoPlay muted playsInline className="w-80 border rounded" />
      <video ref={remoteVideo} autoPlay playsInline className="w-80 border rounded" />

      {!started && (
        <button onClick={start} className="bg-blue-500 text-white px-4 py-2 rounded">
          通話開始
        </button>
      )}

      {/* 👇 ユーザー一覧表示 */}
      {users.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">接続中のユーザー:</h2>
          <ul className="list-disc ml-6">
            {users.map((user) => (
              <li key={user}>{user}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
