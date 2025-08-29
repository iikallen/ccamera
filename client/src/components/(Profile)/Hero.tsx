'use client';

import React from 'react';
import type { IUser } from '@/models/IUser';

type Stats = {
  totalSnapshots: number;
  lastSnapshot: string;
  totalSizeMb: number;
};

type Props = {
  previewUrl: string;
  isOwnProfile: boolean;
  routeUsername: string;
  authUser: IUser | null;
  stats: Stats;
  onEditClick: () => void;
  onLogout: () => void;
  editing?: boolean;
  onSaveEdit?: (e?: React.FormEvent) => Promise<void> | void;
  onCancelEdit?: () => void;
};

export default function Hero({
  previewUrl,
  isOwnProfile,
  routeUsername,
  authUser,
  stats,
  onEditClick,
  onLogout,
  editing = false,
  onSaveEdit,
  onCancelEdit
}: Props) {
  return (
    <div className="relative rounded-xl overflow-hidden bg-gradient-to-r from-sky-700 to-indigo-700 text-white shadow-lg">
      <div className="absolute inset-0 bg-[url('/profile-hero-pattern.png')] bg-cover opacity-10 pointer-events-none" />
      <div className="relative z-10 px-6 py-8 md:py-12">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            <div className="w-36 h-36 md:w-48 md:h-48 rounded-xl overflow-hidden bg-white/10 border border-white/20">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="avatar" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/70">Нет аватара</div>
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 text-left">
            <h1 className="text-2xl md:text-3xl font-semibold leading-tight">
              {(isOwnProfile ? 'Ваш профиль' : `Профиль: ${routeUsername}`)}
            </h1>
            <p className="mt-1 text-sm md:text-base text-white/90">
              {isOwnProfile ? (authUser?.username ?? '') : ''}
              {isOwnProfile && <span className="mx-2">·</span>}
              {isOwnProfile ? <span className="text-sm text-white/80">{authUser?.email ?? ''}</span> : null}
            </p>

            <div className="mt-4 flex gap-3 flex-wrap items-center">
              {isOwnProfile && !editing && (
                <button
                  onClick={onEditClick}
                  className="px-4 py-2 bg-white text-sky-700 font-medium rounded-md shadow-sm hover:opacity-95"
                >
                  Редактировать профиль
                </button>
              )}

              {isOwnProfile && editing && (
                <>
                  <button
                    onClick={onSaveEdit}
                    className="px-4 py-2 bg-emerald-600 text-white font-medium rounded-md shadow-sm hover:opacity-95"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="px-4 py-2 bg-white/10 text-white rounded-md border border-white/20 hover:bg-white/5"
                  >
                    Отменить
                  </button>
                </>
              )}

              {isOwnProfile && !editing && (
                <button
                  onClick={onLogout}
                  className="px-4 py-2 bg-white/10 border border-white/20 text-white rounded-md hover:bg-white/5"
                >
                  Выйти
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 md:mt-0">
            <div className="bg-white/10 px-4 py-3 rounded-md text-right">
              <div className="text-xs text-white/70">Снимков в архиве</div>
              <div className="text-2xl font-semibold">{stats.totalSnapshots}</div>
              <div className="text-xs text-white/70 mt-1">Последний: <span className="block text-xs">{stats.lastSnapshot}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
