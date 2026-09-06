import * as SecureStore from 'expo-secure-store';

const KEY = 'linkreel_user_id';
const STORE_OPTS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

let memoryId: string | null = null;

function randomId(): string {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `lr_${bytes}`;
}

/**
 * One id per install, stored in the iOS Keychain so deleting the app
 * does not mint a new free-tier account on the same iPhone.
 * If Keychain cannot persist, reuse the in-memory id for this process
 * and do not invent a new one on every call.
 */
export async function getStableUserId(): Promise<string> {
  if (memoryId) return memoryId;

  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing && existing.startsWith('lr_')) {
      memoryId = existing;
      return existing;
    }
    const next = randomId();
    await SecureStore.setItemAsync(KEY, next, STORE_OPTS);
    memoryId = next;
    return next;
  } catch {
    if (!memoryId) memoryId = randomId();
    return memoryId;
  }
}
