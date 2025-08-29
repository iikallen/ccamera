'use client';

import React from 'react';
import type { IUser } from '@/models/IUser';

type Props = {
  id?: string;
  usernameInput: string;
  name: string;
  saving: boolean;
  message: string;
  onUsernameChange: (v: string) => void;
  onNameChange: (v: string) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
  onSave: (e?: React.FormEvent) => Promise<void> | void;
  showActions?: boolean; // если false — кнопки сохранять/отменить не рендерятся внутри формы
};

export default function ProfileEditForm({
  id,
  usernameInput,
  name,
  saving,
  message,
  onUsernameChange,
  onNameChange,
  onFileChange,
  onCancel,
  onSave,
  showActions = true
}: Props) {
  return (
    <form onSubmit={onSave} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            id="username"
            value={usernameInput}
            onChange={(e) => onUsernameChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Введите username"
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Имя
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Введите ваше имя"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Аватар</label>
        <input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {message && (
        <div className={`p-3 rounded-lg ${message.includes('успеш') ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}
    </form>
  );
}