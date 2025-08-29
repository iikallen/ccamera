'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { observer } from 'mobx-react-lite';
import {
  BellIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon,
} from '@heroicons/react/24/outline';
import Logo from './Logo';
import NotificationCenter from './NotificationCenter';
import UserMenu from './UserMenu';
import LoginModal from '@/components/(Login)/LoginModal';
import { useAuth } from '@/providers/AuthContext';

const Header: React.FC = () => {
  const { isAuthenticated, user, logout, refreshUser, loading } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    try {
      refreshUser();
    } catch (e) {
      // игнорируем
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setLoginModalOpen(false);
      setUserMenuOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const handleUserButton = () => {
    if (isAuthenticated) {
      setUserMenuOpen((s) => !s);
    } else {
      setLoginModalOpen(true);
    }
    setNotificationsOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error('Logout error', e);
    } finally {
      setUserMenuOpen(false);
      setLoginModalOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md'
          : 'bg-white dark:bg-gray-900'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Logo />
          </div>

          <div className="flex items-center space-x-3">
            {/* Тема */}
            <button
              aria-label="Переключить тему"
              onClick={() => setDarkMode((m) => !m)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5 text-yellow-400" />
              ) : (
                <MoonIcon className="h-5 w-5 text-gray-600" />
              )}
            </button>

            {/* Уведомления показываем ТОЛЬКО если пользователь авторизован */}
            {isAuthenticated && (
              <div className="relative">
                <button
                  aria-label="Уведомления"
                  onClick={() => {
                    setNotificationsOpen((s) => !s);
                    setUserMenuOpen(false);
                  }}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <BellIcon className="h-5 w-5" />
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2">
                    <NotificationCenter onClose={() => setNotificationsOpen(false)} />
                  </div>
                )}
              </div>
            )}

            {/* Кнопка пользователя */}
            <div className="relative">
              <button
                onClick={handleUserButton}
                className="flex items-center max-w-xs rounded-full bg-gray-100 dark:bg-gray-800 text-sm focus:outline-none p-1"
                aria-label="Меню пользователя"
                title={isAuthenticated ? user?.email ?? 'Профиль' : 'Войти'}
                disabled={loading}
              >
                {isAuthenticated ? (
                  <div className="flex items-center gap-2 pr-2">
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt="User Avatar"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 border-2 border-dashed text-xs text-gray-500">
                        {user?.email?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                    )}
                    <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-200">
                      {user?.email ?? 'Профиль'}
                    </span>
                  </div>
                ) : (
                  <UserCircleIcon className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                )}
              </button>

              {isAuthenticated && userMenuOpen && (
                <div className="absolute right-0 mt-2">
                  {/* Передаём только те пропсы, которые ожидает UserMenu */}
                  <UserMenu
                    user={user}
                    onClose={() => setUserMenuOpen(false)}
                    onLogout={handleLogout}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <LoginModal isOpen={loginModalOpen} onClose={() => setLoginModalOpen(false)} />
    </header>
  );
};

export default observer(Header);