/**
 * Whether a successful-looking `auth.signUp` response is Supabase's stand-in
 * for "this email is already registered".
 *
 * With email confirmation on, Supabase does not return an error for a known
 * email (that would let anyone probe which addresses have accounts). It returns
 * a user object with a fresh random id and an empty `identities` list, and no
 * row is created in `auth.users`. Treating that id as real is how the register
 * route ended up creating a company and a shop whose owner never existed, and
 * then failing on the `users_profile → auth.users` foreign key.
 *
 * @param user - `data.user` from `auth.signUp`.
 * @returns true when the email is already taken and nothing was created.
 */
export function isExistingEmailSignUp(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return Boolean(user) && Array.isArray(user?.identities) && user.identities.length === 0;
}

/** Message shown instead of the generic failure; never says "wrong password" or similar. */
export const EXISTING_EMAIL_MESSAGE = 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ หรือกด "ลืมรหัสผ่าน" หากจำรหัสไม่ได้';
