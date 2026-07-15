import { EngagementSettings, DEFAULT_ENGAGEMENT_SETTINGS } from '../types/engagement'
import { logger } from './logger'

function getCompanyConfig(): any {
  try {
    const raw = localStorage.getItem('nexus_company_config')
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCompanyConfig(config: any): void {
  try {
    localStorage.setItem('nexus_company_config', JSON.stringify(config))
  } catch (err) {
    logger.error('Failed to save company config:', err)
  }
}

export const engagementSettingsService = {
  getSettings(): EngagementSettings {
    const config = getCompanyConfig()
    return { ...DEFAULT_ENGAGEMENT_SETTINGS, ...config.engagementSettings }
  },

  updateSettings(updates: Partial<EngagementSettings>): EngagementSettings {
    const config = getCompanyConfig()
    const current = config.engagementSettings || {}
    config.engagementSettings = { ...current, ...updates }
    saveCompanyConfig(config)
    return config.engagementSettings
  },

  isEnabled(): boolean {
    return this.getSettings().enabled ?? false
  },

  isModuleEnabled(module: keyof EngagementSettings): boolean {
    const settings = this.getSettings()
    if (!settings.enabled) return false
    switch (module) {
      case 'pointsEnabled': return settings.pointsEnabled ?? false
      case 'cashbackEnabled': return settings.cashbackEnabled ?? false
      case 'membershipEnabled': return settings.membershipEnabled ?? false
      case 'giftCardsEnabled': return settings.giftCardsEnabled ?? false
      case 'affiliateEnabled': return settings.affiliateEnabled ?? false
      case 'promotionsEnabled': return settings.promotionsEnabled ?? false
      case 'rewardsEnabled': return settings.rewardsEnabled ?? false
      default: return false
    }
  },

  resetSettings(): EngagementSettings {
    const config = getCompanyConfig()
    config.engagementSettings = { ...DEFAULT_ENGAGEMENT_SETTINGS }
    saveCompanyConfig(config)
    return config.engagementSettings
  },
}

export default engagementSettingsService
