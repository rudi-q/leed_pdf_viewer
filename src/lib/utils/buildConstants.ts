import { browser, dev } from '$app/environment';

export const buildingTauri = (import.meta.env.VITE_BUILDING_TAURI === 'true') as boolean;
export const isDevMode = (import.meta.env.VITE_DEV_MODE === 'true') as boolean;
export const enableAnalytics = browser && !dev && !isDevMode && !buildingTauri && !((import.meta.env.VITE_E2E_TESTING === 'true') as boolean);