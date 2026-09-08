'use client';

import { useState } from 'react';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { Button, Chip, ListItemText, Menu, MenuItem } from '@mui/material';
import { useBranchScope } from '@/components/layout/branch-scope-provider';

/**
 * Topbar branch selector.
 *
 * Hidden when there is nothing to choose — a single-branch shop, or a manager bound
 * to exactly one branch, where a dropdown would only add noise.
 */
export function BranchSwitch() {
  const { loading, scope, branches, branchId, setBranchId } = useBranchScope();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  if (loading || branches.length < 2) {
    // One fixed branch: show it as a label so the user knows what they are looking at.
    if (!loading && scope === 'branch' && branches.length === 1) {
      return (
        <Chip
          size="small"
          icon={<StorefrontRoundedIcon sx={{ fontSize: 16 }} />}
          label={branches[0].branch_name}
          sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 700 }}
        />
      );
    }
    return null;
  }

  const allLabel = scope === 'shop' ? 'ทุกสาขา' : 'ทุกสาขาของฉัน';
  const current = branches.find((b) => b.id === branchId);

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<StorefrontRoundedIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        sx={{ borderRadius: 999, textTransform: 'none', whiteSpace: 'nowrap', maxWidth: 200 }}
      >
        {current?.branch_name ?? allLabel}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          selected={!branchId}
          onClick={() => {
            setBranchId('');
            setAnchorEl(null);
          }}
        >
          <ListItemText primary={allLabel} />
        </MenuItem>
        {branches.map((b) => (
          <MenuItem
            key={b.id}
            selected={b.id === branchId}
            onClick={() => {
              setBranchId(b.id);
              setAnchorEl(null);
            }}
          >
            <ListItemText primary={b.branch_name} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
