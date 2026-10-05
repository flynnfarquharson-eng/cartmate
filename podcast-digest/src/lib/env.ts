/** Read a required environment variable, with a friendly error if it's missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (see .env.example) and restart "npm run dev".`,
    );
  }
  return value;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return !!admin && !!email && email.toLowerCase() === admin;
}
