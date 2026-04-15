/// <reference types="gapi" />
/// <reference types="gapi.client.drive" />

// Extend Window interface to include google property
declare global {
    interface Window {
        google: any;
        gapi: typeof gapi;
    }
}

const FALLBACK_GOOGLE_CLIENT_ID = '108421532744-dcb911h9go7p3abunl0qe3jkd32v61c3.apps.googleusercontent.com';
const FALLBACK_GOOGLE_API_KEY = 'AIzaSyCw87RLNiLF5MAo2JIpbmkX7nGfz7vhJuA';
const runtimeConfig = (globalThis as any).__FLASHCARDSISH_CONFIG__ ?? {};
const CLIENT_ID = String(
    runtimeConfig.googleClientId ??
    import.meta.env.VITE_GOOGLE_CLIENT_ID ??
    FALLBACK_GOOGLE_CLIENT_ID
).trim();
const API_KEY = String(
    runtimeConfig.googleApiKey ??
    import.meta.env.VITE_GOOGLE_API_KEY ??
    FALLBACK_GOOGLE_API_KEY
).trim();
// Need both Drive access and user info access
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

const TOKEN_KEY = 'flashcardsish-google-token';
const USER_KEY = 'flashcardsish-google-user';
const TOKEN_EXPIRY_KEY = 'flashcardsish-google-token-expiry';
const USER_JOINED_AT_MAP_KEY = 'flashcardsish-user-joined-at-map';
const LAST_ACTIVE_KEY = 'flashcardsish-google-last-active';
const REMEMBERED_SESSION_MAX_IDLE_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVITY_WRITE_THROTTLE_MS = 5 * 60 * 1000;

export interface GoogleDriveUser {
    id: string;
    email: string;
    name: string;
    picture?: string;
    joinedAt?: string;
}

export class DriveConflictError extends Error {
    code = 'CLOUD_CONFLICT';
    filename: string;
    expectedModifiedTime: string;
    actualModifiedTime: string;

    constructor(filename: string, expectedModifiedTime: string, actualModifiedTime: string) {
        super(`Cloud version changed for ${filename}. Please choose whether to keep cloud data or overwrite it.`);
        this.name = 'DriveConflictError';
        this.filename = filename;
        this.expectedModifiedTime = expectedModifiedTime;
        this.actualModifiedTime = actualModifiedTime;
    }
}

interface WriteFileOptions {
    ignoreConflicts?: boolean;
}

class GoogleDriveClient {
    private accessToken: string | null = null;
    private tokenClient: any = null;
    private gapiInitialized = false;
    private gisInitialized = false;
    private fileModifiedAtCache = new Map<string, string>();
    private authChangeCallbacks: Array<(user: GoogleDriveUser | null) => void> = [];
    private currentUser: GoogleDriveUser | null = null;
    private rememberSession = true;
    private rememberedEmailHint: string | null = null;
    private activityTrackingInitialized = false;
    private lastActivityWriteAt = 0;

    private isValidDateString(value: unknown): value is string {
        return typeof value === 'string' && !Number.isNaN(Date.parse(value));
    }

    private readJoinedAtMap(): Record<string, string> {
        try {
            const raw = localStorage.getItem(USER_JOINED_AT_MAP_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const map: Record<string, string> = {};
            for (const [key, value] of Object.entries(parsed)) {
                if (this.isValidDateString(value)) {
                    map[key] = value;
                }
            }
            return map;
        } catch {
            return {};
        }
    }

    private writeJoinedAtMap(map: Record<string, string>): void {
        try {
            localStorage.setItem(USER_JOINED_AT_MAP_KEY, JSON.stringify(map));
        } catch {
            // Ignore storage failures (private browsing, quota, etc.)
        }
    }

    private readJoinedAtFromCachedUser(storage: Storage, userId: string, normalizedEmail: string): string | null {
        try {
            const raw = storage.getItem(USER_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as Partial<GoogleDriveUser>;
            const parsedId = typeof parsed.id === 'string' ? parsed.id : '';
            const parsedEmail =
                typeof parsed.email === 'string'
                    ? parsed.email.trim().toLowerCase()
                    : '';
            const sameUser = (parsedId && parsedId === userId) || (parsedEmail && parsedEmail === normalizedEmail);
            if (sameUser && this.isValidDateString(parsed.joinedAt)) {
                return parsed.joinedAt;
            }
            return null;
        } catch {
            return null;
        }
    }

    private resolveJoinedAt(userId: string, email: string): string {
        const normalizedEmail = email.trim().toLowerCase();
        const map = this.readJoinedAtMap();
        const candidates: Array<string | null | undefined> = [
            this.currentUser?.id === userId ? this.currentUser.joinedAt : null,
            this.readJoinedAtFromCachedUser(localStorage, userId, normalizedEmail),
            this.readJoinedAtFromCachedUser(sessionStorage, userId, normalizedEmail),
            map[userId],
            map[normalizedEmail]
        ];
        const existing = candidates.find(candidate => this.isValidDateString(candidate)) ?? null;
        const joinedAt = existing ?? new Date().toISOString();
        if (userId) map[userId] = joinedAt;
        if (normalizedEmail) map[normalizedEmail] = joinedAt;
        this.writeJoinedAtMap(map);
        return joinedAt;
    }

    private validateGoogleConfig(): void {
        if (!CLIENT_ID) {
            throw new Error('Google OAuth client ID is missing. Set VITE_GOOGLE_CLIENT_ID.');
        }
        if (!API_KEY) {
            throw new Error('Google API key is missing. Set VITE_GOOGLE_API_KEY.');
        }
    }

    async init(): Promise<void> {
        if (this.gapiInitialized && this.gisInitialized) return;

        // console.log('[GoogleDrive] Starting initialization...');
        this.validateGoogleConfig();

        // 1. Try to restore session from localStorage first
        this.restoreSession();

        await this.initGapi();
        await this.initGis();
        this.initActivityTracking();

        // 2. If we restored a token, verify it and set up GAPI
        if (this.accessToken) {
            this.setAuthToken();
            const status = await this.fetchUserInfo();
            if (status === 'unauthorized') {
                const recovered = this.hasRememberedSessionHint()
                    ? await this.trySilentSignIn()
                    : false;
                if (!recovered) {
                    this.finalizeSignedOutState();
                }
            }
        } else if (this.hasRememberedSessionHint()) {
            const recovered = await this.trySilentSignIn();
            if (!recovered) {
                this.finalizeSignedOutState();
            }
        }

        // console.log('[GoogleDrive] Initialization complete');
    }

    private restoreSession(): void {
        const restored = this.restoreFromStorage(localStorage) || this.restoreFromStorage(sessionStorage);
        if (!restored) {
            // Keep remembered local user metadata so we can attempt silent token refresh.
            this.clearStorage({ preserveLocalUser: true });
        }
    }

    private restoreFromStorage(storage: Storage): boolean {
        const token = storage.getItem(TOKEN_KEY);
        const expiry = storage.getItem(TOKEN_EXPIRY_KEY);
        const userJson = storage.getItem(USER_KEY);
        const lastActiveRaw = storage.getItem(LAST_ACTIVE_KEY);

        if (userJson) {
            try {
                const parsedUser = JSON.parse(userJson) as Partial<GoogleDriveUser>;
                if (typeof parsedUser.email === 'string' && parsedUser.email.trim()) {
                    this.rememberedEmailHint = parsedUser.email.trim();
                }
            } catch {
                // ignore malformed user cache
            }
        }

        if (!token || !expiry) {
            return false;
        }

        if (storage === localStorage && this.isRememberedSessionIdleExpired(lastActiveRaw)) {
            console.warn('[GoogleDrive] Remembered session expired from inactivity');
            this.clearStorage({ preserveLocalUser: false });
            return false;
        }

        const now = Date.now();
        const expiryMs = Number.parseInt(expiry, 10);
        if (!Number.isFinite(expiryMs) || now >= expiryMs) {
            console.warn('[GoogleDrive] Stored token expired');
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(TOKEN_EXPIRY_KEY);
            return false;
        }

        this.accessToken = token;
        this.rememberSession = storage === localStorage;
        if (userJson) {
            try {
                this.currentUser = JSON.parse(userJson);
                // Trigger callbacks early for smoother UI transition
                this.authChangeCallbacks.forEach(cb => cb(this.currentUser));
            } catch (e) { }
        }
        this.touchSessionActivity(storage, true);
        return true;
    }

    private clearStorage(options: { preserveLocalUser?: boolean } = {}): void {
        const { preserveLocalUser = false } = options;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        if (!preserveLocalUser) {
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(LAST_ACTIVE_KEY);
        }
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
        sessionStorage.removeItem(LAST_ACTIVE_KEY);
        sessionStorage.removeItem(USER_KEY);
        this.fileModifiedAtCache.clear();
    }

    private hasRememberedSessionHint(): boolean {
        const hasHint = !!localStorage.getItem(USER_KEY);
        if (!hasHint) return false;
        if (this.isRememberedSessionIdleExpired(localStorage.getItem(LAST_ACTIVE_KEY))) {
            console.warn('[GoogleDrive] Remembered session hint expired from inactivity');
            this.clearStorage({ preserveLocalUser: false });
            return false;
        }
        return true;
    }

    private isRememberedSessionIdleExpired(lastActiveRaw: string | null): boolean {
        if (!lastActiveRaw) {
            return false;
        }
        const lastActive = Number.parseInt(lastActiveRaw, 10);
        if (!Number.isFinite(lastActive)) {
            return false;
        }
        return (Date.now() - lastActive) > REMEMBERED_SESSION_MAX_IDLE_MS;
    }

    private getSessionStorage(): Storage {
        return this.rememberSession ? localStorage : sessionStorage;
    }

    private touchSessionActivity(storage: Storage = this.getSessionStorage(), force = false): void {
        const now = Date.now();
        if (!force && now - this.lastActivityWriteAt < ACTIVITY_WRITE_THROTTLE_MS) {
            return;
        }
        storage.setItem(LAST_ACTIVE_KEY, now.toString());
        this.lastActivityWriteAt = now;
    }

    private initActivityTracking(): void {
        if (this.activityTrackingInitialized || typeof window === 'undefined') {
            return;
        }

        const markActive = () => {
            if (!this.accessToken && !this.currentUser) {
                return;
            }
            this.touchSessionActivity();
        };

        window.addEventListener('pointerdown', markActive, { passive: true });
        window.addEventListener('keydown', markActive);
        window.addEventListener('focus', markActive);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                markActive();
            }
        });

        this.activityTrackingInitialized = true;
    }

    private finalizeSignedOutState(): void {
        this.accessToken = null;
        this.currentUser = null;
        this.rememberedEmailHint = null;
        this.clearStorage();

        if (this.gapiInitialized) {
            window.gapi.client.setToken(null);
        }

        this.authChangeCallbacks.forEach(cb => cb(null));
    }

    private async processTokenResponse(response: any): Promise<boolean> {
        if (response.error) {
            console.error('[GoogleDrive] Token error:', response.error);
            return false;
        }

        this.accessToken = response.access_token;

        const storage = this.rememberSession ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEY, this.accessToken!);
        const expiresInSeconds =
            typeof response.expires_in === 'number' && Number.isFinite(response.expires_in) && response.expires_in > 0
                ? response.expires_in
                : 3600;
        const expiryTime = Date.now() + (expiresInSeconds * 1000) - (60 * 1000); // 1 minute buffer
        storage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
        this.touchSessionActivity(storage, true);

        this.setAuthToken();
        const status = await this.fetchUserInfo();
        return status === 'ok';
    }

    private async requestAccessTokenWithPrompt(prompt: '' | 'select_account'): Promise<boolean> {
        if (!this.tokenClient) {
            return false;
        }

        return new Promise((resolve) => {
            const originalCallback = this.tokenClient.callback;
            this.tokenClient.callback = async (response: any) => {
                this.tokenClient.callback = originalCallback;
                try {
                    const success = await this.processTokenResponse(response);
                    resolve(success);
                } catch (error) {
                    console.error('[GoogleDrive] Token handling failed:', error);
                    resolve(false);
                }
            };

            try {
                const request: { prompt: '' | 'select_account'; login_hint?: string } = { prompt };
                if (prompt === '' && this.rememberedEmailHint) {
                    request.login_hint = this.rememberedEmailHint;
                }
                this.tokenClient.requestAccessToken(request);
            } catch (error) {
                this.tokenClient.callback = originalCallback;
                console.error('[GoogleDrive] Failed to request access token:', error);
                resolve(false);
            }
        });
    }

    private async trySilentSignIn(): Promise<boolean> {
        this.rememberSession = true;
        return this.requestAccessTokenWithPrompt('');
    }

    private getFileCacheKey(folderId: string, filename: string): string {
        return `${folderId}::${filename}`;
    }

    private cacheFileModifiedTime(folderId: string, filename: string, modifiedTime?: string | null): void {
        const cacheKey = this.getFileCacheKey(folderId, filename);
        if (modifiedTime) {
            this.fileModifiedAtCache.set(cacheKey, modifiedTime);
        } else {
            this.fileModifiedAtCache.delete(cacheKey);
        }
    }

    private async initGapi(): Promise<void> {
        if (this.gapiInitialized) {
            return;
        }

        return new Promise((resolve, reject) => {
            if (typeof window.gapi === 'undefined') {
                const error = new Error('GAPI not loaded. Check script tag.');
                console.error('[GoogleDrive] Error:', error.message);
                reject(error);
                return;
            }

            window.gapi.load('client', async () => {
                try {
                    if (!API_KEY) {
                        throw new Error('Google API key is missing. Set VITE_GOOGLE_API_KEY.');
                    }
                    await window.gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });
                    this.gapiInitialized = true;
                    // console.log('[GoogleDrive] GAPI initialized');
                    resolve();
                } catch (error) {
                    console.error('[GoogleDrive] GAPI init failed:', error);
                    reject(error);
                }
            });
        });
    }

    private async initGis(): Promise<void> {
        if (this.gisInitialized) {
            return;
        }

        return new Promise((resolve) => {
            if (typeof window.google === 'undefined') {
                console.warn('[GoogleDrive] GIS not loaded yet, will retry...');
                // Retry after a short delay
                setTimeout(() => this.initGis().then(resolve), 100);
                return;
            }

            if (!CLIENT_ID) {
                throw new Error('Google OAuth client ID is missing. Set VITE_GOOGLE_CLIENT_ID.');
            }

            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (response: any) => {
                    // Keep default callback for fallback callers; explicit flows wrap this callback.
                    void this.processTokenResponse(response);
                },
            });

            this.gisInitialized = true;
            // console.log('[GoogleDrive] GIS initialized');
            resolve();
        });
    }

    private setAuthToken(): void {
        if (this.accessToken) {
            window.gapi.client.setToken({ access_token: this.accessToken });
            // console.log('[GoogleDrive] Auth token set in GAPI client');
        }
    }

    private async fetchUserInfo(): Promise<'ok' | 'unauthorized' | 'error'> {
        if (!this.accessToken) {
            return 'error';
        }

        try {
            // Use the OAuth2 API to get user info
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });

            if (response.ok) {
                const data = await response.json();
                const userId = String(data.id ?? '').trim();
                const userEmail = String(data.email ?? '').trim();
                const joinedAt = this.resolveJoinedAt(userId, userEmail);
                this.currentUser = {
                    id: userId,
                    email: userEmail,
                    name: data.name,
                    picture: data.picture,
                    joinedAt,
                };
                this.rememberedEmailHint = this.currentUser.email;

                // Save user info to persistence
                const storage = this.rememberSession ? localStorage : sessionStorage;
                storage.setItem(USER_KEY, JSON.stringify(this.currentUser));
                this.touchSessionActivity(storage, true);

                // console.log('[GoogleDrive] User info fetched:', this.currentUser.email);
                this.authChangeCallbacks.forEach(cb => cb(this.currentUser));
                return 'ok';
            } else {
                if (response.status === 401) {
                    console.warn('[GoogleDrive] Token invalid or expired');
                    this.accessToken = null;
                    localStorage.removeItem(TOKEN_KEY);
                    localStorage.removeItem(TOKEN_EXPIRY_KEY);
                    sessionStorage.removeItem(TOKEN_KEY);
                    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
                    if (this.gapiInitialized) {
                        window.gapi.client.setToken(null);
                    }
                    return 'unauthorized';
                } else {
                    const errorText = await response.text();
                    console.error('[GoogleDrive] User info fetch failed:', errorText);
                    return 'error';
                }
            }
        } catch (error) {
            console.error('[GoogleDrive] Failed to fetch user info:', error);
            return 'error';
        }
    }

    async signIn(rememberSession: boolean = true): Promise<GoogleDriveUser> {
        // console.log('[GoogleDrive] Sign-in requested...');
        await this.init();
        this.rememberSession = rememberSession;
        if (!rememberSession) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(TOKEN_EXPIRY_KEY);
            localStorage.removeItem(USER_KEY);
        }

        const success = await this.requestAccessTokenWithPrompt('select_account');
        if (!success || !this.currentUser) {
            throw new Error('Sign-in failed. Please try again.');
        }

        return this.currentUser;
    }

    async signOut(): Promise<void> {
        // console.log('[GoogleDrive] Sign-out requested...');

        if (this.accessToken) {
            try {
                window.google.accounts.oauth2.revoke(this.accessToken, () => {
                    // console.log('[GoogleDrive] Token revoked');
                });
            } catch (e) { }
        }

        this.finalizeSignedOutState();
        // console.log('[GoogleDrive] Signed out');
    }

    getCurrentUser(): GoogleDriveUser | null {
        return this.currentUser;
    }

    async getSession(): Promise<GoogleDriveUser | null> {
        await this.init();
        return this.currentUser;
    }

    onAuthStateChange(callback: (user: GoogleDriveUser | null) => void): () => void {
        this.authChangeCallbacks.push(callback);
        return () => {
            this.authChangeCallbacks = this.authChangeCallbacks.filter(cb => cb !== callback);
        };
    }

    /**
     * Find or create the "Flashcardsish" folder in Google Drive
     */
    async getOrCreateAppFolder(folderId?: string): Promise<string> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated. Please sign in first.');
        }

        // If we have a stored folder ID, verify it still exists
        if (folderId) {
            try {
                await window.gapi.client.drive.files.get({ fileId: folderId });
                // console.log('[GoogleDrive] Using existing folder:', folderId);
                return folderId;
            } catch {
                console.warn('[GoogleDrive] Stored folder no longer exists');
            }
        }

        // Search for existing "Flashcardsish" folder
        const response = await window.gapi.client.drive.files.list({
            q: "name='Flashcardsish' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        if (response.result.files && response.result.files.length > 0) {
            const id = response.result.files[0].id!;
            // console.log('[GoogleDrive] Found existing folder:', id);
            return id;
        }

        // Create new folder
        const folderMetadata = {
            name: 'Flashcardsish',
            mimeType: 'application/vnd.google-apps.folder',
        };

        const folder = await window.gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id',
        });

        const id = folder.result.id!;
        // console.log('[GoogleDrive] Created new folder:', id);
        return id;
    }

    /**
     * Read the flashcardsish_data.json file from Google Drive
     */
    async readDataFile(folderId: string): Promise<any | null> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // console.log('[GoogleDrive] Reading data file from folder:', folderId);

        // Search for the data file
        const response = await window.gapi.client.drive.files.list({
            q: `name='flashcardsish_data.json' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)',
        });

        if (!response.result.files || response.result.files.length === 0) {
            // console.log('[GoogleDrive] No data file found');
            return null;
        }

        const fileId = response.result.files[0].id!;
        const fileResponse = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        // console.log('[GoogleDrive] Data file loaded');
        return JSON.parse(fileResponse.body);
    }

    /**
     * Write data to flashcardsish_data.json in Google Drive
     */
    async writeDataFile(folderId: string, data: any): Promise<void> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // console.log('[GoogleDrive] Writing data file to folder:', folderId);

        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });

        // Search for existing file
        const response = await window.gapi.client.drive.files.list({
            q: `name='flashcardsish_data.json' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)',
        });

        if (response.result.files && response.result.files.length > 0) {
            // Update existing file
            const fileId = response.result.files[0].id!;
            await this.uploadFileContent(fileId, blob);
            // console.log('[GoogleDrive] Data file updated');
        } else {
            // Create new file
            const metadata = {
                name: 'flashcardsish_data.json',
                mimeType: 'application/json',
                parents: [folderId],
            };
            await this.createFile(metadata, blob);
            // console.log('[GoogleDrive] Data file created');
        }
    }

    /**
     * Upload an image file to Google Drive and return its file ID
     */
    async uploadImage(folderId: string, blob: Blob, filename: string): Promise<string> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // console.log('[GoogleDrive] Uploading image:', filename);

        const metadata = {
            name: filename,
            mimeType: 'image/jpeg',
            parents: [folderId],
        };

        const file = await this.createFile(metadata, blob);
        // console.log('[GoogleDrive] Image uploaded:', file.id);
        return file.id!;
    }

    /**
     * Get image URL for a Drive file ID
     */
    async getImageUrl(fileId: string): Promise<string> {
        return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`;
    }

    // Helper: Create file with multipart upload
    private async createFile(metadata: any, blob: Blob): Promise<gapi.client.drive.File> {
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: ' + blob.type + '\r\n' +
            'Content-Transfer-Encoding: base64\r\n' +
            '\r\n' +
            base64Data +
            close_delim;

        const request = window.gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart' },
            headers: {
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
            },
            body: multipartRequestBody,
        });

        const response = await request;
        return response.result;
    }

    // Helper: Update file content
    private async uploadFileContent(fileId: string, blob: Blob): Promise<void> {
        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // Send the Blob directly so UTF-8 JSON stays intact during updates.
        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`,
            {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${this.accessToken}`,
                    'Content-Type': blob.type,
                },
                body: blob,
            }
        );

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Drive upload failed with status ${response.status}`);
        }
    }

    // =========================================================================
    // DISTRIBUTED STORAGE OPERATIONS (V2)
    // =========================================================================

    /**
     * Get or create a subfolder within a parent folder
     */
    async getOrCreateSubfolder(parentFolderId: string, folderName: string): Promise<string> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // Search for existing subfolder
        const response = await window.gapi.client.drive.files.list({
            q: `name='${folderName}' and '${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id!;
        }

        // Create new subfolder
        const folderMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        };

        const folder = await window.gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id',
        });

        // console.log(`[GoogleDrive] Created subfolder '${folderName}':`, folder.result.id);
        return folder.result.id!;
    }

    /**
     * Read a file's content from a folder by filename
     * Returns null if file doesn't exist
     */
    async readFile(folderId: string, filename: string): Promise<string | null> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // Search for the file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, modifiedTime)',
        });

        if (!response.result.files || response.result.files.length === 0) {
            this.cacheFileModifiedTime(folderId, filename, null);
            return null;
        }

        const file = response.result.files[0];
        const fileId = file.id!;
        this.cacheFileModifiedTime(folderId, filename, file.modifiedTime);
        const fileResponse = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        return fileResponse.body;
    }

    /**
     * Write content to a file in a folder (creates or updates)
     */
    async writeFile(folderId: string, filename: string, content: string, options?: WriteFileOptions): Promise<string> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const blob = new Blob([content], { type: 'application/json' });

        // Search for existing file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, modifiedTime)',
        });

        if (response.result.files && response.result.files.length > 0) {
            // Update existing file
            const file = response.result.files[0];
            const fileId = file.id!;
            const currentModifiedTime = file.modifiedTime || '';
            const cachedModifiedTime = this.fileModifiedAtCache.get(this.getFileCacheKey(folderId, filename));

            if (!options?.ignoreConflicts && cachedModifiedTime && currentModifiedTime && cachedModifiedTime !== currentModifiedTime) {
                // Drive list responses can momentarily lag after writes.
                // Re-check direct file metadata before raising a conflict.
                const liveMetadata = await window.gapi.client.drive.files.get({ fileId, fields: 'modifiedTime' });
                const liveModifiedTime = liveMetadata.result.modifiedTime || currentModifiedTime;

                if (cachedModifiedTime !== liveModifiedTime) {
                    throw new DriveConflictError(filename, cachedModifiedTime, liveModifiedTime);
                }
            }

            await this.uploadFileContent(fileId, blob);
            const updatedMetadata = await window.gapi.client.drive.files.get({ fileId, fields: 'modifiedTime' });
            this.cacheFileModifiedTime(folderId, filename, updatedMetadata.result.modifiedTime || null);
            return fileId;
        } else {
            // Create new file
            const metadata = {
                name: filename,
                mimeType: 'application/json',
                parents: [folderId],
            };
            const file = await this.createFile(metadata, blob);
            const newFileId = file.id!;
            const createdMetadata = await window.gapi.client.drive.files.get({ fileId: newFileId, fields: 'modifiedTime' });
            this.cacheFileModifiedTime(folderId, filename, createdMetadata.result.modifiedTime || null);
            return newFileId;
        }
    }

    /**
     * Delete a file from a folder by filename
     */
    async deleteFile(folderId: string, filename: string): Promise<void> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // Search for the file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)',
        });

        if (response.result.files && response.result.files.length > 0) {
            const fileId = response.result.files[0].id!;
            await window.gapi.client.drive.files.delete({ fileId });
            this.cacheFileModifiedTime(folderId, filename, null);
            // console.log(`[GoogleDrive] Deleted file: ${filename}`);
        }
    }

    /**
     * List files in a folder, optionally filtering by extension
     */
    async listFilesInFolder(folderId: string, extension?: string): Promise<Array<{ id: string; name: string }>> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        let query = `'${folderId}' in parents and trashed=false`;
        if (extension) {
            query += ` and name contains '${extension}'`;
        }

        const response = await window.gapi.client.drive.files.list({
            q: query,
            spaces: 'drive',
            fields: 'files(id, name)',
            pageSize: 1000,
        });

        return (response.result.files || []).map(f => ({
            id: f.id!,
            name: f.name!,
        }));
    }

    /**
     * Rename a file
     */
    async renameFile(folderId: string, oldFilename: string, newFilename: string): Promise<void> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        // Search for the file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${oldFilename}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)',
        });

        if (response.result.files && response.result.files.length > 0) {
            const fileId = response.result.files[0].id!;
            await window.gapi.client.drive.files.update({
                fileId,
                resource: { name: newFilename },
            });
            this.cacheFileModifiedTime(folderId, oldFilename, null);
            const updatedMetadata = await window.gapi.client.drive.files.get({ fileId, fields: 'modifiedTime' });
            this.cacheFileModifiedTime(folderId, newFilename, updatedMetadata.result.modifiedTime || null);
            // console.log(`[GoogleDrive] Renamed file: ${oldFilename} -> ${newFilename}`);
        }
    }

    /**
     * Delete all contents of a folder (but not the folder itself)
     */
    async deleteFolderContents(folderId: string): Promise<void> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const files = await this.listFilesInFolder(folderId);

        for (const file of files) {
            try {
                await window.gapi.client.drive.files.delete({ fileId: file.id });
            } catch (error) {
                console.error(`[GoogleDrive] Failed to delete ${file.name}:`, error);
            }
        }

        // console.log(`[GoogleDrive] Deleted ${files.length} files from folder`);
    }
}

export const googleDrive = new GoogleDriveClient();
