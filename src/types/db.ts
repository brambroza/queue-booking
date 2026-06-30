export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AppRole = 'super_admin' | 'shop_owner' | 'branch_manager' | 'staff' | 'customer';
export type BookingStatus = 'pending' | 'confirmed' | 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'unpaid' | 'pending_payment' | 'paid' | 'failed' | 'refunded';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
