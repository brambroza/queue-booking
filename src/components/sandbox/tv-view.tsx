'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Box, Skeleton } from '@mui/material';
import type { BusinessScenario } from '@/lib/demo/scenarios/types';
import { buildSandboxSignageData, sandboxSignageConfig } from '@/lib/demo/sandbox-sim/signage-data';
import type { SimState } from '@/lib/demo/sandbox-sim/types';

// The board pulls in six scene templates and GSAP: load it only when the TV is on screen.
const SignageBoard = dynamic(() => import('@/components/signage/signage-board').then((m) => m.SignageBoard), {
  ssr: false,
  loading: () => <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0 }} />,
});

/**
 * The shop's queue TV: the real `SignageBoard` fed with `SignageData` built from
 * the live sandbox state through the production `buildSignageData`.
 *
 * @param scenario - Business scenario (template and theme come from it).
 * @param state - Sandbox state.
 */
export function TvView({ scenario, state }: { scenario: BusinessScenario; state: SimState }) {
  const config = useMemo(() => sandboxSignageConfig(scenario), [scenario]);
  const data = useMemo(() => buildSandboxSignageData(scenario, state.queues, state.today), [scenario, state.queues, state.today]);
  return (
    <Box>
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 2, overflow: 'hidden', bgcolor: '#000' }}>
        <SignageBoard data={data} config={config} mode="preview" />
      </Box>
    </Box>
  );
}
