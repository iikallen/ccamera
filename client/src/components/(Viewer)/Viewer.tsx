// client/src/components/(Viewer)/Viewer.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import WebRTCClient from '@/services/webrtc';

type ProducerInfo = { cameraId: string; producerId: string };

export default function Viewer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [producers, setProducers] = useState<ProducerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [muted, setMuted] = useState(true);

  function pushLog(...args: any[]) {
    const s = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    setLogs(prev => [new Date().toISOString() + ' ' + s, ...prev].slice(0, 200));
    console.log(...args);
  }

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        // передаваем токен из localStorage если есть
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        pushLog('[Viewer] init - calling WebRTCClient.init(), token=', !!token);
        await WebRTCClient.init(token || undefined);
        pushLog('[Viewer] init - listing producers');
        const list = await WebRTCClient.listProducers();
        if (!mounted) return;
        pushLog('[Viewer] producers count=', list?.length);
        setProducers(list);
        if (list && list.length) setSelected(list[0].producerId);
        setInitialized(true);
      } catch (e: any) {
        pushLog('[Viewer] Viewer init error', e && e.message ? e.message : e);
        // покажем пользователю
        alert('Ошибка инициализации WebRTC: ' + (e && e.message ? e.message : String(e)));
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      try { WebRTCClient.close(); } catch {}
    };
  }, []);

  const handleWatch = async (producerId?: string) => {
    const id = producerId || selected;
    if (!id) {
      alert('Выберите камеру');
      return;
    }
    setLoading(true);
    pushLog('[Viewer] starting consume for', id);
    try {
      // WebRTCClient.consume теперь автоматически попробует init() если нужно
      const stream = await WebRTCClient.consume(id);
      if (!stream) throw new Error('no stream returned from consume');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          pushLog('[Viewer] onloadedmetadata', { videoWidth: videoRef.current?.videoWidth, videoHeight: videoRef.current?.videoHeight });
        };
        videoRef.current.onplaying = () => pushLog('[Viewer] onplaying');
        videoRef.current.onerror = (e) => pushLog('[Viewer] video error', e);

        // Чтобы autoplay не блокировался - временно ставим muted
        videoRef.current.muted = muted;
        try {
          await videoRef.current.play();
          pushLog('[Viewer] video.play() ok');
        } catch (e) {
          pushLog('[Viewer] video.play() failed', e);
        }
      } else {
        pushLog('[Viewer] no videoRef');
      }
    } catch (e: any) {
      pushLog('[Viewer] consume error', e && e.message ? e.message : e);
      alert('Не удалось начать воспроизведение: ' + (e && e.message ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const handleUnmute = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setMuted(false);
      pushLog('[Viewer] video unmuted by user');
    }
  };

  const handleSnapshot = () => {
    const v = videoRef.current;
    if (!v) return alert('Видео не запущено');
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return alert('Не удалось получить canvas context');
    try {
      ctx.drawImage(v, 0, 0, w, h);
      const data = canvas.toDataURL('image/png');
      pushLog('[Viewer] snapshot size=', data.length);
      const win = window.open();
      if (win) {
        win.document.write(`<img src="${data}" />`);
      } else {
        const a = document.createElement('a');
        a.href = data;
        a.download = 'snapshot.png';
        a.click();
      }
    } catch (err) {
      pushLog('[Viewer] snapshot failed', err);
      alert('Snapshot failed: ' + String(err));
    }
  };

  return (
    <div style={{ padding: 12, fontFamily: 'sans-serif' }}>
      <h2>Viewer</h2>

      <div style={{ marginBottom: 8 }}>
        {loading ? <strong>Загрузка...</strong> : null}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Доступные камеры:&nbsp;</label>
        <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value || null)}>
          <option value=''>-- выберите камеру --</option>
          {producers.map(p => (
            <option key={p.producerId} value={p.producerId}>{p.cameraId} ({p.producerId.slice(0,6)})</option>
          ))}
        </select>
        <button onClick={() => handleWatch()} style={{ marginLeft: 8 }} disabled={!initialized || loading || !selected}>Смотреть</button>
        <button onClick={() => handleSnapshot()} style={{ marginLeft: 8 }} disabled={loading}>Снять snapshot</button>
        <button onClick={() => handleUnmute()} style={{ marginLeft: 8 }} disabled={!muted}>Включить звук</button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          controls
          muted={muted}
          style={{ width: '100%', maxWidth: 960, background: '#000' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: '1 1 60%', maxHeight: 360, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
          <h4>Логи</h4>
          <ul style={{ paddingLeft: 8 }}>
            {logs.map((l, i) => <li key={i} style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{l}</li>)}
          </ul>
        </div>

        <div style={{ width: 320, border: '1px solid #eee', padding: 8 }}>
          <h4>Инструменты</h4>
          <div style={{ fontSize: 13 }}>
            <div><strong>muted:</strong> {String(muted)}</div>
            <div style={{ marginTop: 8 }}>
              <button onClick={() => { try { WebRTCClient.close(); pushLog('[Viewer] closed client'); setInitialized(false); } catch {} }}>Close client</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
