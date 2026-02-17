<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { toastStore } from '../stores/toastStore';
	import { MAX_FILE_SIZE } from '$lib/constants';

	// Event dispatcher for parent components
	const dispatch = createEventDispatcher<{
		fileSelected: { url: string; fileName: string; fileSize: number };
		cancel: void;
		error: { message: string };
	}>();

	// Props
	export let multiselect = false;
	export let linkType: 'preview' | 'direct' = 'direct'; // Use direct links for better CORS support
	export let extensions = ['.pdf']; // Only allow PDFs by default
	export let sizeLimit: number = MAX_FILE_SIZE; // Default to global MAX_FILE_SIZE

	// State
	let isDropboxSupported = false;
	let isLoading = false;

	// Cleanup tracking
	let pollTimer: number | undefined;
	let scriptLoadListener: (() => void) | undefined;

	// Check if Dropbox API is available and browser is supported
	onMount(() => {
		if (browser && typeof window !== 'undefined') {
			// First check if Dropbox is already available
			if (window.Dropbox && window.Dropbox.isBrowserSupported) {
				isDropboxSupported = window.Dropbox.isBrowserSupported();
				if (!isDropboxSupported) {
					console.warn('Dropbox Chooser is not supported in this browser');
				}
				return;
			}

			// Find the Dropbox script tag and add load listener if it exists
			const dropboxScript = document.getElementById('dropboxjs');
			if (dropboxScript) {
				scriptLoadListener = () => {
					if (window.Dropbox && window.Dropbox.isBrowserSupported) {
						isDropboxSupported = window.Dropbox.isBrowserSupported();
						if (!isDropboxSupported) {
							console.warn('Dropbox Chooser is not supported in this browser');
						}
					}
				};
				dropboxScript.addEventListener('load', scriptLoadListener);

				// Also check if script already loaded but event missed
				if (window.Dropbox) {
					scriptLoadListener();
				}
			}

			// Bounded fallback polling with timeout
			let attempts = 0;
			const maxAttempts = 50; // 5 seconds total (50 * 100ms)

			const checkDropboxBounded = () => {
				attempts++;

				if (window.Dropbox && window.Dropbox.isBrowserSupported) {
					isDropboxSupported = window.Dropbox.isBrowserSupported();
					if (!isDropboxSupported) {
						console.warn('Dropbox Chooser is not supported in this browser');
					}
				} else if (attempts < maxAttempts) {
					pollTimer = window.setTimeout(checkDropboxBounded, 100);
				} else {
					console.warn('Dropbox API failed to load within timeout period');
				}
			};

			// Start bounded polling as fallback
			pollTimer = window.setTimeout(checkDropboxBounded, 100);
		}
	});

	// Cleanup on component destroy
	onDestroy(() => {
		// Clear any pending timer
		if (pollTimer) {
			clearTimeout(pollTimer);
			pollTimer = undefined;
		}

		// Remove script load listener
		if (scriptLoadListener && browser) {
			const dropboxScript = document.getElementById('dropboxjs');
			if (dropboxScript) {
				dropboxScript.removeEventListener('load', scriptLoadListener);
			}
			scriptLoadListener = undefined;
		}
	});

	// Main function to trigger Dropbox Chooser
	export function openDropboxChooser() {
		if (!browser || !window.Dropbox) {
			const errorMsg = 'Dropbox API is not available';
			console.error(errorMsg);
			dispatch('error', { message: errorMsg });
			toastStore.error(
				'Dropbox Error',
				'Dropbox integration is not available. Please try uploading from your device instead.'
			);
			return;
		}

		if (!isDropboxSupported) {
			const errorMsg = 'Your browser does not support Dropbox Chooser';
			console.error(errorMsg);
			dispatch('error', { message: errorMsg });
			toastStore.error(
				'Browser Not Supported',
				"Your browser doesn't support Dropbox Chooser. Please try uploading from your device instead."
			);
			return;
		}

		isLoading = true;

		const options = {
			// Required success callback
			success: function (files: any[]) {
				console.log('Dropbox files selected:', files);
				isLoading = false;

				if (files && files.length > 0) {
					const file = files[0]; // Take first file (since multiselect is false for PDFs)

					// Validate that it's a PDF
					if (!file.name.toLowerCase().endsWith('.pdf')) {
						const errorMsg = 'Please select a PDF file';
						console.error(errorMsg);
						dispatch('error', { message: errorMsg });
						toastStore.error('Invalid File Type', 'Please select a PDF file from your Dropbox.');
						return;
					}

					console.log('Selected PDF from Dropbox:', {
						name: file.name,
						size: file.bytes,
						link: file.link
					});

					// Dispatch the file selection event with the direct link
					dispatch('fileSelected', {
						url: file.link,
						fileName: file.name,
						fileSize: file.bytes
					});

					toastStore.success('File Selected', `Loading "${file.name}" from Dropbox...`);
				}
			},

			// Optional cancel callback
			cancel: function () {
				console.log('Dropbox Chooser cancelled by user');
				isLoading = false;
				dispatch('cancel');
			},

			// Configuration options
			linkType: linkType,
			multiselect: multiselect,
			extensions: extensions,
			folderselect: false, // We only want files, not folders
			sizeLimit: sizeLimit
		};

		try {
			// Trigger the Dropbox Chooser
			window.Dropbox.choose(options);
		} catch (error) {
			console.error('Error opening Dropbox Chooser:', error);
			isLoading = false;
			const errorMsg = error instanceof Error ? error.message : 'Failed to open Dropbox Chooser';
			dispatch('error', { message: errorMsg });
			toastStore.error('Dropbox Error', 'Failed to open Dropbox file picker. Please try again.');
		}
	}
</script>

<!-- 
  This component doesn't render any UI - it's a utility component
  that provides the openDropboxChooser() function to parent components
-->

{#if isLoading}
	<div
		class="dropbox-chooser-loading fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
	>
		<div
			class="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col items-center space-y-4 max-w-sm mx-4"
		>
			<!-- Dropbox logo with spin animation -->
			<div class="animate-spin">
				<svg
					class="w-12 h-12 text-[#0061FF]"
					fill="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						d="M6 2L0 6l6 4 6-4-6-4zM18 2l-6 4 6 4 6-4-6-4zM0 14l6-4 6 4-6 4-6-4zM18 10l6 4-6 4-6-4 6-4zM6 16l6 4 6-4-6-4-6 4z"
					/>
				</svg>
			</div>

			<div class="text-center">
				<h3 class="text-lg font-medium text-charcoal dark:text-gray-100 mb-2">Opening Dropbox</h3>
				<p class="text-sm text-slate dark:text-gray-400">
					Please wait while we connect to your Dropbox account...
				</p>
			</div>

			<!-- Animated dots -->
			<div class="flex space-x-1">
				<div
					class="w-2 h-2 bg-[#0061FF] rounded-full animate-bounce"
					style="animation-delay: 0ms"
				></div>
				<div
					class="w-2 h-2 bg-[#0061FF] rounded-full animate-bounce"
					style="animation-delay: 150ms"
				></div>
				<div
					class="w-2 h-2 bg-[#0061FF] rounded-full animate-bounce"
					style="animation-delay: 300ms"
				></div>
			</div>
		</div>
	</div>
{/if}

<style>
	.dropbox-chooser-loading {
		/* Ensure it appears above everything else */
		backdrop-filter: blur(4px);
	}

	/* Custom bounce animation for dots */
	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}
</style>
