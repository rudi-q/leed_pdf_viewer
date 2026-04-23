import { get } from 'svelte/store';
import { page } from '$app/stores';
import { toastStore } from '../stores/toastStore';
import tips from '../data/tips.json';

type Platform = 'mac' | 'windows';

function detectPlatform(): Platform {
	return navigator.platform.startsWith('Mac') ? 'mac' : 'windows';
}

function hasBeenShown(id: string, persistence: string): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const storage = persistence === 'permanent' ? localStorage : sessionStorage;
		return !!storage.getItem(`tip_shown_${id}`);
	} catch {
		return false;
	}
}

function markShown(id: string, persistence: string): void {
	if (typeof window === 'undefined') return;
	try {
		const storage = persistence === 'permanent' ? localStorage : sessionStorage;
		storage.setItem(`tip_shown_${id}`, '1');
	} catch {
		// storage unavailable (e.g. private browsing quota exceeded)
	}
}

function matchesRoute(tipRoutes: string[], currentRouteId: string | null): boolean {
	if (!currentRouteId) return false;
	return tipRoutes.some((r) => r === currentRouteId);
}

export function showTipsFor(trigger: string): ReturnType<typeof setTimeout> | null {
	const currentRouteId = get(page).route.id;
	const platform = detectPlatform();

	const matching = tips.filter((tip) => {
		if (tip.trigger !== trigger) return false;
		if (!matchesRoute(tip.routes, currentRouteId)) return false;
		if (hasBeenShown(tip.id, tip.persistence)) return false;

		const message = tip.message[platform as keyof typeof tip.message];
		if (!message) return false;

		return true;
	});

	const tip = matching[0];
	if (!tip) return null;
	return setTimeout(() => {
		const message = tip.message[platform as keyof typeof tip.message];
		markShown(tip.id, tip.persistence);
		toastStore.tip(tip.title, message);
	}, tip.delay ?? 1000);
}
