"use client";

import React, { useEffect, useState, useRef } from 'react';
export default function SnapshotsFeed() {
  // state
  const [items, setItems] = useState([]); // list of snapshots (newest first)
  const [filter, setFilter] = useState('all'); // all | known | new
  const [query, setQuery] = useState(''); // search by name/id/filename
  const [selected, setSelected] = useState(null); // selected item for modal
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ todayNew: 0, todayKnown: 0, total: 0 });
  const eventSourceRef = useRef(null);
  const pollRef = useRef(null);

  // backend endpoints (adjust if needed)
  // IMPORTANT: Set NEXT_PUBLIC_API_URL to your backend base (e.g. http://localhost:5000)
  const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) || '';
  const LIST_URL = `${API_BASE}/api/compreface/archives`; // GET list
  const ARCHIVE_STREAM_URL = `${API_BASE}/api/compreface/archives/stream`; // optional SSE stream
  const ENROLL_URL = `${API_BASE}/api/compreface/enroll`; // POST ?subject=NAME (expects file form-data)
  const DELETE_URL = `${API_BASE}/api/compreface/archive`; // DELETE ?filename=...
  const EXPORT_URL = `${API_BASE}/api/compreface/export`; // GET ?date=YYYY-MM-DD -> zip

  // Helper: convert backend-relative /static/... URLs to absolute using API_BASE
  function toAbsoluteUrl(u) {
    if (!u) return u;
    if (/^https?:\/\//i.test(u)) return u;
    if (!API_BASE) return u; // if API_BASE not set, leave relative (assume same origin)
    const base = API_BASE.replace(/\/$/, '');
    if (u.startsWith('/')) return base + u;
    return base + '/' + u;
  }

  useEffect(() => {
    fetchInitial();
    startLive();
    return () => stopLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchInitial() {
    setLoading(true);
    try {
      const res = await fetch(LIST_URL);
      if (!res.ok) throw new Error(`fetch list failed ${res.status}`);
      const data = await res.json();
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(data);
      recomputeStats(data);
    } catch (e) {
      console.error('fetchInitial error', e);
    } finally {
      setLoading(false);
    }
  }

  function recomputeStats(list) {
    const today = new Date().toISOString().slice(0, 10);
    let todayNew = 0, todayKnown = 0;
    list.forEach(i => {
      const d = new Date(i.createdAt).toISOString().slice(0,10);
      if (d === today) {
        if (i.recognized) todayKnown++;
        else todayNew++;
      }
    });
    setStats({ todayNew, todayKnown, total: list.length });
  }

  // Live updates: attach SSE, fallback to polling
  function startLive() {
    if (typeof EventSource !== 'undefined') {
      try {
        const es = new EventSource(ARCHIVE_STREAM_URL);
        es.onmessage = (ev) => {
          try {
            const obj = JSON.parse(ev.data);
            pushNewItem(obj);
          } catch (e) { console.warn('sse parse', e); }
        };
        es.onerror = (err) => {
          console.warn('SSE error, fallback to polling', err);
          try { es.close(); } catch(e){}
          eventSourceRef.current = null;
          startPolling();
        };
        eventSourceRef.current = es;
        return;
      } catch (e) {
        console.warn('SSE not available', e);
      }
    }
    startPolling();
  }

  function stopLive() {
    if (eventSourceRef.current) {
      try { eventSourceRef.current.close(); } catch(e){}
      eventSourceRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${LIST_URL}?since=0&limit=20`);
        if (!res.ok) return;
        const data = await res.json();
        data.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
        // prepend any items that are new
        setItems(prev => {
          if (!prev.length) { recomputeStats(data); return data; }
          const existingSet = new Set(prev.map(p => p.filename));
          const newOnes = data.filter(d => !existingSet.has(d.filename));
          if (newOnes.length) {
            const next = [...newOnes, ...prev];
            recomputeStats(next);
            return next;
          }
          return prev;
        });
      } catch (e) {
        console.warn('poll err', e);
      }
    }, 5000);
  }

  function pushNewItem(obj) {
    setItems(prev => {
      if (prev.some(p => p.filename === obj.filename || (p.hash && obj.hash && p.hash === obj.hash))) return prev;
      const next = [obj, ...prev];
      recomputeStats(next);
      return next;
    });
  }

  // derived list after filter/search
  const filtered = items.filter(i => {
    if (filter === 'new' && i.recognized) return false;
    if (filter === 'known' && !i.recognized) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!((i.subject || '')?.toLowerCase().includes(q) || (i.filename || '').toLowerCase().includes(q) || (i.id||'').toString().includes(q))) return false;
    }
    return true;
  });

  // Actions implementation
  async function enrollItem(item, subjectName) {
    try {
      // fetch image blob from backend absolute url (fix for different ports)
      const imageResp = await fetch(toAbsoluteUrl(item.url));
      if (!imageResp.ok) throw new Error(`image fetch failed ${imageResp.status}`);
      const blob = await imageResp.blob();
      const fd = new FormData();
      fd.append('file', blob, item.filename || 'snapshot.png');

      const enrollResp = await fetch(`${ENROLL_URL}?subject=${encodeURIComponent(subjectName)}`, { method: 'POST', body: fd });
      const text = await enrollResp.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch(e) { parsed = text; }

      // optimistic update: mark item as recognized
      setItems(prev => {
        const next = prev.map(p => p.filename === item.filename ? { ...p, recognized: true, subject: subjectName } : p);
        recomputeStats(next);
        return next;
      });
      setSelected(prev => prev && prev.filename === item.filename ? { ...prev, recognized: true, subject: subjectName } : prev);

      return parsed;
    } catch (e) {
      console.error('enrollItem error', e);
      throw e;
    }
  }

  async function deleteItem(item) {
    if (!confirm('Удалить снимок из архива?')) return false;
    try {
      const resp = await fetch(`${DELETE_URL}?filename=${encodeURIComponent(item.filename)}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error(`delete failed ${resp.status}`);
      setItems(prev => {
        const next = prev.filter(p => p.filename !== item.filename);
        recomputeStats(next);
        return next;
      });
      setSelected(null);
      return true;
    } catch (e) {
      console.error('deleteItem error', e);
      alert('Не удалось удалить снимок');
      return false;
    }
  }

  async function exportDay(dateIso) {
    try {
      const resp = await fetch(`${EXPORT_URL}?date=${encodeURIComponent(dateIso)}`);
      if (!resp.ok) throw new Error(`export failed ${resp.status}`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshots-${dateIso}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Экспорт не удался');
    }
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters column */}
        <div className="col-span-1 bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
          <h2 className="text-lg font-semibold mb-3">Фильтры</h2>
          <div className="flex gap-2 mb-3">
            <button onClick={() => setFilter('all')} className={`px-3 py-1 rounded ${filter==='all' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Все</button>
            <button onClick={() => setFilter('new')} className={`px-3 py-1 rounded ${filter==='new' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Новые</button>
            <button onClick={() => setFilter('known')} className={`px-3 py-1 rounded ${filter==='known' ? 'bg-indigo-600 text-white' : 'bg-gray-100'}`}>Известные</button>
          </div>

          <div className="mb-3">
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Поиск по имени/файлу" className="w-full px-3 py-2 rounded border" />
          </div>

          <div className="mb-3">
            <h3 className="text-sm font-medium">Экспорт</h3>
            <div className="flex gap-2 mt-2">
              <input type="date" id="exportDate" className="px-2 py-1 rounded border" />
              <button onClick={() => { const d = document.getElementById('exportDate').value; if (d) exportDay(d); else alert('Выберите дату'); }} className="px-3 py-1 bg-green-600 text-white rounded">Экспорт</button>
            </div>
            <div className="mt-2">
              <a href={`${EXPORT_URL}?date=${new Date().toISOString().slice(0,10)}`} className="px-3 py-1 inline-block bg-green-500 text-white rounded">Экспорт за сегодня (быстро)</a>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <div>Сегодня: <strong>{stats.todayNew}</strong> новых, <strong>{stats.todayKnown}</strong> узнаваемых</div>
            <div>Всего снимков: <strong>{stats.total}</strong></div>
          </div>

          <div className="mt-6 text-xs text-gray-500">
            <div className="mb-2">Live:</div>
            <div className="flex gap-2 items-center">
              <span className="inline-block w-3 h-3 bg-green-400 rounded-full" />
              <span>{eventSourceRef.current ? 'SSE' : 'Polling'}</span>
            </div>
          </div>
        </div>

        {/* Main gallery */}
        <div className="col-span-1 lg:col-span-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold">Лента снимков</h1>
              <div className="text-sm text-gray-600">Показано: {filtered.length}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {loading && <div className="col-span-full text-center py-10">Загрузка...</div>}
              {!loading && filtered.length === 0 && <div className="col-span-full text-center py-10 text-gray-500">Нет снимков</div>}

              {filtered.map(item => (
                <div key={item.filename} className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow-sm relative cursor-pointer" onClick={() => setSelected(item)}>
                  <img src={toAbsoluteUrl(item.url)} alt={item.filename} className="w-full h-40 object-cover" />
                  <div className="p-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div className="truncate max-w-[70%]">{item.subject ? item.subject : <span className="italic text-gray-500">Новое лицо</span>}</div>
                      <div className={`text-[11px] px-2 py-0.5 rounded ${item.recognized ? 'bg-green-600 text-white' : 'bg-yellow-400 text-black'}`}>{item.recognized ? 'Известное' : 'Новое'}</div>
                    </div>
                    <div className="mt-1 text-gray-500">{new Date(item.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 w-full max-w-4xl mx-4 rounded-2xl overflow-hidden shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="md:col-span-2 p-4 flex items-center justify-center">
                <img src={toAbsoluteUrl(selected.url)} alt={selected.filename} className="max-h-[70vh] object-contain" />
              </div>
              <div className="p-4 border-l">
                <h3 className="font-semibold mb-2">Метаданные</h3>
                <div className="text-sm text-gray-700 mb-2">Filename: <code className="text-xs bg-gray-100 p-1 rounded">{selected.filename}</code></div>
                <div className="text-sm text-gray-700 mb-2">Subject: <strong>{selected.subject || '—'}</strong></div>
                <div className="text-sm text-gray-700 mb-2">Recognized: {selected.recognized ? 'Да' : 'Нет'}</div>
                <div className="text-sm text-gray-700 mb-2">Created: {new Date(selected.createdAt).toLocaleString()}</div>

                <div className="flex gap-2 mt-4">
                  {!selected.recognized && (
                    <button onClick={async () => {
                      const name = prompt('Введите имя/ID субъекта для регистрации:');
                      if (!name) return;
                      try {
                        await enrollItem(selected, name);
                        alert('Зарегистрировано');
                      } catch (e) {
                        alert('Ошибка регистрации');
                      }
                    }} className="px-3 py-2 bg-indigo-600 text-white rounded">Добавить в субъекты</button>
                  )}

                  <a href={toAbsoluteUrl(selected.url)} target="_blank" rel="noreferrer" className="px-3 py-2 bg-gray-200 rounded">Открыть оригинал</a>

                  <button onClick={() => deleteItem(selected)} className="px-3 py-2 bg-red-600 text-white rounded">Удалить</button>

                  <button onClick={() => setSelected(null)} className="ml-auto px-3 py-2 bg-gray-300 rounded">Закрыть</button>
                </div>

                <div className="mt-4 text-xs text-gray-500">
                  <pre className="max-h-40 overflow-auto text-xs bg-gray-50 p-2 rounded">{JSON.stringify(selected.rawRecognize || {}, null, 2)}</pre>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
