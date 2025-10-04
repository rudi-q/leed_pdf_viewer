import { writable } from 'svelte/store';

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message: string;
	duration?: number; // in milliseconds
	dismissible?: boolean;
	actions?: ToastAction[]; // Optional action buttons
}

const createToastStore = () => {
	const { subscribe, update } = writable<Toast[]>([]);

	const addToast = (toast: Omit<Toast, 'id'>) => {
		const id = crypto.randomUUID();
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

	return {
		subscribe,
		addToast,
		removeToast,
		clearAll,
		success,
		error,
		warning,
		info
	};
};

export const toastStore = createToastStore();
