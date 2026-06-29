import { settingRepository } from './repositories/SettingRepository';
import { databaseManager } from './DatabaseManager';

const SETTINGS_NAMESPACE = 'settings:';

const safeLocalRead = <T>(key: string): T | undefined => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : undefined; } catch { return undefined; }
};
const safeLocalWrite = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { logger.error("Operation failed", e as Error); }
};
const safeLocalRemove = (key: string) => {
  try { localStorage.removeItem(key); } catch (e) { logger.error("Operation failed", e as Error); }
};

export const settingsBackplane = {
  async getJson<T>(key: string, options?: { exactKey?: boolean }): Promise<T | undefined> {
    const storageKey = options?.exactKey ? key : `${SETTINGS_NAMESPACE}${key}`;
    if (databaseManager.ready) {
      try { const value = await settingRepository.getJson<T>(storageKey); if (value !== undefined) return value; } catch (e) { logger.error("Operation failed", e as Error); }
    }
    return safeLocalRead<T>(storageKey);
  },

  async setJson<T>(key: string, value: T, options?: { exactKey?: boolean }): Promise<void> {
    const storageKey = options?.exactKey ? key : `${SETTINGS_NAMESPACE}${key}`;
    if (databaseManager.ready) {
      try { await settingRepository.setJson(storageKey, value); } catch (e) { logger.error("Operation failed", e as Error); }
    }
    safeLocalWrite(storageKey, value);
  },

  async remove(key: string, options?: { exactKey?: boolean }): Promise<void> {
    const storageKey = options?.exactKey ? key : `${SETTINGS_NAMESPACE}${key}`;
    if (databaseManager.ready) {
      try { await settingRepository.remove(storageKey); } catch (e) { logger.error("Operation failed", e as Error); }
    }
    safeLocalRemove(storageKey);
  },

  async getMany(keys: string[], options?: { exactKey?: boolean }): Promise<Record<string, unknown>> {
    const entries = await Promise.all(keys.map(async (key) => [key, await this.getJson(key, options)] as const));
    return entries.reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    }, {});
  },

  async ensureSeeded<T>(key: string, factory: () => T, options?: { exactKey?: boolean }): Promise<T> {
    const existing: T | undefined = await this.getJson(key, options);
    if (existing !== undefined) return existing;
    const value = factory();
    await this.setJson(key, value, options);
    return value;
  },
};
