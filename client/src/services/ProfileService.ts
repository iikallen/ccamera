import axios, { AxiosResponse } from 'axios';
import { API_URL } from '@/http'; 
import { IUser } from '@/models/IUser';
import $api from '@/http';

const BASE = API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000/api';

export default class ProfileService {
  static async getMe(): Promise<AxiosResponse<IUser>> {
    return $api.get<IUser>('/me');
  }

  static async updateProfile(formData: FormData): Promise<AxiosResponse<IUser>> {
    return $api.patch<IUser>('/me', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }
}

