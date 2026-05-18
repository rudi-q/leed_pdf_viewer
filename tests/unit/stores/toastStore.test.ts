import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { toastStore } from '../../../src/lib/stores/toastStore';

describe('toastStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		toastStore.clearAll();
	});

	afterEach(() => {
		vi.useRealTimers();
		toastStore.clearAll();
	});

	it('starts empty', () => {
		expect(get(toastStore)).toHaveLength(0);
	});

	it('addToast adds a toast', () => {
		toastStore.addToast({ type: 'info', title: 'Hi', message: 'Hello' });
		expect(get(toastStore)).toHaveLength(1);
	});

	it('addToast sets default duration and dismissible', () => {
		toastStore.addToast({ type: 'info', title: 'Hi', message: 'Hello' });
		const [toast] = get(toastStore);
		expect(toast.duration).toBe(5000);
		expect(toast.dismissible).toBe(true);
	});

	it('addToast returns the id', () => {
		const id = toastStore.addToast({ type: 'info', title: 'T', message: 'M' });
		const [toast] = get(toastStore);
		expect(id).toBe(toast.id);
	});

	it('addToast respects overridden options', () => {
		toastStore.addToast({ type: 'error', title: 'T', message: 'M', duration: 0, dismissible: false });
		const [toast] = get(toastStore);
		expect(toast.duration).toBe(0);
		expect(toast.dismissible).toBe(false);
	});

	it('removeToast removes the matching toast', () => {
		const id = toastStore.addToast({ type: 'info', title: 'T', message: 'M', duration: 0 });
		toastStore.removeToast(id);
		expect(get(toastStore)).toHaveLength(0);
	});

	it('removeToast is a no-op for unknown id', () => {
		toastStore.addToast({ type: 'info', title: 'T', message: 'M', duration: 0 });
		toastStore.removeToast('nonexistent');
		expect(get(toastStore)).toHaveLength(1);
	});

	it('clearAll removes all toasts', () => {
		toastStore.addToast({ type: 'info', title: 'T1', message: 'M', duration: 0 });
		toastStore.addToast({ type: 'error', title: 'T2', message: 'M', duration: 0 });
		toastStore.clearAll();
		expect(get(toastStore)).toHaveLength(0);
	});

	it('auto-removes toast after duration elapses', () => {
		toastStore.addToast({ type: 'info', title: 'T', message: 'M', duration: 3000 });
		expect(get(toastStore)).toHaveLength(1);
		vi.advanceTimersByTime(3000);
		expect(get(toastStore)).toHaveLength(0);
	});

	it('does not auto-remove when duration is 0', () => {
		toastStore.addToast({ type: 'info', title: 'T', message: 'M', duration: 0 });
		vi.advanceTimersByTime(60000);
		expect(get(toastStore)).toHaveLength(1);
	});

	describe('convenience methods', () => {
		it('success creates a success toast', () => {
			toastStore.success('Title', 'Message');
			const [toast] = get(toastStore);
			expect(toast.type).toBe('success');
			expect(toast.title).toBe('Title');
			expect(toast.message).toBe('Message');
		});

		it('error creates an error toast with 8s duration', () => {
			toastStore.error('Err', 'Details');
			const [toast] = get(toastStore);
			expect(toast.type).toBe('error');
			expect(toast.duration).toBe(8000);
		});

		it('warning creates a warning toast with 6s duration', () => {
			toastStore.warning('Warn', 'Details');
			const [toast] = get(toastStore);
			expect(toast.type).toBe('warning');
			expect(toast.duration).toBe(6000);
		});

		it('info creates an info toast', () => {
			toastStore.info('Info', 'Details');
			const [toast] = get(toastStore);
			expect(toast.type).toBe('info');
		});

		it('tip creates a tip toast with 20s duration', () => {
			toastStore.tip('Tip', 'Details');
			const [toast] = get(toastStore);
			expect(toast.type).toBe('tip');
			expect(toast.duration).toBe(20000);
			expect(toast.dismissible).toBe(true);
		});

		it('convenience methods accept extra options', () => {
			toastStore.success('T', 'M', { duration: 1000 });
			const [toast] = get(toastStore);
			expect(toast.duration).toBe(1000);
		});

		it('convenience methods return the toast id', () => {
			const id = toastStore.success('T', 'M', { duration: 0 });
			const [toast] = get(toastStore);
			expect(id).toBe(toast.id);
		});
	});

	it('multiple toasts stack in order', () => {
		toastStore.addToast({ type: 'info', title: 'A', message: '', duration: 0 });
		toastStore.addToast({ type: 'error', title: 'B', message: '', duration: 0 });
		const toasts = get(toastStore);
		expect(toasts[0].title).toBe('A');
		expect(toasts[1].title).toBe('B');
	});
});
