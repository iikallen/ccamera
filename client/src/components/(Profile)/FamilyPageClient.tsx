'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import $api from '@/http';
import { useAuth } from '@/providers/AuthContext';
import type { IUser } from '@/models/IUser';
import { FaPlus, FaSync, FaTrash, FaUser, FaSpinner, FaImage } from 'react-icons/fa';

type Photo = {
  filename: string;
  url: string;
  hash?: string | null;
  size?: number;
  createdAt: string;
};

type Member = {
  _id: string;
  user: string;
  name: string;
  relation?: string;
  photos: Photo[];
};

type Props = { username: string };

export default function FamilyPageClient({ username }: Props) {
  const { user: authUser, isAuthenticated } = useAuth();

  const isOwnProfile = useMemo(() => {
    if (!isAuthenticated) return false;
    const u = authUser as IUser | null;
    if (!u) return false;
    const userId = String((u as any).id ?? (u as any)._id ?? '');
    if (userId && username === userId) return true;
    if ((u as any).username && String((u as any).username).toLowerCase() === username.toLowerCase()) return true;
    if ((u as any).name && String((u as any).name).toLowerCase() === username.toLowerCase()) return true;
    return false;
  }, [authUser, username, isAuthenticated]);

  const ownerId = isOwnProfile ? String((authUser as any)?.id ?? (authUser as any)?._id ?? '') : null;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRelation, setNewRelation] = useState('дочь');
  const [message, setMessage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const RELATIONS = ['муж','жена','сын','дочь','отец','мать','брат','сестра','партнёр','друг','другое'];
  const placeholder = '/images/image-missing.png';

  // build backend origin fallback without importing external constant
  const BACKEND_ORIGIN = (typeof window !== 'undefined' && (window as any).__NEXT_DATA__?.env?.NEXT_PUBLIC_BACKEND_URL)
    ? (window as any).__NEXT_DATA__.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '')
    : (process.env.NEXT_PUBLIC_BACKEND_URL ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, '') : 'http://localhost:5000');

  const resolveSrc = (url?: string) => {
    if (!url) return placeholder;
    const s = String(url);
    if (s.startsWith('/static/')) {
      return `${BACKEND_ORIGIN}${s}`;
    }
    return s;
  };

  const loadMembers = useCallback(async () => {
    setMessage('');
    setErrorDetails(null);
    if (!ownerId) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await $api.get(`/family/${encodeURIComponent(ownerId)}`);
      setMembers(Array.isArray(resp.data) ? resp.data : []);
    } catch (err: any) {
      console.error('Family page load error', err);
      if (err?.response) {
        setMessage(`Ошибка сервера: ${err.response.status}`);
        setErrorDetails(JSON.stringify(err.response.data));
      } else {
        setMessage(`Network error: ${String(err?.message ?? err)}`);
        setErrorDetails(String(err));
      }
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleAddMember = async () => {
    if (!ownerId) { setMessage('Нельзя добавлять: не ваш профиль'); return; }
    if (!newName.trim()) { setMessage('Введите имя'); return; }
    setAdding(true);
    setMessage('');
    try {
      await $api.post('/family', { userId: ownerId, name: newName.trim(), relation: newRelation });
      setNewName('');
      setNewRelation('дочь');
      await loadMembers();
    } catch (err: any) {
      console.error('add member error', err);
      if (err?.response) {
        setMessage(`Ошибка сервера: ${err.response.status}`);
        setErrorDetails(JSON.stringify(err.response.data));
      } else {
        setMessage(`Network error: ${String(err?.message ?? err)}`);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Удалить члена семьи и все его фото?')) return;
    try {
      await $api.delete(`/family/${id}`);
      await loadMembers();
    } catch (err) {
      console.error('delete member', err);
      setMessage('Ошибка удаления');
    }
  };

  const handleUploadPhoto = async (memberId: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploadingFor(memberId);
    setMessage('');
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      await $api.post(`/family/${memberId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await loadMembers();
    } catch (err: any) {
      console.error('upload photo', err);
      setMessage('Ошибка загрузки фото');
      if (err?.response) setErrorDetails(JSON.stringify(err.response.data));
    } finally {
      setUploadingFor(null);
    }
  };

  const handleDeletePhoto = async (memberId: string, filename: string) => {
    if (!confirm('Удалить фото?')) return;
    try {
      await $api.delete(`/family/${memberId}/photo`, { params: { filename } });
      await loadMembers();
    } catch (err) {
      console.error('delete photo', err);
      setMessage('Ошибка удаления фото');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-xl p-6 shadow-lg mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Члены семьи</h1>
          <p className="text-gray-600 mb-6">
            Управление членами семьи и их фотографиями.
          </p>

          {message && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700">
              {message}
              {errorDetails && (
                <pre className="text-xs mt-2 whitespace-pre-wrap overflow-auto">
                  {errorDetails}
                </pre>
              )}
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Добавить члена семьи</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Имя</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Имя"
                  className="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Отношение</label>
                <select
                  value={newRelation}
                  onChange={(e) => setNewRelation(e.target.value)}
                  className="w-full px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button
                  onClick={handleAddMember}
                  disabled={adding || !isOwnProfile}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50"
                >
                  <FaPlus />
                  {adding ? 'Добавляем...' : 'Добавить'}
                </button>
                <button
                  onClick={loadMembers}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg transition duration-300"
                >
                  <FaSync />
                </button>
              </div>
            </div>
            {!isOwnProfile && (
              <div className="mt-3 text-sm text-gray-500">Только владелец может добавлять членов.</div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">Список</h2>
              {loading && <FaSpinner className="animate-spin text-gray-500" />}
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500">
                <FaSpinner className="animate-spin text-2xl mx-auto mb-2" />
                <p>Загрузка...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <FaImage className="text-2xl mx-auto mb-2" />
                <p>Члены семьи не найдены.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {members.map((m) => (
                  <div key={m._id} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-bold text-gray-800 text-lg">
                          {m.name} {m.relation && (
                            <span className="text-sm font-normal text-gray-600 ml-2">· {m.relation}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          Фото: {m.photos?.length ?? 0}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOwnProfile && (
                          <>
                            <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-300 cursor-pointer">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadPhoto(m._id, e.target.files)}
                              />
                              {uploadingFor === m._id ? <FaSpinner className="animate-spin" /> : <FaPlus />}
                              Добавить фото
                            </label>

                            <button
                              onClick={() => handleDeleteMember(m._id)}
                              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition duration-300"
                            >
                              <FaTrash />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {m.photos && m.photos.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {m.photos.map((p) => {
                          const src = resolveSrc(p.url);
                          return (
                            <div key={p.filename} className="relative bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                              <a
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="block w-full h-40 overflow-hidden"
                              >
                                <img
                                  src={src}
                                  alt={p.filename}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = placeholder; }}
                                />
                              </a>
                              {isOwnProfile && (
                                <button
                                  onClick={() => handleDeletePhoto(m._id, p.filename)}
                                  className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full"
                                  title="Удалить фото"
                                >
                                  <FaTrash className="text-xs" />
                                </button>
                              )}
                              <div className="p-3">
                                <div className="text-xs font-medium text-gray-700 truncate">
                                  {p.filename}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {new Date(p.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
