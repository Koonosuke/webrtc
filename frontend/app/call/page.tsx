'use client';

import { useRef, useState, useEffect } from 'react';

export default function CallPage() {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const [started, setStarted] = useState(false);
  const [users, setUsers] = useState<string[]>([]);

  const [roomId, setRoomId] = useState('default');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setRoomId(params.get('room') || 'default');
      setUserName(params.get('user') || `User${Math.floor(Math.random() * 1000)}`);
    }
  }, []);

  const getWebSocketURL = (): string => {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const host = process.env.NEXT_PUBLIC_FASTAPI_HOST || location.hostname;
    return `${protocol}://${host}/ws/${roomId}`;
  };

  const start = async () => {
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

    stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));

    pc.current.ontrack = event => {
      if (remoteVideo.current && !remoteVideo.current.srcObject) {
        remoteVideo.current.srcObject = event.streams[0];
      }
    };

    const iceCandidateQueue: RTCIceCandidate[] = [];

    ws.current = new WebSocket(getWebSocketURL());

    let isOfferer = false;

    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({ type: 'join', user: userName }));
    };

    ws.current.onmessage = async event => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'userList':
          setUsers(data.users);
          if (data.users.length === 1 && pc.current && !isOfferer) {
            isOfferer = true;
            const offer = await pc.current.createOffer();
            await pc.current.setLocalDescription(offer);
            ws.current?.send(JSON.stringify(offer));
          }
          break;
        case 'offer':
          if (!isOfferer) {
            await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.current?.createAnswer();
            await pc.current?.setLocalDescription(answer!);
            ws.current?.send(JSON.stringify(pc.current?.localDescription));
          }
          break;
        case 'answer':
          if (isOfferer) {
            await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
            while (iceCandidateQueue.length > 0) {
              await pc.current?.addIceCandidate(iceCandidateQueue.shift()!);
            }
          }
          break;
        default:
          if (data.candidate) {
            const candidate = new RTCIceCandidate(data);
            if (pc.current?.remoteDescription) {
              await pc.current.addIceCandidate(candidate);
            } else {
              iceCandidateQueue.push(candidate);
            }
          }
      }
    };

    pc.current.onicecandidate = event => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(event.candidate));
      }
    };

    setStarted(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-start py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">WebRTC 通話モック</h1>

      <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl justify-center">
        <video
          ref={localVideo}
          autoPlay
          muted
          playsInline
          className="w-full lg:w-1/2 rounded-lg shadow-lg border border-gray-700"
        />
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className="w-full lg:w-1/2 rounded-lg shadow-lg border border-gray-700"
        />
      </div>

      {!started && (
        <button
          onClick={start}
          className="mt-8 bg-blue-600 hover:bg-blue-700 transition px-6 py-3 rounded-lg font-semibold text-lg"
        >
          通話を開始する
        </button>
      )}

      {users.length > 0 && (
        <div className="mt-10 bg-gray-800 p-4 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-2">🧑‍🤝‍🧑 接続中のユーザー:</h2>
          <ul className="list-disc pl-6 space-y-1">
            {users.map((user) => (
              <li key={user}>{user}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
