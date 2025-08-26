import { writable } from 'svelte/store';

export interface UpdateState {
	checking: boolean;
	available: boolean;
	downloading: boolean;
	downloaded: number;
	contentLength: number;
	version?: string;
	date?: string;
	body?: string;
	error?: string;
	completed: boolean;
}

const initialState: UpdateState = {
	checking: false,
	available: false,
	downloading: false,
	downloaded: 0,
	contentLength: 0,
	completed: false
};

function createUpdateStore() {
	const { subscribe, set, update } = writable<UpdateState>(initialState);

	return {
		subscribe,
		reset: () => set(initialState),
		setChecking: (checking: boolean) => update((state) => ({ ...state, checking })),
		setAvailable: (available: boolean, version?: string, date?: string, body?: string) =>
			update((state) => ({ ...state, available, version, date, body })),
		setDownloading: (downloading: boolean) => update((state) => ({ ...state, downloading })),
		setProgress: (downloaded: number, contentLength: number) =>
			update((state) => ({ ...state, downloaded, contentLength })),
		setCompleted: (completed: boolean) => update((state) => ({ ...state, completed })),
		setError: (error: string) =>
			update((state) => ({ ...state, error, checking: false, downloading: false }))
	};
}

export const updateStore = createUpdateStore();
