import { invoke } from '@tauri-apps/api/core';

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
}

export class LicenseManager {
  private static instance: LicenseManager;
  private validationPromise: Promise<LicenseValidationResult> | null = null;
  
  static getInstance(): LicenseManager {
    if (!LicenseManager.instance) {
      LicenseManager.instance = new LicenseManager();
    }
    return LicenseManager.instance;
  }
  
  /**
   * Check if we're running in Tauri desktop environment (same method as UpdateManager)
   */
  private isTauri(): boolean {
    return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
  }
  
  /**
   * Get stored license key from the backend
   */
  async getStoredLicenseKey(): Promise<string | null> {
    if (!this.isTauri()) {
      return null;
    }
    
    try {
      const licenseKey = await invoke<string | null>('get_stored_license_key');
      return licenseKey;
    } catch (error) {
      console.error('Failed to get stored license key:', error);
      return null;
    }
  }
  
  /**
   * Validate a license key with the Polar API
   */
  async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
    if (!this.isTauri()) {
      return { valid: true }; // Web version doesn't need license validation
    }
    
    try {
      const isValid = await invoke<boolean>('validate_license', { licenseKey });
      return { valid: isValid };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 'Failed to validate license key';
      return { valid: false, error: errorMessage };
    }
  }
  
  /**
   * Clear stored license key
   */
  async clearLicense(): Promise<void> {
    if (!this.isTauri()) {
      return;
    }
    
    try {
      await invoke('clear_license');
    } catch (error) {
      console.error('Failed to clear license:', error);
    }
  }
  
  /**
   * Check if license validation is required and validate stored license if available
   */
  async checkLicenseStatus(): Promise<LicenseValidationResult> {
    if (!this.isTauri()) {
      return { valid: true }; // Web version doesn't need license validation
    }
    
    // Avoid multiple simultaneous validations
    if (this.validationPromise) {
      return this.validationPromise;
    }
    
    this.validationPromise = this.performLicenseCheck();
    const result = await this.validationPromise;
    this.validationPromise = null;
    
    return result;
  }
  
  private async performLicenseCheck(): Promise<LicenseValidationResult> {
    try {
      // Use smart license checking that works offline
      const isValid = await invoke<boolean>('check_license_smart_command');
      return { valid: isValid };
    } catch (error) {
      const errorMessage = typeof error === 'string' ? error : 'Failed to check license status';
      return { valid: false, error: errorMessage };
    }
  }
}

export const licenseManager = LicenseManager.getInstance();
