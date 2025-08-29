'use client';

import React from 'react';

type Props = {
  subjectName: string;
  filesToEnroll: File[];
  enrollLoading: boolean;
  enrollMessage: string;
  onSubjectChange: (v: string) => void;
  onFilesChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnroll: () => void;
  onEnrollAvatar: () => void;
  onRefreshArchives: () => void;
};

export default function EnrollPanel({
  subjectName,
  filesToEnroll,
  enrollLoading,
  enrollMessage,
  onSubjectChange,
  onFilesChange,
  onEnroll,
  onEnrollAvatar,
  onRefreshArchives
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Добавить снимки в базу</h3>
        <p className="text-gray-600">Выберите subject (обычно username) и загрузите файлы.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
          <input
            value={subjectName}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full px-4 py-3 border text-gray-700 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Выбрать файлы</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={onFilesChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>
      </div>

      {filesToEnroll.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-700 mb-2">Выбрано файлов: {filesToEnroll.length}</p>
          <div className="flex flex-wrap gap-2 ">
            {filesToEnroll.slice(0, 3).map((f, i) => (
              <span key={i} className="bg-white px-3 py-1 rounded-full text-xs font-medium text-blue-700">
                {f.name}
              </span>
            ))}
            {filesToEnroll.length > 3 && (
              <span className="bg-white px-3 py-1 rounded-full text-xs font-medium text-blue-700">
                +{filesToEnroll.length - 3} еще
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          onClick={onEnroll}
          disabled={enrollLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-300 disabled:opacity-50"
        >
          {enrollLoading ? 'Загрузка...' : `Добавить ${filesToEnroll.length > 0 ? `(${filesToEnroll.length})` : ''}`}
        </button>

        <button
          onClick={onEnrollAvatar}
          disabled={enrollLoading}
          className="bg-transparent border-2 border-blue-600 text-blue-600 font-bold py-3 px-6 rounded-lg transition duration-300 hover:bg-blue-600 hover:text-white disabled:opacity-50"
        >
          Добавить текущий аватар
        </button>

        <button
          onClick={onRefreshArchives}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-6 rounded-lg transition duration-300"
        >
          Обновить архивы
        </button>
      </div>

      {enrollMessage && (
        <div className={`p-3 rounded-lg ${enrollMessage.toLowerCase().includes('ошибка') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {enrollMessage}
        </div>
      )}
    </div>
  );
}