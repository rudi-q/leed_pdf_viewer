/**
 * File storage utility using IndexedDB for large PDF files
 * Provides better storage capacity and graceful error handling
 */

import { toastStore } from '$lib/stores/toastStore';
import { 
  MAX_FILE_SIZE, 
  WARNING_FILE_SIZE, 
  SESSION_MAX_FILE_SIZE, 
  MAX_STORAGE_TIME 
} from '$lib/constants';

export interface StoredFileData {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class FileStorageError extends Error {
  constructor(
    message: string,
    public readonly code: 'QUOTA_EXCEEDED' | 'STORAGE_UNAVAILABLE' | 'FILE_TOO_LARGE' | 'NOT_FOUND' | 'UNKNOWN',
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'FileStorageError';
  }
}

class FileStorageManager {
  private dbName = 'LeedPDFStorage';
  private dbVersion = 1;
  private storeName = 'tempFiles';
  private db: IDBDatabase | null = null;

  // File size limits - now using constants
  private readonly MAX_FILE_SIZE = MAX_FILE_SIZE;
  private readonly WARNING_FILE_SIZE = WARNING_FILE_SIZE;
  private readonly MAX_STORAGE_TIME = MAX_STORAGE_TIME;
  
  // SessionStorage fallback limits
  private readonly SESSION_MAX_FILE_SIZE = SESSION_MAX_FILE_SIZE;

  /**
   * Initialize the IndexedDB database
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new FileStorageError(
          'Failed to open database',
          'STORAGE_UNAVAILABLE',
          request.error || undefined
        ));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * Check if storage is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.initDB();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage estimate
   */
  async getStorageEstimate(): Promise<{ quota: number; usage: number; available: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          quota: estimate.quota || 0,
          usage: estimate.usage || 0,
          available: (estimate.quota || 0) - (estimate.usage || 0)
        };
      } catch (error) {
        console.warn('Failed to get storage estimate:', error);
      }
    }
    return null;
  }

  /**
   * Check if a file can be stored
   */
  async canStoreFile(fileSize: number): Promise<{ canStore: boolean; warning?: string; error?: string; errorCode?: string }> {
    // Check file size limits
    if (fileSize > this.MAX_FILE_SIZE) {
      return {
        canStore: false,
        error: `File size (${this.formatBytes(fileSize)}) exceeds maximum limit of ${this.formatBytes(this.MAX_FILE_SIZE)}`,
        errorCode: 'FILE_TOO_LARGE'
      };
    }

    // Check available storage
    const estimate = await this.getStorageEstimate();
    if (estimate && fileSize > estimate.available * 0.9) { // Leave 10% buffer
      return {
        canStore: false,
        error: `Not enough storage space. File needs ${this.formatBytes(fileSize)} but only ${this.formatBytes(estimate.available)} is available`,
        errorCode: 'QUOTA_EXCEEDED'
      };
    }

    // Warning for large files
    if (fileSize > this.WARNING_FILE_SIZE) {
      return {
        canStore: true,
        warning: `Large file (${this.formatBytes(fileSize)}) will use significant storage space`
      };
    }

    return { canStore: true };
  }

  /**
   * Store a file in IndexedDB with sessionStorage fallback
   */
  async storeFile(file: File, id?: string): Promise<{ success: boolean; id?: string; error?: FileStorageError }> {
    try {
      // Check if file can be stored
      const storageCheck = await this.canStoreFile(file.size);
      
      if (!storageCheck.canStore) {
        // Use the errorCode from canStoreFile, fallback to FILE_TOO_LARGE if absent
        const errorCode = (storageCheck.errorCode as 'QUOTA_EXCEEDED' | 'FILE_TOO_LARGE') || 'FILE_TOO_LARGE';
        
        const error = new FileStorageError(
          storageCheck.error || 'File cannot be stored',
          errorCode
        );
        
        // Determine toast title based on error code
        const toastTitle = storageCheck.errorCode === 'QUOTA_EXCEEDED' ? 'Quota Exceeded' : 'File Too Large';
        
        toastStore.error(toastTitle, storageCheck.error || 'File cannot be stored');
        return { success: false, error };
      }

      // Show warning for large files
      if (storageCheck.warning) {
        toastStore.warning('Large File', storageCheck.warning);
      }

      // Generate fileId and convert to ArrayBuffer early for potential fallback
      const fileId = id || crypto.randomUUID();
      const arrayBuffer = await file.arrayBuffer();

      // Try IndexedDB first
      let db: IDBDatabase;
      try {
        db = await this.initDB();
      } catch (initError) {
        // IndexedDB initialization failed, try sessionStorage fallback
        console.warn('IndexedDB unavailable, attempting sessionStorage fallback:', initError);
        return this.storeInSessionStorage(file, arrayBuffer, fileId);
      }
      
      const fileData: StoredFileData = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        data: arrayBuffer,
        timestamp: Date.now()
      };

      // Store in IndexedDB with quota error handling
      return this.putFileWithQuotaHandling(db, fileData, file, fileId);
    } catch (error) {
      const storageError = new FileStorageError(
        'Unexpected error while storing file',
        'UNKNOWN',
        error as Error
      );
      
      toastStore.error('Storage Error', 'An unexpected error occurred. Please try again.');
      return { success: false, error: storageError };
    }
  }

  /**
   * Store file in sessionStorage as fallback when IndexedDB is unavailable
   */
  private storeInSessionStorage(
    file: File, 
    arrayBuffer: ArrayBuffer, 
    fileId: string
  ): { success: boolean; id: string; error?: FileStorageError } {
    // Check if file fits within sessionStorage limits
    if (file.size > this.SESSION_MAX_FILE_SIZE) {
      const error = new FileStorageError(
        `File size (${this.formatBytes(file.size)}) exceeds sessionStorage limit of ${this.formatBytes(this.SESSION_MAX_FILE_SIZE)}`,
        'FILE_TOO_LARGE'
      );
      
      toastStore.error('File Too Large', error.message);
      return { success: false, id: fileId, error };
    }

    try {
      // Convert ArrayBuffer to base64 for storage
      const uint8Array = new Uint8Array(arrayBuffer);
      const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
      const base64Data = btoa(binaryString);
      
      const sessionData = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64Data,
        timestamp: Date.now()
      };
      
      const sessionKey = `session_file_${fileId}`;
      sessionStorage.setItem(sessionKey, JSON.stringify(sessionData));
      
      console.log(`Successfully stored file "${file.name}" (${this.formatBytes(file.size)}) in sessionStorage`);
      
      toastStore.warning(
        'Limited Storage',
        `${file.name} stored temporarily. File will be lost when tab is closed.`
      );
      
      return { success: true, id: fileId };
    } catch (error) {
      const storageError = new FileStorageError(
        'Failed to store file in sessionStorage',
        'STORAGE_UNAVAILABLE',
        error as Error
      );
      
      toastStore.error('Storage Failed', 'Could not store file temporarily. Please try again.');
      return { success: false, id: fileId, error: storageError };
    }
  }

  /**
   * Helper method to put a file in IndexedDB with quota error handling
   * Includes handling for QuotaExceededError and retry logic
   */
  private async putFileWithQuotaHandling(
    db: IDBDatabase, 
    fileData: StoredFileData, 
    file: File, 
    fileId: string, 
    isRetry: boolean = false
  ): Promise<{ success: boolean; id?: string; error?: FileStorageError }> {
    return new Promise((resolve) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(fileData);

      // Track whether we've already resolved the promise
      let isResolved = false;

      // Ensure we only resolve once and after transaction completes
      const safeResolve = (result: { success: boolean; id?: string; error?: FileStorageError }) => {
        if (!isResolved) {
          isResolved = true;
          resolve(result);
        }
      };

      // Handle successful put operation
      request.onsuccess = () => {
        // Wait for transaction to complete before resolving
        transaction.oncomplete = () => {
          console.log(`Successfully stored file "${file.name}" (${this.formatBytes(file.size)}) in IndexedDB`);
          
          toastStore.success(
            'File Uploaded',
            `${file.name} (${this.formatBytes(file.size)}) ready for processing`
          );
          
          safeResolve({ success: true, id: fileId });
        };
      };

      // Handle quota exceeded errors
      const handleQuotaError = async (err: DOMException | null | undefined) => {
        if (isRetry) {
          // We already tried once, don't retry again
          const error = new FileStorageError(
            'Storage quota exceeded after cleanup attempt',
            'QUOTA_EXCEEDED',
            err as Error
          );
          
          toastStore.error(
            'Storage Full', 
            'Not enough storage space available. Please free up browser storage or use smaller files.'
          );
          
          safeResolve({ success: false, error });
          return;
        }

        // Abort current transaction
        try {
          transaction.abort();
        } catch (e) {
          console.warn('Failed to abort transaction:', e);
        }

        // Try to clean up old files
        console.log('Storage quota exceeded. Attempting cleanup...');
        const cleanedCount = await this.cleanupOldFiles();
        console.log(`Cleaned up ${cleanedCount} old files`);
        
        if (cleanedCount > 0) {
          // Retry the operation once with the isRetry flag set
          const retryResult = await this.putFileWithQuotaHandling(db, fileData, file, fileId, true);
          safeResolve(retryResult);
        } else {
          // No files were cleaned up, likely still out of space
          const error = new FileStorageError(
            'Storage quota exceeded and no files available for cleanup',
            'QUOTA_EXCEEDED',
            err as Error
          );
          
          toastStore.error(
            'Storage Full', 
            'Not enough storage space available. Please free up browser storage or use smaller files.'
          );
          
          safeResolve({ success: false, error });
        }
      };

      // Handle errors in the request
      request.onerror = () => {
        const err = request.error;
        
        // Check for quota errors
        if (err && (
          err.name === 'QuotaExceededError' || 
          (err instanceof DOMException && err.code === 22) || // QUOTA_EXCEEDED_ERR
          err.message?.includes('quota')
        )) {
          handleQuotaError(err);
        } else {
          // Handle other errors
          transaction.abort();
          const error = new FileStorageError(
            'Failed to store file in database',
            'UNKNOWN',
            err || undefined
          );
          
          toastStore.error('Storage Failed', 'Could not store file. Please try again.');
          safeResolve({ success: false, error });
        }
      };

      // Handle transaction errors
      transaction.onerror = () => {
        const err = transaction.error;
        
        // Check for quota errors
        if (err && (
          err.name === 'QuotaExceededError' || 
          (err instanceof DOMException && err.code === 22) || // QUOTA_EXCEEDED_ERR
          err.message?.includes('quota')
        )) {
          handleQuotaError(err);
        } else {
          const error = new FileStorageError(
            'Database transaction failed',
            'UNKNOWN',
            err || undefined
          );
          
          toastStore.error('Storage Failed', 'Database error occurred. Please try again.');
          safeResolve({ success: false, error });
        }
      };
    });
  }

  /**
   * Retrieve a file from IndexedDB with sessionStorage fallback
   */
  async retrieveFile(id: string, autoDelete: boolean = true): Promise<{ success: boolean; file?: File; error?: FileStorageError }> {
    // Try IndexedDB first
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], autoDelete ? 'readwrite' : 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result as StoredFileData | undefined;
          
          if (!result) {
            // Not found in IndexedDB, try sessionStorage fallback
            const sessionResult = this.retrieveFromSessionStorage(id, autoDelete);
            resolve(sessionResult);
            return;
          }

          // Create File object from stored data
          const file = new File([result.data], result.name, {
            type: result.type,
            lastModified: result.timestamp
          });

          // Auto-delete after retrieval if requested
          if (autoDelete) {
            store.delete(id);
          }

          console.log(`Retrieved file "${result.name}" from IndexedDB`);
          resolve({ success: true, file });
        };

        request.onerror = () => {
          // IndexedDB error, try sessionStorage fallback
          const sessionResult = this.retrieveFromSessionStorage(id, autoDelete);
          resolve(sessionResult);
        };
      });

    } catch (error) {
      // IndexedDB unavailable, try sessionStorage fallback
      console.warn('IndexedDB unavailable for retrieval, trying sessionStorage:', error);
      return this.retrieveFromSessionStorage(id, autoDelete);
    }
  }

  /**
   * Retrieve file from sessionStorage as fallback
   */
  private retrieveFromSessionStorage(
    id: string, 
    autoDelete: boolean = true
  ): { success: boolean; file?: File; error?: FileStorageError } {
    try {
      const sessionKey = `session_file_${id}`;
      const sessionDataJson = sessionStorage.getItem(sessionKey);
      
      if (!sessionDataJson) {
        const error = new FileStorageError(
          'File not found in storage',
          'NOT_FOUND'
        );
        return { success: false, error };
      }
      
      const sessionData = JSON.parse(sessionDataJson);
      
      // Convert base64 back to ArrayBuffer
      const binaryString = atob(sessionData.data);
      const uint8Array = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
      }
      
      const file = new File([uint8Array], sessionData.name, {
        type: sessionData.type,
        lastModified: sessionData.timestamp
      });
      
      // Auto-delete after retrieval if requested
      if (autoDelete) {
        sessionStorage.removeItem(sessionKey);
      }
      
      console.log(`Retrieved file "${sessionData.name}" from sessionStorage`);
      return { success: true, file };
    } catch (error) {
      const storageError = new FileStorageError(
        'Failed to retrieve file from sessionStorage',
        'UNKNOWN',
        error as Error
      );
      
      return { success: false, error: storageError };
    }
  }

  /**
   * Clean up old files from storage
   */
  async cleanupOldFiles(maxAgeMs: number = this.MAX_STORAGE_TIME): Promise<number> {
    try {
      const db = await this.initDB();
      const cutoffTime = Date.now() - maxAgeMs;

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('timestamp');
        
        let deletedCount = 0;
        
        // Get all files older than cutoff time
        const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));
        
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            deletedCount++;
            cursor.continue();
          } else {
            // Done processing
            if (deletedCount > 0) {
              console.log(`Cleaned up ${deletedCount} old files from storage`);
            }
            resolve(deletedCount);
          }
        };

        request.onerror = () => {
          console.warn('Error during cleanup:', request.error);
          resolve(0);
        };
      });

    } catch (error) {
      console.warn('Failed to cleanup old files:', error);
      return 0;
    }
  }

  /**
   * Get all stored files info
   */
  async listFiles(): Promise<Array<Omit<StoredFileData, 'data'>>> {
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const files = (request.result as StoredFileData[]).map(({ data, ...rest }) => rest);
          resolve(files);
        };

        request.onerror = () => {
          console.warn('Failed to list files:', request.error);
          resolve([]);
        };
      });

    } catch (error) {
      console.warn('Failed to list files:', error);
      return [];
    }
  }

  /**
   * Clear all stored files
   */
  async clearAll(): Promise<boolean> {
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('Cleared all stored files');
          resolve(true);
        };

        request.onerror = () => {
          console.warn('Failed to clear files:', request.error);
          resolve(false);
        };
      });

    } catch (error) {
      console.warn('Failed to clear files:', error);
      return false;
    }
  }

  /**
   * Format bytes for human-readable display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Initialize cleanup interval
   */
  startAutoCleanup(intervalMs: number = 30 * 60 * 1000): () => void { // Default: 30 minutes
    const cleanup = async () => {
      const cleaned = await this.cleanupOldFiles();
      if (cleaned > 0) {
        console.log(`Auto-cleanup: removed ${cleaned} old files`);
      }
    };

    // Run initial cleanup
    cleanup();

    // Set up interval
    const intervalId = setInterval(cleanup, intervalMs);

    // Return cleanup function
    return () => clearInterval(intervalId);
  }
}

// Export singleton instance
export const fileStorage = new FileStorageManager();

// Convenience functions
export async function storeUploadedFile(file: File): Promise<{ success: boolean; id?: string; error?: FileStorageError }> {
  return fileStorage.storeFile(file);
}

export async function retrieveUploadedFile(id: string): Promise<{ success: boolean; file?: File; error?: FileStorageError }> {
  return fileStorage.retrieveFile(id);
}

export async function cleanupOldUploads(): Promise<number> {
  return fileStorage.cleanupOldFiles();
}

export async function isFileStorageAvailable(): Promise<boolean> {
  return fileStorage.isAvailable();
}
