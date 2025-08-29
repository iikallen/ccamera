'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { store } from '@/providers/StoreProvider';

export default function ProfileIndex() {
  const router = useRouter();

  useEffect(() => {
    const user = store.user;
    const candidate =
      (user?.username && String(user.username).trim()) ||
      (user?.email && String(user.email).split('@')[0].trim()) ||
      String((user as any).id ?? (user as any)._id ?? '').trim();

    if (candidate && candidate.length) {
      router.replace(`/profile/${encodeURIComponent(candidate)}`);
    } else {
      router.replace('/'); // или /login
    }
  }, [router]);

  return null;
}
