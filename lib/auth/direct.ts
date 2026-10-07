/** The one account that signs in without a password: Neeraj's KAM profile. */
export const PASSWORD_FREE_EMAIL = "neeraj@firstgear.example";

export function isPasswordFree(email: string): boolean {
  return email.trim().toLowerCase() === PASSWORD_FREE_EMAIL;
}
