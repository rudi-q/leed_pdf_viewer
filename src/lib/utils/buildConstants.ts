import { browser, dev } from '$app/environment';

export const buildingTauri = (process.env.VITE_BUILDING_TAURI === 'true') as boolean;
export const isDevMode = (process.env.VITE_DEV_MODE === 'true') as boolean;
export const enableAnalytics = browser && !dev && !isDevMode && !buildingTauri;