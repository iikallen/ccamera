// src/components/(Header)/NotificationCenter.tsx
'use client';

import React from 'react';
import {
  BellIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

export interface Notification {
  id: number;
  title: string;
  description: string;
  level: 'high' | 'medium' | 'low';
  time: string;
}

interface NotificationCenterProps {
  notifications?: Notification[]; // теперь опционально
  onClose?: () => void;           // опционально — Header передаёт onClose
}

const getIcon = (level: Notification['level']) => {
  switch (level) {
    case 'high':
      return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
    case 'medium':
      return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
    default:
      return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
  }
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications = [], // по умолчанию пустой массив
  onClose,
}) => {
  // небольшой набор заглушек (если нужно показать пример)
  const defaultNotifs: Notification[] = [
    // пустой по умолчанию — можно раскомментировать пример ниже
    // { id: 1, title: 'Сервер обновлён', description: 'Рестарт завершён', level: 'low', time: '5 мин назад' },
  ];

  const items = notifications.length > 0 ? notifications : defaultNotifs;

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden z-50 border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <BellIcon className="h-5 w-5 mr-2" />
          Уведомления
        </h3>

        <div className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
            {items.length}
          </span>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Закрыть уведомления"
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded p-1"
              title="Закрыть"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {items.length > 0 ? (
          items.map((notification) => (
            <div key={notification.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  {getIcon(notification.level)}
                </div>
                <div className="ml-3 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {notification.description}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {notification.time}
                  </p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Нет новых уведомлений
          </div>
        )}
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex justify-center">
        <button
          onClick={() => {
            // можно добавить переход на страницу всех уведомлений
            if (onClose) onClose();
          }}
          className="text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Показать все
        </button>
      </div>
    </div>
  );
};

export default NotificationCenter;
