import React from 'react';
import FamilyPageClient from '@/components/(Profile)/FamilyPageClient';

type PageProps = { params: { username: string } };

export default async function Page({ params }: PageProps) {
  // await to satisfy Next routing requirements where needed
  const username = await params?.username ?? '';
  return <FamilyPageClient username={username} />;
}
