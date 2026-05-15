import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationCategory, NotificationItem, NotificationPriority, NotificationType } from '@/types/notification';

type CreateNotificationInput = {
  companyId: string;
  shopId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  type: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  relatedType?: string | null;
  relatedId?: string | null;
  actionUrl?: string | null;
  icon?: string | null;
  color?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
};

function userScopeOrFilter(userId: string) {
  const escaped = userId.replace(/"/g, '\\"');
  return `user_id.eq."${escaped}",user_id.is.null`;
}

function normalize(input: CreateNotificationInput) {
  const title = input.title?.trim();
  const message = input.message?.trim();
  if (!input.companyId) throw new Error('companyId is required');
  if (!input.type?.trim()) throw new Error('type is required');
  if (!title) throw new Error('title is required');
  if (!message) throw new Error('message is required');
  return {
    company_id: input.companyId,
    shop_id: input.shopId ?? null,
    branch_id: input.branchId ?? null,
    user_id: input.userId ?? null,
    type: input.type,
    category: input.category ?? 'system',
    priority: input.priority ?? 'medium',
    title,
    message,
    body: message,
    related_type: input.relatedType ?? null,
    related_id: input.relatedId ?? null,
    action_url: input.actionUrl ?? null,
    icon: input.icon ?? null,
    color: input.color ?? null,
    metadata: input.metadata ?? {},
    created_by: input.createdBy ?? null,
    updated_by: input.createdBy ?? null,
  };
}

export async function createNotification(supabase: SupabaseClient, input: CreateNotificationInput): Promise<NotificationItem> {
  const payload = normalize(input);
  const { data, error } = await supabase
    .from('notifications')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data as NotificationItem;
}

export async function safeCreateNotification(supabase: SupabaseClient, input: CreateNotificationInput): Promise<NotificationItem | null> {
  try {
    return await createNotification(supabase, input);
  } catch (error) {
    console.error('[notification_failed]', error);
    return null;
  }
}

export async function markNotificationAsRead(supabase: SupabaseClient, id: string, updatedBy?: string | null) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString(), updated_by: updatedBy ?? null })
    .eq('id', id)
    .eq('is_deleted', false);
  if (error) throw error;
}

export async function markAllNotificationsAsRead(supabase: SupabaseClient, scope: { companyId: string; shopId?: string | null; userId?: string | null }, updatedBy?: string | null) {
  let q = supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString(), updated_by: updatedBy ?? null })
    .eq('company_id', scope.companyId)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .eq('is_read', false);
  if (scope.shopId) q = q.eq('shop_id', scope.shopId);
  if (scope.userId) q = q.or(userScopeOrFilter(scope.userId));
  const { error } = await q;
  if (error) throw error;
}

export async function archiveNotification(supabase: SupabaseClient, id: string, updatedBy?: string | null) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_archived: true, archived_at: new Date().toISOString(), updated_by: updatedBy ?? null })
    .eq('id', id)
    .eq('is_deleted', false);
  if (error) throw error;
}

export async function getUnreadNotificationCount(supabase: SupabaseClient, scope: { companyId: string; shopId?: string | null; userId?: string | null }) {
  let q = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', scope.companyId)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .eq('is_read', false);
  if (scope.shopId) q = q.eq('shop_id', scope.shopId);
  if (scope.userId) q = q.or(userScopeOrFilter(scope.userId));
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function getNotifications(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    shopId?: string | null;
    userId?: string | null;
    unreadOnly?: boolean;
    category?: NotificationCategory | '';
    priority?: NotificationPriority | '';
    search?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  },
) {
  let q = supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('company_id', input.companyId)
    .eq('is_deleted', false)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false });

  if (!input.includeArchived) q = q.eq('is_archived', false);
  if (input.shopId) q = q.eq('shop_id', input.shopId);
  if (input.userId) q = q.or(userScopeOrFilter(input.userId));
  if (input.unreadOnly) q = q.eq('is_read', false);
  if (input.category) q = q.eq('category', input.category);
  if (input.priority) q = q.eq('priority', input.priority);
  if (input.search?.trim()) {
    const v = input.search.trim();
    q = q.or(`title.ilike.%${v}%,message.ilike.%${v}%,body.ilike.%${v}%`);
  }

  const from = input.offset ?? 0;
  const to = from + (input.limit ?? 10) - 1;
  const { data, error, count } = await q.range(from, to);
  if (error) throw error;

  return { data: (data ?? []) as NotificationItem[], total: count ?? 0 };
}
