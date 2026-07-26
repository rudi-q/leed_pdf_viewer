import { writable } from 'svelte/store';

// crypto.randomUUID() requires a secure context (HTTPS/localhost).
// Fall back to crypto.getRandomValues() which works on plain HTTP (e.g. dev --host over LAN).
function generateId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	return [
		bytes.slice(0, 4), bytes.slice(4, 6), bytes.slice(6, 8),
		bytes.slice(8, 10), bytes.slice(10, 16)
	].map(seg => Array.from(seg).map(b => b.toString(16).padStart(2, '0')).join('')).join('-');
}

export interface ToastAction {
	label: string;
	onClick: () => void | Promise<void>;
}

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info' | 'tip';
	title: string;
	message: string;
	duration?: number; // in milliseconds, 0 = no auto-dismiss
	dismissible?: boolean;
	actions?: ToastAction[]; // Optional action buttons
}

const createToastStore = () => {
	const { subscribe, update } = writable<Toast[]>([]);

	const addToast = (toast: Omit<Toast, 'id'>) => {
		const id = generateId();
		const newToast: Toast = {
			id,
			duration: 5000,
			dismissible: true,
			...toast
		};

		update((toasts) => [...toasts, newToast]);

		// Auto-remove toast after duration
		if (newToast.duration && newToast.duration > 0) {
			setTimeout(() => {
				removeToast(id);
			}, newToast.duration);
		}

		return id;
	};

	const removeToast = (id: string) => {
		update((toasts) => toasts.filter((t) => t.id !== id));
	};

	const clearAll = () => {
		update(() => []);
	};

	// Convenience methods
	const success = (title: string, message: string, options?: Partial<Toast>) => {
		return addToast({ type: 'success', title, message, ...options });
	};

	const error = (title: string, message: string, options?: Partial<Toast>) => {
		return addToast({ type: 'error', title, message, duration: 8000, ...options });
	};

	const warning = (title: string, message: string, options?: Partial<Toast>) => {
		return addToast({ type: 'warning', title, message, duration: 6000, ...options });
	};

	const info = (title: string, message: string, options?: Partial<Toast>) => {
		return addToast({ type: 'info', title, message, ...options });
	};

	const tip = (title: string, message: string, options?: Partial<Toast>) => {
		return addToast({ type: 'tip', title, message, duration: 20000, dismissible: true, ...options });
	};

	return {
		subscribe,
		addToast,
		removeToast,
		clearAll,
		success,
		error,
		warning,
		info,
		tip
	};
};

export const toastStore = createToastStore();
