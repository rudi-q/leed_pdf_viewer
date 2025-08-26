<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

	export let isVisible = false;
  export const isTauri = false;

  let debugResults = 'Click button to test...';
  let testFilePath = '';
  let testFileInput: HTMLInputElement;

  // Debug function to test app state
  async function testAppState() {
    try {
      debugResults = 'Testing app state...';
      const result = await invoke('check_app_state');
      debugResults = `App State:\n${result}`;
      console.log('App state result:', result);
    } catch (error) {
      debugResults = `Error: ${error}`;
      console.error('Error testing app state:', error);
    }
  }

  // Debug function to test file event
  async function testFileEvent() {
    try {
      if (!testFilePath.trim()) {
        debugResults = 'Error: Please select a test file first';
        return;
      }

      // Basic path validation
      if (!testFilePath.includes('.pdf')) {
        debugResults = 'Error: Please select a PDF file for testing';
        return;
      }

      debugResults = 'Testing file event...';
      await invoke('test_file_event', { filePath: testFilePath.trim() });
      debugResults = 'File event test completed - check terminal for output';
    } catch (error) {
      debugResults = `Error: ${error}`;
      console.error('Error testing file event:', error);
    }
  }

  // Function to handle file selection
  function handleTestFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      // In Tauri environment, we can get the file path from the input element
      // For browser environment, we'll use the file name as fallback
      testFilePath = (input as any).files[0]?.path || file.name;
      debugResults = `Test file selected: ${testFilePath}`;
    }
  }

  // Function to get a default test path from the backend
  async function getDefaultTestPath() {
    try {
      // Try to get a sensible default path from the backend
      const defaultPath = await invoke('get_default_test_path') as string;
      if (defaultPath) {
        testFilePath = defaultPath;
        debugResults = `Default test path set: ${defaultPath}`;
      }
    } catch (error) {
      // Fallback to empty path if backend doesn't support this
      testFilePath = '';
      debugResults = 'No default test path available - please select a file manually';
    }
  }

  function closeDebugPanel() {
    isVisible = false;
  }
</script>

{#if isVisible}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300">Debug Tools (Dev Mode)</h3>
        <button
          on:click={closeDebugPanel}
          class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Close debug panel"
          aria-label="Close debug panel"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      <div class="space-y-4">
        <div class="space-y-3">
          <div class="flex gap-2">
            <button
              on:click={testAppState}
              class="px-3 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
            >
              Test App State
            </button>
            <button
              on:click={testFileEvent}
              class="px-3 py-2 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
              disabled={!testFilePath.trim()}
            >
              Test File Event
            </button>
          </div>
          
          <div class="space-y-2">
            <div class="flex gap-2 items-center">
              <input
                bind:this={testFileInput}
                type="file"
                accept=".pdf"
                on:change={handleTestFileSelect}
                class="hidden"
              />
              <button
                on:click={() => testFileInput?.click()}
                class="px-3 py-2 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
              >
                Select Test File
              </button>
              <button
                on:click={getDefaultTestPath}
                class="px-3 py-2 bg-purple-500 text-white text-sm rounded hover:bg-purple-600 transition-colors"
              >
                Get Default Path
              </button>
            </div>
            
            {#if testFilePath}
              <div class="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                <strong>Test File:</strong> {testFilePath}
              </div>
            {/if}
          </div>
        </div>

        {#if debugResults !== 'Click button to test...'}
          <div class="p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs overflow-auto max-h-40">
            <pre class="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{debugResults}</pre>
          </div>
        {/if}

        <div class="text-xs text-gray-500 dark:text-gray-400">
          <p>This debug panel is only visible in development mode.</p>
          <p>Use these tools to test Tauri backend functionality and diagnose issues.</p>
        </div>
      </div>
    </div>
  </div>
{/if}
