-- payment_slips_shop_read only matched users_profile.shop_id, so the portal
-- slip inbox (/portal/payment-verification) came back empty for:
--   * super_admin acting in a shop via the portal_admin_shop_id cookie
--     (users_profile.shop_id stays NULL for the global account)
--   * staff whose shop comes from user_roles rather than users_profile
-- The API already filters by the caller's resolved shop_id; align the policy
-- with every other shop table by using can_access_shop (super_admin,
-- users_profile.shop_id or a user_roles grant for that shop).

DROP POLICY IF EXISTS payment_slips_shop_read ON public.payment_slips;

CREATE POLICY payment_slips_shop_read ON public.payment_slips
  FOR SELECT TO authenticated
  USING (public.can_access_shop(shop_id));
