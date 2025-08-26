import packageJson from '../../../package.json';

/**
 * Get the current application version from package.json
 * @returns The semantic version string (e.g., "2.3.0")
 */
export function getAppVersion(): string {
  return packageJson.version;
}

/**
 * Get a formatted version string with "v" prefix
 * @returns Formatted version string (e.g., "v2.3.0")
 */
export function getFormattedVersion(): string {
  return `v${packageJson.version}`;
}
