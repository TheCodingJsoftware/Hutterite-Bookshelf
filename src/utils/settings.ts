export class SettingsManager {
    private readonly dbName: string = 'AppSettings';
    private readonly storeName: string = 'settings';
    private readonly version: number = 1;
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void>;

    constructor() {
        this.initPromise = this.initDB();
    }

    private async initDB(): Promise<void> {
        if (this.db) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('Failed to open settings database'));
            };

            request.onsuccess = (event) => {
                this.db = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                }
            };
        });
    }

    private getStore(mode: IDBTransactionMode): IDBObjectStore {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        const transaction = this.db.transaction(this.storeName, mode);
        return transaction.objectStore(this.storeName);
    }

    async saveSetting<T>(key: string, value: T): Promise<void> {
        await this.initPromise;

        return new Promise((resolve, reject) => {
            try {
                const store = this.getStore('readwrite');
                const request = store.put({ key, value });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(`Failed to save setting: ${key}`));
            } catch (error) {
                reject(error);
            }
        });
    }

    async getSetting<T>(key: string, defaultValue?: T): Promise<T | undefined> {
        await this.initPromise;

        return new Promise((resolve, reject) => {
            try {
                const store = this.getStore('readonly');
                const request = store.get(key);

                request.onsuccess = () => {
                    const result = request.result;
                    resolve(result ? result.value : defaultValue);
                };

                request.onerror = () => reject(new Error(`Failed to get setting: ${key}`));
            } catch (error) {
                reject(error);
            }
        });
    }

    async deleteSetting(key: string): Promise<void> {
        await this.initPromise;

        return new Promise((resolve, reject) => {
            try {
                const store = this.getStore('readwrite');
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(`Failed to delete setting: ${key}`));
            } catch (error) {
                reject(error);
            }
        });
    }

    async clearAllSettings(): Promise<void> {
        await this.initPromise;

        return new Promise((resolve, reject) => {
            try {
                const store = this.getStore('readwrite');
                const request = store.clear();

                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('Failed to clear settings'));
            } catch (error) {
                reject(error);
            }
        });
    }
}