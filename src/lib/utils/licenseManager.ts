import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './tauriUtils';

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
	 * Get stored license key from the backend
	 */
	async getStoredLicenseKey(): Promise<string | null> {
		if (!isTauri) {
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
	 * Activate a license key for this device (first time setup)
	 */
	async activateLicense(licenseKey: string): Promise<LicenseValidationResult> {
		if (!isTauri) {
			return { valid: true }; // Web version doesn't need license activation
		}

		try {
			const isValid = await invoke<boolean>('activate_license', { licensekey: licenseKey });
			return { valid: isValid };
		} catch (error) {
			const errorMessage = typeof error === 'string' ? error : 'Failed to activate license key';
			return { valid: false, error: errorMessage };
		}
	}

	/**
	 * Validate an already-activated license key with the Polar API
	 */
	async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
		if (!isTauri) {
			return { valid: true }; // Web version doesn't need license validation
		}

		try {
			const isValid = await invoke<boolean>('validate_license', { licensekey: licenseKey });
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
		if (!isTauri) {
			return;
		}

		try {
			await invoke('clear_license');
		} catch (error) {
			console.error('Failed to clear license:', error);
		}
	}

	/**
	 * Check if license needs activation (no license file) or validation (existing license)
	 */
	async checkLicenseStatus(): Promise<LicenseValidationResult & { needsActivation?: boolean }> {
		if (!isTauri) {
			return { valid: true }; // Web version doesn't need license validation
		}

		// Check if there's an existing license file
		const storedLicenseKey = await this.getStoredLicenseKey();

		if (!storedLicenseKey) {
			// No stored license - needs activation
			return {
				valid: false,
				needsActivation: true,
				error: 'No license key found - activation required'
			};
		}

		// Has stored license - perform smart validation
		// Avoid multiple simultaneous validations
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
