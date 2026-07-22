/**
 * Client-side IndexedDB caching utility for generated scenes and images.
 * This avoids the 5MB size limitation of localStorage.
 */

export interface CacheEntry {
  key: string;          // Composite key
  bookHash: string;     // Book identifier (hash or name)
  currentPage: number;  // Current page
  textHash: string;     // Hash of the extracted text window
  sceneJson: any;       // Extracted Scene JSON
  selectedStyle: string;// Art style
  imageUrl: string;     // Generated image URL (base64 data URL)
  generatedAt: number;  // Timestamp
}

const DB_NAME = 'AIBookVisualizerCache';
const DB_VERSION = 1;
const STORE_NAME = 'images';

/**
 * Helper to compute a simple hash string from text
 */
export function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return '0';
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Helper to generate a composite cache key
 */
export function generateCacheKey(
  bookHash: string,
  currentPage: number,
  text: string,
  style: string
): string {
  const textHash = hashString(text);
  return `${bookHash}::p${currentPage}::s${style}::t${textHash}`;
}

export class ImageCache {
  private static db: IDBDatabase | null = null;

  private static getDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Retrieves an image from cache
   */
  public static async get(key: string): Promise<CacheEntry | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (e) {
      console.warn('Cache retrieval failed:', e);
      return null;
    }
  }

  /**
   * Saves an image and its metadata into the cache
   */
  public static async set(entry: CacheEntry): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(entry);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
  }

  /**
   * Clears the entire cache for a book
   */
  public static async clearForBook(bookHash: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = request.result;
          if (cursor) {
            const entry = cursor.value as CacheEntry;
            if (entry.bookHash === bookHash) {
              store.delete(cursor.key);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (e) {
      console.warn('Cache clearance failed:', e);
    }
  }

  /**
   * Get all cached scenes for a specific book
   */
  public static async getAllForBook(bookHash: string): Promise<CacheEntry[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();
        const results: CacheEntry[] = [];

        request.onsuccess = (event) => {
          const cursor = request.result;
          if (cursor) {
            const entry = cursor.value as CacheEntry;
            if (entry.bookHash === bookHash) {
              results.push(entry);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (e) {
      console.warn('Cache list fetch failed:', e);
      return [];
    }
  }
}
