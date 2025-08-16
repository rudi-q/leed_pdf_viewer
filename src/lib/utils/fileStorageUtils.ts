/**
 * File storage utility using IndexedDB for large PDF files
 * Provides better storage capacity and graceful error handling
 */

import { toastStore } from '$lib/stores/toastStore';

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

  // File size limits
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly WARNING_FILE_SIZE = 15 * 1024 * 1024; // 15MB
  private readonly MAX_STORAGE_TIME = 2 * 60 * 60 * 1000; // 2 hours

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
  async canStoreFile(fileSize: number): Promise<{ canStore: boolean; warning?: string; error?: string }> {
    // Check file size limits
    if (fileSize > this.MAX_FILE_SIZE) {
      return {
        canStore: false,
        error: `File size (${this.formatBytes(fileSize)}) exceeds maximum limit of ${this.formatBytes(this.MAX_FILE_SIZE)}`
      };
    }

    // Check available storage
    const estimate = await this.getStorageEstimate();
    if (estimate && fileSize > estimate.available * 0.9) { // Leave 10% buffer
      return {
        canStore: false,
        error: `Not enough storage space. File needs ${this.formatBytes(fileSize)} but only ${this.formatBytes(estimate.available)} is available`
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
   * Store a file in IndexedDB
   */
  async storeFile(file: File, id?: string): Promise<{ success: boolean; id?: string; error?: FileStorageError }> {
    try {
      // Check if file can be stored
      const storageCheck = await this.canStoreFile(file.size);
      
      if (!storageCheck.canStore) {
        const error = new FileStorageError(
          storageCheck.error || 'File cannot be stored',
          'FILE_TOO_LARGE'
        );
        
        toastStore.error('File Too Large', storageCheck.error || 'File cannot be stored');
        return { success: false, error };
      }

      // Show warning for large files
      if (storageCheck.warning) {
        toastStore.warning('Large File', storageCheck.warning);
      }

      const db = await this.initDB();
      const fileId = id || crypto.randomUUID();
      
      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
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
   * Retrieve a file from IndexedDB
   */
  async retrieveFile(id: string, autoDelete: boolean = true): Promise<{ success: boolean; file?: File; error?: FileStorageError }> {
    try {
      const db = await this.initDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], autoDelete ? 'readwrite' : 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(id);

        request.onsuccess = () => {
          const result = request.result as StoredFileData | undefined;
          
          if (!result) {
            const error = new FileStorageError(
              'File not found in storage',
              'NOT_FOUND'
            );
            resolve({ success: false, error });
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
          const error = new FileStorageError(
            'Failed to retrieve file from database',
            'UNKNOWN',
            request.error || undefined
          );
          resolve({ success: false, error });
        };
      });

    } catch (error) {
      const storageError = new FileStorageError(
        'Unexpected error while retrieving file',
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
