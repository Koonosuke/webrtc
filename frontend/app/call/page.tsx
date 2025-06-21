'use client';

import { useRef, useState } from 'react';

export default function CallPage() {
  const localVideo = useRef<HTMLVideoElement>(null);//自身のPCカメラ表示
  const remoteVideo = useRef<HTMLVideoElement>(null);//相手のカメラ
  const pc = useRef<RTCPeerConnection | null>(null);//P2P接続のオブジェクト
  const ws = useRef<WebSocket | null>(null);//シグナリング用のWebSocket接続（バックエンド通信）
  const [started, setStarted] = useState(false);//通話開始

  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const roomId = urlParams?.get('room') || 'default';//受信者
  const isOfferer = urlParams?.get('offer') === 'true';//発信者

const getWebSocketURL = () => {
  const hostname = location.hostname;
  const isTunnel = hostname.includes('ngrok-free.app') || hostname.includes('trycloudflare.com');

  // Cloudflare用のURLに書き換え!

  const fastapiHost = 'orbit-thou-connection-specifies.trycloudflare.com';

  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const wsHost = isTunnel ? `${wsProtocol}://${fastapiHost}` : `${wsProtocol}://${location.host}`;

  return `${wsHost}/ws/${roomId}`;
};


  const start = async () => {
    // getUserMedia の存在チェック
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      alert('このブラウザはカメラ・マイクをサポートしていません。');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideo.current) localVideo.current.srcObject = stream;

    pc.current = new RTCPeerConnection({//P2P接続をする→STUN/TURNサーバー
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

  if (data.type === 'offer') {
    if (!isOfferer) {
      console.log('オファーを受信！');
      await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.current?.createAnswer();
      await pc.current?.setLocalDescription(answer!);
      ws.current?.send(JSON.stringify(pc.current?.localDescription));
      console.log('アンサー送信！');
    }
  } else if (data.type === 'answer') {
    if (isOfferer) {
      console.log('アンサーを受信！');
      await pc.current?.setRemoteDescription(new RTCSessionDescription(data));
      // remoteDescription 設定後にキューを適用
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
        console.log('ICE candidate 受信: 即時追加');
        await pc.current.addIceCandidate(candidate);
      } catch (e) {
        console.warn('ICE candidate 即時追加失敗:', e);
      }
    } else {
      console.log('ICE candidate 受信: 待機キューに追加');
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
    </main>
  );
}