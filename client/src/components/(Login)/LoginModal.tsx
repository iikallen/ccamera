'use client';

import React, { useEffect, useState } from 'react';
import LoginForm from './LoginForm';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const LoginModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [isLoginMode, setIsLoginMode] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoginMode(true);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSuccess = () => onClose();
  const toggleMode = () => setIsLoginMode((s) => !s);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-label={isLoginMode ? 'Вход в аккаунт' : 'Регистрация'}
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-4xl mx-auto rounded-3xl shadow-2xl transform transition-all duration-300 ease-out
                   bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden"
        style={{ zIndex: 60 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 z-10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-full p-1"
        >
          ✕
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div
            className="p-8 md:p-12 lg:p-16 flex flex-col justify-center gap-6
                       bg-gradient-to-br from-blue-900 to-indigo-900 text-white"
          >
            <div className="max-w-md">
              <h3 className="text-2xl md:text-3xl font-extrabold leading-tight mb-2">
                Добро пожаловать в систему видеонаблюдения
              </h3>
              <p className="text-sm md:text-base text-blue-100/90 mb-4">
                {isLoginMode
                  ? 'Войдите, чтобы управлять камерами и просматривать архив.'
                  : 'Создайте аккаунт и получите доступ к системе видеонаблюдения.'}
              </p>

              <ul className="space-y-3 mt-4">
                <li className="flex items-start gap-3">
                  <span className="inline-block w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold">✓</span>
                  <span className="text-sm text-blue-100/90">Прямые трансляции и архив</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-block w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold">✓</span>
                  <span className="text-sm text-blue-100/90">Защищённые сессии и роли</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="inline-block w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold">✓</span>
                  <span className="text-sm text-blue-100/90">Доступ с любых устройств</span>
                </li>
              </ul>
            </div>

            <div className="mt-4 text-xs text-blue-100/70 max-w-sm">
              Нажимая кнопку, вы соглашаетесь с нашими правилами использования и политикой конфиденциальности.
            </div>
          </div>

          <div className="p-6 md:p-10 lg:p-12 flex items-center justify-center">
            <div className="w-full max-w-md">
              <div className="mb-4 text-center">
                <h4 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  {isLoginMode ? 'Вход' : 'Регистрация'}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isLoginMode
                    ? 'Используйте email и пароль для доступа к учётной записи'
                    : 'Заполните email и пароль, чтобы создать аккаунт'}
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm">
                <LoginForm
                  isLoginMode={isLoginMode}
                  toggleMode={toggleMode}
                  onSuccess={handleSuccess}
                />
              </div>

              <div className="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">
                Если у вас нет аккаунта — зарегистрируйтесь. Для вопросов — <button className="underline">связаться с поддержкой</button>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;