import { invoke } from '@tauri-apps/api/core';
import { isTauri, detectOS } from './tauriUtils';

export type LicenseErrorCode = 'PLATFORM_MISMATCH' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'UNKNOWN';

export interface LicenseValidationResult {
    valid: boolean;
    error?: string; // Human-readable message for UI fallback
    errorCode?: LicenseErrorCode; // Structured code for UI logic
}

// Detect if license functionality is required
const isMacOS = detectOS() === 'macOS';
const isIOS = detectOS() === 'iOS';
const requiresLicense = isTauri && !isMacOS && !isIOS;

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
		// macOS/iOS App Store or web - no license required
		if (!requiresLicense) return { valid: true };

		try {
            const isValid = await invoke<boolean>('activate_license', { licensekey: licenseKey });
            if (isValid) return { valid: true };
            return {
                valid: false,
                errorCode: 'INVALID_KEY',
                error: 'Invalid license key'
            };
		} catch (error) {
            const mapped = this.mapErrorToCode(error);
            return {
                valid: false,
                errorCode: mapped.code,
                error: mapped.message ?? 'Failed to activate license key'
            };
		}
	}

	async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
		// macOS/iOS App Store or web - no license required
		if (!requiresLicense) return { valid: true };

		try {
            const isValid = await invoke<boolean>('validate_license', { licensekey: licenseKey });
            if (isValid) return { valid: true };
            return {
                valid: false,
                errorCode: 'INVALID_KEY',
                error: 'Invalid license key'
            };
		} catch (error) {
            const mapped = this.mapErrorToCode(error);
            return {
                valid: false,
                errorCode: mapped.code,
                error: mapped.message ?? 'Failed to validate license key'
            };
		}
	}

	async getStoredLicenseKey(): Promise<string | null> {
		// macOS/iOS App Store or web - no license storage
		if (!requiresLicense) return null;

		try {
			return await invoke<string | null>('get_stored_license_key');
		} catch (error) {
			console.error('Failed to get stored license key:', error);
			return null;
		}
	}

	async clearLicense(): Promise<void> {
		// macOS/iOS App Store or web - no license to clear
		if (!requiresLicense) return;

		try {
			await invoke('clear_license');
		} catch (error) {
			console.error('Failed to clear license:', error);
		}
	}

    async checkLicenseStatus(): Promise<LicenseValidationResult & { needsActivation?: boolean }> {
		// macOS/iOS App Store or web - no license required
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
            if (isValid) return { valid: true };
            return {
                valid: false,
                errorCode: 'INVALID_KEY',
                error: 'Stored license is invalid'
            };
        } catch (error) {
            const mapped = this.mapErrorToCode(error);
            return {
                valid: false,
                errorCode: mapped.code,
                error: mapped.message ?? 'License validation failed'
            };
        }
    }

    private mapErrorToCode(error: unknown): { code: LicenseErrorCode; message?: string } {
        const message = typeof error === 'string'
            ? error
            : (error && typeof (error as any).message === 'string')
                ? (error as any).message as string
                : undefined;

        const msg = (message ?? '').toLowerCase();

        // Platform mismatch indicators (keys tied to specific OS)
        if (msg.includes('not valid for windows')
            || msg.includes('not valid for macos')
            || msg.includes("starts with 'leedwin'")
            || msg.includes("starts with 'leedmac'")) {
            return { code: 'PLATFORM_MISMATCH', message };
        }

        // Network related indicators
        if (msg.includes('network') || msg.includes('timeout') || msg.includes('econn') || msg.includes('fetch failed')) {
            return { code: 'NETWORK_ERROR', message };
        }

        // Generic invalid key indicators
        if (msg.includes('invalid') || msg.includes('not valid') || msg.includes('bad license')) {
            return { code: 'INVALID_KEY', message };
        }

        return { code: 'UNKNOWN', message };
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

		if (isIOS) {
			return {
				requires_license: false,
				platform: 'ios',
				reason: 'iOS App Store build - no license required (paid via App Store)'
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


