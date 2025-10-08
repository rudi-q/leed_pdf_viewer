import { invoke } from '@tauri-apps/api/core';
import { isTauri, detectOS } from './tauriUtils';

export interface LicenseValidationResult {
	valid: boolean;
	error?: string;
}

// Detect if license functionality is required
const isMacOS = detectOS() === 'macOS';
const requiresLicense = isTauri && !isMacOS;

export class LicenseManager {
	private static instance: LicenseManager;
	private validationPromise: Promise<LicenseValidationResult> | null = null;

	private constructor() {}

	static getInstance(): LicenseManager {
		if (!LicenseManager.instance) {
			LicenseManager.instance = new LicenseManager();
		}
		return LicenseManager.instance;
	}

	async activateLicense(licenseKey: string): Promise<LicenseValidationResult> {
		// macOS App Store or web - no license required
		if (!requiresLicense) return { valid: true };

		try {
			const isValid = await invoke<boolean>('activate_license', { licensekey: licenseKey });
			return { valid: isValid };
		} catch (error) {
			return {
				valid: false,
				error: typeof error === 'string' ? error : 'Failed to activate license key'
			};
		}
	}

	async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
		// macOS App Store or web - no license required
		if (!requiresLicense) return { valid: true };

		try {
			const isValid = await invoke<boolean>('validate_license', { licensekey: licenseKey });
			return { valid: isValid };
		} catch (error) {
			return {
				valid: false,
				error: typeof error === 'string' ? error : 'Failed to validate license key'
			};
		}
	}

	async getStoredLicenseKey(): Promise<string | null> {
		// macOS App Store or web - no license storage
		if (!requiresLicense) return null;

		try {
			return await invoke<string | null>('get_stored_license_key');
		} catch (error) {
			console.error('Failed to get stored license key:', error);
			return null;
		}
	}

	async clearLicense(): Promise<void> {
		// macOS App Store or web - no license to clear
		if (!requiresLicense) return;

		try {
			await invoke('clear_license');
		} catch (error) {
			console.error('Failed to clear license:', error);
		}
	}

	async checkLicenseStatus(): Promise<LicenseValidationResult & { needsActivation?: boolean }> {
		// macOS App Store or web - no license required
		if (!requiresLicense) return { valid: true };

		// Platform requires license - check if we have one stored
		const storedLicenseKey = await this.getStoredLicenseKey();

		if (!storedLicenseKey) {
			return {
				valid: false,
				needsActivation: true,
				error: 'No license key found - activation required'
			};
		}

		if (this.validationPromise) {
			const result = await this.validationPromise;
			return { ...result, needsActivation: false };
		}

		this.validationPromise = this.performLicenseCheck();
		const result = await this.validationPromise;
		this.validationPromise = null;

		return { ...result, needsActivation: false };
	}

	private async performLicenseCheck(): Promise<LicenseValidationResult> {
		try {
			const isValid = await invoke<boolean>('check_license_smart_command');
			return { valid: isValid };
		} catch (error) {
			return {
				valid: false,
				error: typeof error === 'string' ? error : 'License validation failed'
			};
		}
	}

	// Debug: Get license requirement info for current platform
	async getLicenseInfo(): Promise<{ requires_license: boolean; platform: string; reason: string }> {
		const platform = detectOS();
		
		if (!isTauri) {
			return {
				requires_license: false,
				platform: 'web',
				reason: 'Running in web browser - no license required'
			};
		}

		if (isMacOS) {
			return {
				requires_license: false,
				platform: 'macos',
				reason: 'macOS App Store build - no license required (paid via App Store)'
			};
		}

		// For Windows/Linux, query the backend
		try {
			return await invoke('get_license_info');
		} catch (error) {
			// Fallback if command doesn't exist
			return {
				requires_license: true,
				platform: platform.toLowerCase(),
				reason: 'License key required for this platform'
			};
		}
	}
}

export const licenseManager = LicenseManager.getInstance();


