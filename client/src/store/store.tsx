// client/src/store/store.tsx
import { IUser } from "../models/IUser";
import { makeAutoObservable } from "mobx";
import AuthService from "../services/AuthService";
import $api from "../http";
import ProfileService from '@/services/ProfileService';
import { AuthResponse } from "../models/response/AuthResponse";
import type { AxiosError } from 'axios';

export default class Store {
  user = {} as IUser;
  isAuth = false;
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  setAuth(bool: boolean) {
    this.isAuth = bool;
  }

  setUser(user: IUser) {
    this.user = user;
  }

  setLoading(bool: boolean) {
    this.isLoading = bool;
  }

  private normalizeUser(data: any): IUser {
    return {
      id: String(data?.id ?? data?._id ?? ""),
      email: String(data?.email ?? ""),
      username: String(data?.username ?? data?.name ?? ""),
      avatar: data?.avatar ?? "",
      role: data?.role ?? "",
      isActivated: Boolean(data?.isActivated),
      guest: Boolean(data?.guest ?? false),
    } as IUser;
  }

  async login(email: string, password: string): Promise<void> {
    try {
      const response = await AuthService.login(email, password);
      const token = response.data.accessToken;

      if (token) {
        try { localStorage.setItem('token', token); } catch {}
        $api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const user = response.data.user as IUser;
      const normalized = this.normalizeUser(user);
      this.setAuth(!normalized.guest);
      this.setUser(normalized);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError | undefined;
      const msg = (axiosErr?.response?.data as any)?.message ?? axiosErr?.message ?? String(err);
      console.error('login error:', msg);
      throw err;
    }
  }

  async registration(email: string, password: string): Promise<void> {
    try {
      const response = await AuthService.registration(email, password);
      const token = response.data.accessToken;

      if (token) {
        try { localStorage.setItem('token', token); } catch {}
        $api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }

      const user = response.data.user as IUser;
      const normalized = this.normalizeUser(user);
      this.setAuth(!normalized.guest);
      this.setUser(normalized);
    } catch (err: unknown) {
      const axiosErr = err as AxiosError | undefined;
      const serverMsg = (axiosErr?.response?.data as any)?.message ?? JSON.stringify((axiosErr?.response?.data as any) ?? {}) ?? axiosErr?.message ?? String(err);
      console.log("registration axios error:", serverMsg);
      throw err;
    }
  }

  async logout(): Promise<void> {
    try {
      await AuthService.logout();
      try { localStorage.removeItem("token"); } catch {}
      try { localStorage.removeItem("refreshToken"); } catch {}
      delete $api.defaults.headers.common['Authorization'];
      this.setAuth(false);
      this.setUser({} as IUser);

      // Попытка получить гостевой профиль (если сервер на logout поставил guest refresh cookie)
      try {
        const resp = await $api.get<AuthResponse>('/refresh'); // относительный — через proxy, отправит cookie
        if (resp?.data?.user) {
          const normalized = this.normalizeUser(resp.data.user as IUser);
          this.setUser(normalized);
          this.setAuth(!normalized.guest);
          if (resp.data.accessToken) {
            try { localStorage.setItem('token', resp.data.accessToken); } catch {}
            $api.defaults.headers.common['Authorization'] = `Bearer ${resp.data.accessToken}`;
          }
        }
      } catch (e) {
        // ignore
      }
    } catch (err: unknown) {
      const axiosErr = err as AxiosError | undefined;
      const serverMsg = (axiosErr?.response?.data as any)?.message ?? axiosErr?.message ?? String(err);
      console.log("logout axios error:", serverMsg);
      throw err;
    }
  }

  async checkAuth(): Promise<void> {
    this.setLoading(true);
    try {
      // 0) Быстрая проверка локального токена — если есть, используем его и валидируем через /me
      try {
        if (typeof window !== 'undefined') {
          const localToken = localStorage.getItem('token');
          if (localToken) {
            // установим заголовок и попытаемся получить профиль
            $api.defaults.headers.common['Authorization'] = `Bearer ${localToken}`;
            try {
              const meResp = await $api.get<IUser>('/me');
              const user = meResp.data;
              const normalized = this.normalizeUser(user);
              this.setAuth(!normalized.guest);
              this.setUser(normalized);
              return; // успешно — выходим
            } catch (meErr) {
              // невалидный local token — удалим и продолжим cookie-refresh flow
              try { localStorage.removeItem('token'); } catch {}
              try { delete $api.defaults.headers.common['Authorization']; } catch {}
            }
          }
        }
      } catch (e) {
        // ignore localStorage errors
      }

      // 1) Попытка cookie refresh через относительный $api (через next proxy => same-origin)
      try {
        const resp = await $api.get<AuthResponse>('/refresh'); // withCredentials уже стоит в $api
        const token = resp.data.accessToken;
        if (token) {
          try { localStorage.setItem('token', token); } catch {}
          $api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        const user = resp.data.user as IUser;
        const normalized = this.normalizeUser(user);
        this.setAuth(!normalized.guest);
        this.setUser(normalized);
        return;
      } catch (errCookie) {
        // cookie refresh не удался — создаём гостя
      }

      // 2) Создать гостевой токен (через /api/guest)
      try {
        const guestResp = await $api.post<AuthResponse>('/guest', {});
        const token = guestResp.data.accessToken;
        if (token) {
          try { localStorage.setItem('token', token); } catch {}
          $api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        const user = guestResp.data.user as IUser;
        const normalized = this.normalizeUser(user);
        this.setAuth(!normalized.guest);
        this.setUser(normalized);
        return;
      } catch (e) {
        // если и это не получилось — оставляем анонимным
      }

      // fallback — не авторизован
      try { localStorage.removeItem('token'); } catch {}
      try { localStorage.removeItem('refreshToken'); } catch {}
      delete $api.defaults.headers.common['Authorization'];
      this.setAuth(false);
      this.setUser({} as IUser);
    } catch (e) {
      console.error('checkAuth unknown error', e);
      try { localStorage.removeItem('token'); } catch {}
      try { localStorage.removeItem('refreshToken'); } catch {}
      delete $api.defaults.headers.common['Authorization'];
      this.setAuth(false);
      this.setUser({} as IUser);
    } finally {
      this.setLoading(false);
    }
  }

  async updateProfile(data: { name?: string; avatarFile?: File } | FormData) {
    try {
      this.setLoading(true);

      let fd: FormData;
      if (data instanceof FormData) {
        fd = data;
      } else {
        fd = new FormData();
        if (data.name !== undefined) fd.append('name', data.name);
        if (data.avatarFile) fd.append('avatar', data.avatarFile);
      }

      const response = await ProfileService.updateProfile(fd);
      const returned = response.data;
      const normalized = this.normalizeUser(returned);
      this.setUser(normalized);

      return returned;
    } catch (err: any) {
      if (err && err.isAxiosError) {
        console.error('updateProfile axios error', {
          status: err.response?.status,
          data: err.response?.data,
          message: err.message,
        });
        const serverMsg = (err.response?.data as any)?.message ?? JSON.stringify(err.response?.data ?? {}) ?? err.message;
        throw new Error(String(serverMsg));
      } else {
        console.error('updateProfile unknown error', err);
        throw err;
      }
    } finally {
      this.setLoading(false);
    }
  }
}
