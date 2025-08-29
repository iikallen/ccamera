'use client';

import React, { FC, useContext, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Context } from '@/providers/StoreProvider';

type Props = {
  isLoginMode: boolean;
  toggleMode: () => void;
  onSuccess?: () => void;
};

const LoginForm: FC<Props> = ({ isLoginMode, toggleMode, onSuccess }) => {
  const ctx = useContext(Context as unknown as React.Context<{ store: any } | null>);
  const store = ctx?.store;

  const [fatalError] = useState<string | null>(() => {
    if (!store) return 'Внутренняя ошибка: store не найден. Убедитесь, что StoreProvider оборачивает приложение.';
    return null;
  });

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const validate = () => {
    const e: typeof errors = {};
    if (!email) e.email = 'Email обязателен';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Некорректный email';

    if (!password) e.password = 'Пароль обязателен';
    else if (password.length < 6) e.password = 'Пароль должен быть не менее 6 символов';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!store) {
      setErrors((s) => ({ ...s, general: 'Ошибка приложения. Попробуйте перезагрузить страницу.' }));
      return;
    }

    setErrors({});
    if (!validate()) return;

    setIsSubmitting(true);
    setErrors((s) => ({ ...s, general: undefined }));

    try {
      if (isLoginMode) {
        await store.login(email, password);
      } else {
        await store.registration(email, password);
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      const msg = err?.message ?? (err?.toString ? err.toString() : 'Ошибка сети');
      setErrors((s) => ({ ...s, general: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (fatalError) {
    return (
      <div className="p-4 text-sm text-red-600">
        {fatalError}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="space-y-4">
        {/* Email */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Email</span>
          <input
            aria-label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            className="mt-2 block w-full px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            placeholder="you@example.com"
          />
          {errors.email && <div className="mt-1 text-xs text-red-600">{errors.email}</div>}
        </label>

        {/* Password */}
        <label className="block">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Пароль</span>
            {/* перенесённая подсказка — пустая, реальна кнопка ниже */}
          </div>

          <div className="relative mt-2">
            <input
              aria-label="Пароль"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="block w-full px-4 py-3 pr-20 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              placeholder="Введите пароль"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              tabIndex={0}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
              aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
            >
              {showPassword ? 'Скрыть' : 'Показать'}
            </button>
          </div>
          {errors.password && <div className="mt-1 text-xs text-red-600">{errors.password}</div>}

          {/* Забыли пароль под полем */}
          <div className="mt-2 text-right">
            <button
              type="button"
              onClick={() => alert('Функция восстановления пароля пока не реализована')}
              className="text-sm text-blue-600 hover:underline dark:text-blue-300"
            >
              Забыли пароль?
            </button>
          </div>
        </label>

        {/* General error */}
        {errors.general && <div className="text-sm text-red-600">{errors.general}</div>}

        {/* Actions: основная кнопка + стильная плашка-переключатель */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className={`w-full sm:flex-1 inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-white transition shadow-sm ${
              isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (isLoginMode ? 'Вход...' : 'Регистрация...') : (isLoginMode ? 'Войти' : 'Регистрация')}
          </button>

          {/* Красивая плашка-переключатель режима */}
          <button
            onClick={() => { toggleMode(); setErrors({}); }}
            disabled={isSubmitting}
            className="w-full sm:w-48 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:shadow-sm transition"
            title={isLoginMode ? 'Создать новый аккаунт' : 'Перейти к входу'}
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 dark:bg-white/5 text-blue-600 dark:text-blue-300 text-xs font-semibold">
              {isLoginMode ? '+' : '↩'}
            </span>
            <span className="text-sm">
              {isLoginMode ? 'Создать аккаунт' : 'Войти в аккаунт'}
            </span>
          </button>
        </div>

        {/* Helpers */}
        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mt-2">
          <div className="text-xs">
            <span>Мы обеспечиваем безопасность ваших данных</span>
          </div>

          <div className="text-xs">
            <span className="text-gray-400">•</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default observer(LoginForm);