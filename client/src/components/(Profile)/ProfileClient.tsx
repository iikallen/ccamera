'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import $api from '@/http';
import { useAuth } from '@/providers/AuthContext';
import { store } from '@/providers/StoreProvider';
import type { IUser } from '@/models/IUser';
import { FaUser } from 'react-icons/fa';

import ProfileEditForm from '@/components/(Profile)/ProfileEditForm';
import EnrollPanel from '@/components/(Profile)/EnrollPanel';
import Gallery from '@/components/(Profile)/Gallery';

export type ArchiveItem = {
  filename: string;
  url: string;
  hash?: string | null;
  size?: number;
  subjectName?: string | null;
  recognized?: boolean;
  createdAt: string;
  rawRecognize?: any;
};

type Props = { username: string };

function stripQuery(u?: string) {
  if (!u) return '';
  try {
    return u.split('?')[0].replace(/\/+$/, '');
  } catch {
    return u;
  }
}

export default function ProfileClient({ username }: Props) {
  const router = useRouter();
  const routeUsername = username ?? '';

  const { user: authUser, isAuthenticated, refreshUser, logout } = useAuth();

  const [isOwnProfile, setIsOwnProfile] = useState(false);

  // профильные поля
  const [usernameInput, setUsernameInput] = useState<string>(routeUsername);
  const [name, setName] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [editing, setEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>('');

  // архивы
  const [archives, setArchives] = useState<ArchiveItem[]>([]);
  const [loadingArchives, setLoadingArchives] = useState(false);

  // enroll (compreface)
  const [subjectName, setSubjectName] = useState<string>(routeUsername || '');
  const [filesToEnroll, setFilesToEnroll] = useState<File[]>([]);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState<string>('');

  useEffect(() => {
    const isOwn = (() => {
      if (!isAuthenticated) return false;
      const u = authUser as IUser | null;
      if (!u) return false;
      if (!routeUsername) return false;

      const userId = String((u as any).id ?? (u as any)._id ?? '');
      if (userId && routeUsername === userId) return true;

      if ((u as any).username && String((u as any).username).toLowerCase() === routeUsername.toLowerCase()) return true;
      if ((u as any).name && String((u as any).name).toLowerCase() === routeUsername.toLowerCase()) return true;

      return false;
    })();

    setIsOwnProfile(isOwn);

    if (isOwn) {
      setName((authUser as IUser)?.username ?? '');
      setPreviewUrl((authUser as IUser)?.avatar ?? '');
      setUsernameInput(((authUser as any)?.username as string) ?? routeUsername);
      setSubjectName(((authUser as any)?.username as string) ?? routeUsername);
    } else {
      setName('');
      setPreviewUrl('');
      setAvatarFile(null);
      setUsernameInput(routeUsername);
      setSubjectName(routeUsername);
    }
  }, [routeUsername, authUser, isAuthenticated]);

  // Загрузка архивов и subject-изображений, объединение и фильтрация
  const refreshArchives = async () => {
    if (!routeUsername) return;
    setLoadingArchives(true);

    try {
      // 1) получить все архивы (компрефейс распознанные кадры)
      const resp = await $api.get<ArchiveItem[]>('/compreface/archives');
      const allArchives: ArchiveItem[] = resp.data ?? [];

      // фильтруем по subjectName (который записывается при saveBufferToArchive)
      const archivesForSubject = allArchives.filter((it) => {
        const subj = String(it.subjectName ?? '').toLowerCase();
        return subj === routeUsername.toLowerCase();
      });

      // 2) попытка получить Subject images (DB)
      let subjectImages: ArchiveItem[] = [];
      try {
        const subjResp = await $api.get(`/compreface/subjects/${encodeURIComponent(routeUsername)}`);
        const data = subjResp.data;
        if (data && Array.isArray(data.images)) {
          subjectImages = data.images.map((img: any) => ({
            filename: img.filename,
            url: img.url,
            hash: img.hash ?? null,
            size: img.size ?? 0,
            subjectName: data.name,
            recognized: true,
            createdAt: img.createdAt ? new Date(img.createdAt).toISOString() : new Date().toISOString(),
            rawRecognize: null
          }));
        }
      } catch (e) {
        // 404 или отсутствие subject — игнорируем
      }

      // 3) исключаем из галереи текущий аватар (и его варианты)
      const avatarNorm = stripQuery(previewUrl || (authUser as any)?.avatar || '');
      const isAvatarUrl = (url?: string) => {
        if (!url) return false;
        const s = stripQuery(url);
        if (!s) return false;
        if (avatarNorm && s === avatarNorm) return true;
        // также исключаем любые файлы внутри папки uploads/avatars
        return s.includes('/uploads/avatars/');
      };

      // 4) объединяем и убираем дубликаты (по hash -> filename -> url)
      const map = new Map<string, ArchiveItem>();
      const pushUnique = (item: ArchiveItem) => {
        if (!item) return;
        if (isAvatarUrl(item.url)) return;
        const key = String(item.hash ?? item.filename ?? item.url ?? '').toLowerCase();
        if (!key) return;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, item);
        } else {
          // keep newest
          const a = new Date(existing.createdAt).getTime();
          const b = new Date(item.createdAt).getTime();
          if (b > a) map.set(key, item);
        }
      };

      archivesForSubject.forEach(pushUnique);
      subjectImages.forEach(pushUnique);

      // convert to array and sort by date desc
      const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setArchives(merged);
    } catch (e) {
      console.error('Failed to load archives for', routeUsername, e);
      setArchives([]);
    } finally {
      setLoadingArchives(false);
    }
  };

  useEffect(() => {
    refreshArchives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeUsername]);

  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage('');
    const f = e.target.files && e.target.files[0];
    setAvatarFile(f ?? null);
  };

  const handleFilesToEnrollChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnrollMessage('');
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFilesToEnroll(list);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setMessage('');
    if (!isOwnProfile) return;
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append('name', name ?? '');
      fd.append('username', usernameInput ?? '');
      if (avatarFile) fd.append('avatar', avatarFile);

      await store.updateProfile(fd);
      setMessage('Профиль успешно обновлён');

      try {
        await refreshUser();
      } catch {}

      if (usernameInput && usernameInput !== routeUsername) {
        router.replace(`/profile/${encodeURIComponent(usernameInput)}`);
      }

      // закрыть режим редактирования
      setEditing(false);
    } catch (err: any) {
      console.error('Failed to update profile', err);
      const msg = err?.response?.data?.message ?? err?.message ?? 'Ошибка при обновлении';
      setMessage(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setName((authUser as IUser)?.username ?? '');
    setAvatarFile(null);
    setPreviewUrl((authUser as IUser)?.avatar ?? '');
    setUsernameInput((authUser as any)?.username ?? routeUsername);
    setMessage('');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      router.push('/');
    }
  };

  const createdAtText = useMemo(() => {
    if (!archives.length) return '';
    const newest = archives[0];
    try {
      return new Date(newest.createdAt).toLocaleString();
    } catch {
      return newest.createdAt;
    }
  }, [archives]);

  const stats = useMemo(() => {
    return {
      totalSnapshots: archives.length,
      lastSnapshot: createdAtText || 'нет данных',
      totalSizeMb: archives.reduce((s, a) => s + (a.size || 0), 0) / (1024 * 1024)
    };
  }, [archives, createdAtText]);

  // parallel enroll with Promise.allSettled
  const enrollFilesToSubject = async (useFiles: File[]) => {
    if (!isOwnProfile) {
      setEnrollMessage('Только владелец профиля может добавлять снимки в базу.');
      return;
    }
    const subj = (subjectName || '').trim();
    if (!subj) {
      setEnrollMessage('Укажите имя subject (username) для регистрации снимков.');
      return;
    }
    if (!useFiles || useFiles.length === 0) {
      setEnrollMessage('Выберите файлы для добавления.');
      return;
    }

    setEnrollLoading(true);
    setEnrollMessage('');
    try {
      const promises = useFiles.map((f) => {
        const fd = new FormData();
        fd.append('file', f, f.name);
        return $api.post(`/compreface/enroll?subject=${encodeURIComponent(subj)}`, fd);
      });

      const results = await Promise.allSettled(promises);
      let successCount = 0;
      const errors: string[] = [];

      results.forEach((r, idx) => {
        if (r.status === 'fulfilled' && r.value && r.value.status >= 200 && r.value.status < 300) {
          successCount++;
        } else {
          const file = useFiles[idx];
          const err = r.status === 'rejected' ? r.reason : (r as any);
          const msg = err?.response?.data?.message ?? err?.message ?? 'Ошибка';
          errors.push(`${file.name}: ${msg}`);
        }
      });

      let msg = `Готово: ${successCount} файлов загружено${errors.length ? `, ${errors.length} ошибок` : ''}.`;
      if (errors.length) msg += ' ' + errors.slice(0, 3).join('; ');
      setEnrollMessage(msg);
    } catch (e) {
      console.error('enrollFilesToSubject failed', e);
      setEnrollMessage('Ошибка при добавлении снимков');
    } finally {
      setEnrollLoading(false);
      try { await refreshArchives(); } catch {}
    }
  };

  const enrollCurrentAvatar = async () => {
    if (!avatarFile && !previewUrl) {
      setEnrollMessage('Нет текущего аватара для загрузки.');
      return;
    }

    if (avatarFile) {
      await enrollFilesToSubject([avatarFile]);
      return;
    }

    try {
      const resp = await fetch(previewUrl);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const blob = await resp.blob();
      const name = `avatar-${Date.now()}.png`;
      const file = new File([blob], name, { type: blob.type || 'image/png' });
      await enrollFilesToSubject([file]);
    } catch (e) {
      console.error('Failed to fetch avatar from previewUrl', e);
      setEnrollMessage('Не удалось получить аватар для загрузки. Попробуйте выбрать файл вручную.');
    }
  };

  // handlers used in JSX
  const onEditClick = () => setEditing(true);
  const onSaveEdit = async () => { await handleSave(); };
  const onCancelEdit = () => handleCancelEdit();
  const onLogout = handleLogout;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Hero секция */}
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-blue-900 to-indigo-900 text-white shadow-lg mb-8">
          <div className="absolute inset-0 bg-[url('/profile-hero-pattern.png')] bg-cover opacity-10 pointer-events-none" />
          <div className="relative z-10 px-6 py-8 md:py-12">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-36 h-36 md:w-48 md:h-48 rounded-xl overflow-hidden bg-white/10 border-2 border-white/20">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt="avatar" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/70">
                      <FaUser className="text-4xl" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 min-w-0 text-left">
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">
                  {isOwnProfile ? 'Ваш профиль' : `Профиль: ${routeUsername}`}
                </h1>
                <p className="mt-2 text-blue-200">
                  {isOwnProfile ? (authUser?.username ?? '') : ''}
                  {isOwnProfile && <span className="mx-2">·</span>}
                  {isOwnProfile ? <span className="text-sm">{authUser?.email ?? ''}</span> : null}
                </p>

                <div className="mt-6 flex gap-3 flex-wrap items-center">
                  {isOwnProfile && !editing && (
                    <button
                      onClick={onEditClick}
                      className="bg-white text-blue-900 font-bold py-2 px-6 rounded-lg transition duration-300 hover:opacity-95"
                    >
                      Редактировать профиль
                    </button>
                  )}

                  {isOwnProfile && editing && (
                    <>
                      <button
                        onClick={onSaveEdit}
                        className="bg-emerald-500 text-white font-bold py-2 px-6 rounded-lg transition duration-300 hover:bg-emerald-600"
                      >
                        Сохранить
                      </button>
                      <button
                        onClick={onCancelEdit}
                        className="bg-transparent border-2 border-white text-white font-bold py-2 px-6 rounded-lg transition duration-300 hover:bg-white hover:text-blue-900"
                      >
                        Отменить
                      </button>
                    </>
                  )}

                  {isOwnProfile && !editing && (
                    <button
                      onClick={onLogout}
                      className="bg-transparent border-2 border-white text-white font-bold py-2 px-6 rounded-lg transition duration-300 hover:bg-white hover:text-blue-900"
                    >
                      Выйти
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 md:mt-0">
                <div className="bg-white/10 px-6 py-4 rounded-lg text-center border border-white/20">
                  <div className="text-sm text-blue-200">Снимков в архиве</div>
                  <div className="text-3xl font-bold">{stats.totalSnapshots}</div>
                  <div className="text-xs text-blue-200 mt-2">
                    Последний: <span className="block">{stats.lastSnapshot}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Основной контент */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6 lg:col-span-1">
            {/* Блок статистики */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Статистика</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Снимков</div>
                  <div className="text-xl font-bold text-blue-900">{stats.totalSnapshots}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Общий размер</div>
                  <div className="text-xl font-bold text-blue-900">{stats.totalSizeMb.toFixed(2)} MB</div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {isOwnProfile && editing && (
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Настройки профиля</h3>
                <ProfileEditForm
                  id="profile-edit-form"
                  usernameInput={usernameInput}
                  name={name}
                  saving={saving}
                  message={message}
                  onUsernameChange={setUsernameInput}
                  onNameChange={setName}
                  onFileChange={handleFileChange}
                  onCancel={handleCancelEdit}
                  onSave={handleSave}
                />
              </div>
            )}

            {isOwnProfile && (
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <EnrollPanel
                  subjectName={subjectName}
                  filesToEnroll={filesToEnroll}
                  enrollLoading={enrollLoading}
                  enrollMessage={enrollMessage}
                  onSubjectChange={setSubjectName}
                  onFilesChange={handleFilesToEnrollChange}
                  onEnroll={() => enrollFilesToSubject(filesToEnroll)}
                  onEnrollAvatar={enrollCurrentAvatar}
                  onRefreshArchives={refreshArchives}
                />
              </div>
            )}

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <Gallery archives={archives} loading={loadingArchives} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
