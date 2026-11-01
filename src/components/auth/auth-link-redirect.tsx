'use client';

import { useEffect } from 'react';
import { ACCEPT_INVITE_PATH, parseInviteLink } from '@/lib/auth/invite-link';

/**
 * Supabase sends an emailed link to the project's Site URL when the redirect target
 * is not on its allow list, which also covers invites already sitting in inboxes.
 * Forward those to the password page instead of stranding them on the landing page.
 */
export function AuthLinkRedirect() {
  useEffect(() => {
    if (window.location.pathname === ACCEPT_INVITE_PATH) return;
    const { hash } = window.location;
    if (parseInviteLink(hash).kind !== 'none') window.location.replace(`${ACCEPT_INVITE_PATH}${hash}`);
  }, []);

  return null;
}
