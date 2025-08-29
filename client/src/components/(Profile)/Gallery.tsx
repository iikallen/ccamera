'use client';

import React, { useState } from 'react';
import type { ArchiveItem } from '@/components/(Profile)/ProfileClient';
import $api from '@/http';
import { FaSpinner, FaImage } from 'react-icons/fa';

type Props = {
  archives: ArchiveItem[];
  loading: boolean;
  onDelete?: (filename: string) => Promise<void> | void;
  allowServerDelete?: boolean;
};

const PLACEHOLDER = '/images/image-missing.png';
const BACKEND = typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_BACKEND_URL
  ? String(process.env.NEXT_PUBLIC_BACKEND_URL).replace(/\/$/, '')
  : 'http://localhost:5000';

export default function Gallery({
  archives,
  loading,
  onDelete,
  allowServerDelete = false,
}: Props) {
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // фильтрация: убираем аватары (пути содержащие /uploads/avatars/)
  const filtered = archives.filter((it) => {
    try {
      const u = String(it.url || '');
      if (!u) return false;
      if (u.includes('/uploads/avatars/')) return false;
      return true;
    } catch {
      return false;
    }
  });

  const resolveSrc = (url?: string) => {
    if (!url) return PLACEHOLDER;
    const s = String(url);
    if (s.startsWith('/static/')) {
      // подставляем backend для относительных static путей
      return `${BACKEND}${s}`;
    }
    // если уже абсолютный (http/https) — вернуть как есть
    return s;
  };

  const handleImgError = (ev: React.SyntheticEvent<HTMLImageElement>) => {
    const img = ev.currentTarget;
    if ((img as any).dataset?.fallback === '1') return;
    (img as any).dataset = { ...(img as any).dataset, fallback: '1' };
    img.src = PLACEHOLDER;
  };

  const handleDelete = async (filename: string) => {
    if (!confirm('Удалить этот снимок из архива?')) return;
    if (deleting[filename]) return;
    setDeleting((s) => ({ ...s, [filename]: true }));

    try {
      if (allowServerDelete) {
        await $api.delete('/compreface/archive', { params: { filename } });
      }
      if (onDelete) {
        await onDelete(filename);
      }
    } catch (e) {
      console.error('Gallery delete error', e);
      alert('Ошибка при удалении. Посмотрите консоль.');
    } finally {
      setDeleting((s) => {
        const copy = { ...s };
        delete copy[filename];
        return copy;
      });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-800">Галерея снимков</h3>
        <span className="text-sm text-gray-600">
          {loading ? 'Загрузка...' : `${filtered.length} снимков`}
        </span>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">
          <FaSpinner className="animate-spin text-2xl mx-auto mb-2" />
          <p>Загрузка снимков...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <FaImage className="text-2xl mx-auto mb-2" />
          <p>Снимков не найдено.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((it) => {
            const src = resolveSrc(it.url);
            const href = src;

            return (
              <div
                key={`${it.filename}-${it.createdAt}-${it.hash ?? ''}`}
                className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200 transition duration-300 hover:shadow-md"
              >
                <a href={href} target="_blank" rel="noreferrer" className="block w-full h-40 overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={it.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={handleImgError}
                  />
                </a>

                <div className="p-3">
                  <div className="text-sm font-medium text-gray-900 truncate">{it.filename}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(it.createdAt).toLocaleString()}
                  </div>
                </div>

                {(allowServerDelete || onDelete) && (
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => handleDelete(it.filename)}
                      disabled={!!deleting[it.filename]}
                      className="w-full bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium py-2 rounded transition duration-300 disabled:opacity-50"
                    >
                      {deleting[it.filename] ? 'Удаление...' : 'Удалить'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
