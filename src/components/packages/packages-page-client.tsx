'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Stack } from '@mui/material';
import { PackageTemplatesCard, type PackageTemplate } from './package-templates-card';
import { CustomerPackagesCard } from './customer-packages-card';
import { LiffPackagesVisibilityCard } from './liff-packages-visibility-card';

/** `/portal/packages`: templates the shop sells + packages its customers hold. `?id=` opens one package. */
export function PackagesPageClient() {
  const [templates, setTemplates] = useState<PackageTemplate[]>([]);
  const searchParams = useSearchParams();
  return (
    <Stack spacing={2}>
      <CustomerPackagesCard templates={templates} initialId={searchParams.get('id')} />
      <PackageTemplatesCard onChanged={setTemplates} />
      <LiffPackagesVisibilityCard />
    </Stack>
  );
}
