// Session token manager for per-user API authentication
// Token is returned by backend on login and used for all subsequent requests.
//
// The token is persisted in localStorage (not sessionStorage) so it survives a
// tab/window close, matching the login identity in `swimtrack_auth`. During a
// long event (e.g. a 24h competition) a referee whose tab gets closed by the OS
// would otherwise keep an "authenticated" identity while silently dropping the
// auth header on every request. Persisting both in localStorage keeps them in
// lockstep; the token is cleared explicitly on logout.
const SESSION_TOKEN_KEY = 'swimtrack_session_token';

let currentSessionToken: string | null = null;

/**
 * Set the session token (called after successful login)
 */
export function setSessionToken(token: string | null): void {
  currentSessionToken = token;
  if (token) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

/**
 * Get the current session token
 */
export function getSessionToken(): string | null {
  if (!currentSessionToken) {
    // Fall back to the legacy sessionStorage location for tokens written by an
    // older build still alive in an open tab, then read the current location.
    currentSessionToken =
      localStorage.getItem(SESSION_TOKEN_KEY) ?? sessionStorage.getItem(SESSION_TOKEN_KEY);
  }
  return currentSessionToken;
}

/**
 * Clear the session token (called on logout)
 */
export function clearSessionToken(): void {
  currentSessionToken = null;
  localStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

/**
 * Check if a session token exists
 */
export function hasSessionToken(): boolean {
  return !!getSessionToken();
}
