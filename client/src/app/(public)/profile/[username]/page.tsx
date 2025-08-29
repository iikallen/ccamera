import React from 'react';
import ProfileClient from '@/components/(Profile)/ProfileClient';

type PageProps = {
  params: { username: string } | Promise<{ username: string }>;
};

export default async function Page({ params }: PageProps) {
  const { username } = await params;
  return <ProfileClient username={username} />;
}
