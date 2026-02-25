// Session token manager for per-user API authentication
// Token is returned by backend on login and used for all subsequent requests

const SESSION_TOKEN_KEY = 'swimtrack_session_token';

let currentSessionToken: string | null = null;

/**
 * Set the session token (called after successful login)
 */
export function setSessionToken(token: string | null): void {
  currentSessionToken = token;
  if (token) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
}

/**
 * Get the current session token
 */
export function getSessionToken(): string | null {
  if (!currentSessionToken) {
    currentSessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  }
  return currentSessionToken;
}

/**
 * Clear the session token (called on logout)
 */
export function clearSessionToken(): void {
  currentSessionToken = null;
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

/**
 * Check if a session token exists
 */
export function hasSessionToken(): boolean {
  return !!getSessionToken();
}
