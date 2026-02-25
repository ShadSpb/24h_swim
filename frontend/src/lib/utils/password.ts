// Password generation and hashing utilities

const adjectives = [
  'Swift', 'Blue', 'Fast', 'Cool', 'Wild', 'Aqua', 'Wave', 'Deep',
  'Bright', 'Clear', 'Fresh', 'Quick', 'Calm', 'Bold', 'Free', 'Warm',
];

const nouns = [
  'Dolphin', 'Shark', 'Wave', 'Ocean', 'River', 'Pool', 'Stream', 'Tide',
  'Beach', 'Shell', 'Coral', 'Pearl', 'Whale', 'Seal', 'Otter', 'Fish',
];

/**
 * Generate a human-friendly password
 * Format: AdjectiveNoun## (e.g., SwiftDolphin42)
 */
export function generateHumanPassword(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const numbers = Math.floor(Math.random() * 99) + 1;
  
  return `${adj}${noun}${numbers.toString().padStart(2, '0')}`;
}

/**
 * Generate a referee user ID
 * Format: ref_##### (e.g., ref_42789)
 */
export function generateRefereeId(): string {
  const id = Math.floor(Math.random() * 100000);
  return `ref_${id.toString().padStart(5, '0')}`;
}

/**
 * Check if a string looks like a generated referee ID
 */
export function isGeneratedRefereeId(str: string): boolean {
  return /^ref_\d{5}$/.test(str);
}

/**
 * Hash a password using SHA-256
 * Returns a hex string of the hash
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Verify a password against a stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === storedHash;
}

/**
 * Check if a string looks like a SHA-256 hash (64 hex characters)
 */
export function isPasswordHash(str: string): boolean {
  return /^[a-f0-9]{64}$/i.test(str);
}
