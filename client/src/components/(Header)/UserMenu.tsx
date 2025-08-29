'use client';

import React, { useState } from 'react';
import type { IUser } from '@/models/IUser';
import { useRouter } from 'next/navigation';

type Props = {
  user: IUser | null | undefined;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
};

export default function UserMenu({ user, onClose, onLogout }: Props) {
  const router = useRouter();
  const [showHint, setShowHint] = useState(false);

  const candidate =
    (user?.username && String(user.username).trim()) ||
    (user?.email && String(user.email).split('@')[0].trim()) ||
    String((user as any)?.id ?? (user as any)?._id ?? '').trim();
  const username = candidate && candidate.length ? candidate : 'me';

  const handleGoProfile = () => {
    onClose();
    router.push(`/profile/${encodeURIComponent(username)}`);
  };

  const handleGoFamilyPage = () => {
    onClose();
    router.push(`/profile/${encodeURIComponent(username)}/family`);
  };

  const handleLogoutClick = async () => {
    onClose();
    try {
      await Promise.resolve(onLogout());
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      try { router.push('/'); } catch {}
    }
  };

  return (
    <div className="w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 p-3">
      <div className="flex items-center gap-3 p-2 border-b border-gray-100 dark:border-gray-700">
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm text-gray-500">
            {user?.email?.[0]?.toUpperCase() ?? 'U'}
          </div>
        )}
        <div className="text-sm">
          <div className="font-medium text-gray-800 dark:text-gray-100">{user?.username ?? user?.email ?? 'Пользователь'}</div>
          {user?.role && <div className="text-xs text-gray-500 dark:text-gray-400">{user.role}</div>}
        </div>
      </div>

      <div className="mt-2">
        <button onClick={handleGoProfile} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
          Профиль
        </button>

        <button onClick={handleGoFamilyPage} className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
          Страница семьи
        </button>

        <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                // если нет отдельного FamilyPanel, переключаем подсказку и предлагаем открыть страницу семьи
                setShowHint((s) => !s);
              }}
              className="flex-1 text-left px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
            >
              Члены семьи
            </button>

            <button onClick={handleLogoutClick} className="text-left px-3 py-2 rounded hover:bg-red-50 dark:hover:bg-red-900 text-sm text-red-600">
              Выйти
            </button>
          </div>
        </div>

        {showHint && (
          <div className="mt-3 text-sm text-gray-700 dark:text-gray-200">
            <div className="mb-2">Компактная панель семьи недоступна (файл <code>FamilyPanel</code> отсутствует).</div>
            <button
              onClick={handleGoFamilyPage}
              className="px-3 py-2 bg-sky-600 text-white rounded text-sm"
            >
              Открыть страницу семьи
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
