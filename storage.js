/**
 * Big Daddy Events - Storage Provider Abstraction
 * 
 * Provides a provider-independent interface for file storage.
 * - LocalStorageProvider: Serves files from public/assets/uploads (Default for local development)
 * - CloudStorageProvider: Prepared interface for S3 / Cloudflare R2 / GCS in production
 */

const fs = require('fs');
const path = require('path');

class StorageProvider {
    /**
     * Upload / persist a file
     * @param {Object} file - File object (from Multer or memory buffer)
     * @returns {Promise<{ key: string, publicUrl: string }>}
     */
    async upload(file) {
        throw new Error('upload() must be implemented by storage provider');
    }

    /**
     * Delete a stored file safely
     * @param {string} keyOrUrl - Stored file key or public URL
     * @returns {Promise<boolean>}
     */
    async delete(keyOrUrl) {
        throw new Error('delete() must be implemented by storage provider');
    }

    /**
     * Generate or resolve public URL for a stored file
     * @param {string} key - File key or relative path
     * @returns {string}
     */
    getPublicUrl(key) {
        throw new Error('getPublicUrl() must be implemented by storage provider');
    }
}

class LocalStorageProvider extends StorageProvider {
    constructor(options = {}) {
        super();
        this.uploadDir = options.uploadDir || path.resolve(__dirname, 'public', 'assets', 'uploads');
        this.publicPathPrefix = options.publicPathPrefix || 'assets/uploads/';
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    async upload(file) {
        if (!file) throw new Error('No file provided for upload');
        // When using Multer diskStorage, the file is already placed in uploadDir
        const filename = file.filename || path.basename(file.path);
        const relativeKey = `${this.publicPathPrefix}${filename}`;
        return {
            key: relativeKey,
            publicUrl: this.getPublicUrl(relativeKey)
        };
    }

    async delete(keyOrUrl) {
        if (!keyOrUrl || typeof keyOrUrl !== 'string') return false;
        
        // Strip any query strings or domain prefixes
        const cleanPath = keyOrUrl.replace(/^https?:\/\/[^\/]+\//i, '').replace(/^\//, '');
        const targetPath = path.resolve(__dirname, 'public', cleanPath);

        // Strict Path Traversal Defense: Must be confined within uploadDir
        if (!targetPath.startsWith(this.uploadDir + path.sep)) {
            return false;
        }

        return new Promise((resolve) => {
            fs.unlink(targetPath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('[STORAGE] Error unlinking local file:', err.message);
                    return resolve(false);
                }
                resolve(true);
            });
        });
    }

    getPublicUrl(key) {
        if (!key) return '';
        if (/^https?:\/\//i.test(key)) return key;
        return key.startsWith('/') ? key : `/${key}`;
    }
}

class CloudStorageProvider extends StorageProvider {
    constructor(options = {}) {
        super();
        this.bucket = options.bucket || process.env.STORAGE_BUCKET;
        this.region = options.region || process.env.STORAGE_REGION;
        this.endpoint = options.endpoint || process.env.STORAGE_ENDPOINT;
        this.cdnBaseUrl = options.cdnBaseUrl || process.env.STORAGE_CDN_URL;
    }

    async upload(file) {
        // Prepared placeholder for production cloud object store (e.g. AWS S3 / Cloudflare R2 / GCS)
        throw new Error('CloudStorageProvider is not yet active. Configure cloud credentials during production deployment.');
    }

    async delete(keyOrUrl) {
        // Prepared placeholder for cloud object deletion
        throw new Error('CloudStorageProvider is not yet active. Configure cloud credentials during production deployment.');
    }

    getPublicUrl(key) {
        if (!key) return '';
        if (/^https?:\/\//i.test(key)) return key;
        if (this.cdnBaseUrl) {
            return `${this.cdnBaseUrl.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
        }
        return `https://${this.bucket}.${this.endpoint}/${key.replace(/^\/+/, '')}`;
    }
}

function createStorageProvider() {
    const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    if (provider === 'cloud') {
        console.log('[STORAGE] Initializing CloudStorageProvider...');
        return new CloudStorageProvider();
    }
    return new LocalStorageProvider();
}

module.exports = {
    StorageProvider,
    LocalStorageProvider,
    CloudStorageProvider,
    storage: createStorageProvider()
};
