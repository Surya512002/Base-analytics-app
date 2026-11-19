/**
 * Our own hosts, with no imports, so it can be used from Edge middleware.
 * `trusted-hosts.ts` re-exports these for the sign-in checks.
 */
export const PRODUCTION_HOSTS = ["baseanalytics.app", "www.baseanalytics.app", "base-analytics-app.vercel.app"] as const;

/** This project's Vercel preview URLs: base-analytics-app-<hash|git-branch>-surya512002s-projects.vercel.app */
export const PREVIEW_HOST = /^base-analytics-app-[a-z0-9-]+-surya512002s-projects\.vercel\.app$/;
