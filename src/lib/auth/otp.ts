/**
 * Supabase's "Email OTP Length" is a project setting (6–10 digits; this project
 * uses 8). Accept the whole range so a dashboard change never locks customers
 * out of a form.
 */
export const OTP_MIN = 6;
export const OTP_MAX = 10;

/** True when `value` has a length the Supabase project could have issued. */
export const isOtpComplete = (value: string) => value.length >= OTP_MIN && value.length <= OTP_MAX;
