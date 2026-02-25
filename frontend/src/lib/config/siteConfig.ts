// Site configuration - bundled at build time (not publicly accessible)
// To change settings, edit src/config/config.json and rebuild

import { AdminConfig, StorageConfig } from '@/lib/api/types';
import configFile from '@/config/config.json';

export interface SiteConfigFile {
  site: {
    domain: string;
  };
  smtp: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  storage: {
    type: 'local' | 'remote';
    baseUrl: string;
    endpoints: {
      competitions: string;
      teams: string;
      swimmers: string;
      referees: string;
      lapCounts: string;
      swimSessions: string;
      login: string;
      register: string;
    };
  };
  maintenance: {
    enabled: boolean;
  };
  emailNotifications: {
    organizerRegistration: boolean;
    passwordReset: boolean;
    competitionResult: boolean;
    faqFeedback: boolean;
  };
  admin: {
    passwordHash: string;
  };
}

// Config is loaded from bundled JSON at build time
const siteConfig: SiteConfigFile = configFile as SiteConfigFile;

/**
 * Get site configuration (sync)
 * Config is bundled at build time, no async loading needed
 */
export function getSiteConfig(): SiteConfigFile {
  return siteConfig;
}

/**
 * Async version for API compatibility
 */
export async function loadSiteConfig(): Promise<SiteConfigFile> {
  return siteConfig;
}

/**
 * Get cached config (same as getSiteConfig for compatibility)
 */
export function getCachedConfig(): SiteConfigFile {
  return siteConfig;
}

/**
 * Convert site config to AdminConfig format for compatibility
 */
export function toAdminConfig(config: SiteConfigFile): AdminConfig {
  return {
    siteDomain: config.site?.domain ?? '',
    smtpHost: config.smtp?.host ?? '',
    smtpPort: config.smtp?.port ?? 587,
    smtpUser: config.smtp?.user ?? '',
    smtpPassword: config.smtp?.password ?? '',
    smtpFrom: config.smtp?.from ?? '',
    authType: config.storage?.type === 'remote' ? 'external' : 'builtin',
    backendUrl: config.storage?.baseUrl ?? '',
    maintenanceMode: config.maintenance?.enabled ?? false,
    emailNotifications: config.emailNotifications ?? {
      organizerRegistration: true,
      passwordReset: true,
      competitionResult: true,
      faqFeedback: true,
    },
    storage: {
      type: config.storage?.type ?? 'local',
      baseUrl: config.storage?.baseUrl ?? '',
      endpoints: config.storage?.endpoints as StorageConfig['endpoints'],
    },
  };
}

/**
 * Get storage configuration from site config
 */
export function getStorageConfig(): StorageConfig {
  return {
    type: siteConfig.storage.type,
    baseUrl: siteConfig.storage.baseUrl,
    endpoints: siteConfig.storage.endpoints as StorageConfig['endpoints'],
  };
}

/**
 * Check if remote API mode is enabled
 */
export function isRemoteMode(): boolean {
  return siteConfig.storage.type === 'remote';
}

/**
 * Async versions for API compatibility
 */
export async function getStorageConfigAsync(): Promise<StorageConfig> {
  return getStorageConfig();
}

export async function isRemoteModeAsync(): Promise<boolean> {
  return isRemoteMode();
}

/**
 * Sync version aliases (for backward compatibility)
 */
export const getStorageConfigSync = getStorageConfig;
export const isRemoteModeSync = isRemoteMode;
