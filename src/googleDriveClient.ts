/// <reference types="gapi" />
/// <reference types="gapi.client.drive" />

// Extend Window interface to include google property
declare global {
    interface Window {
        google: any;
        gapi: typeof gapi;
    }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
// Need both Drive access and user info access
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

export interface GoogleDriveUser {
    id: string;
    email: string;
    name: string;
    picture?: string;
}

class GoogleDriveClient {
    private accessToken: string | null = null;
    private tokenClient: any = null;
    private gapiInitialized = false;
    private gisInitialized = false;
    private authChangeCallbacks: Array<(user: GoogleDriveUser | null) => void> = [];
    private currentUser: GoogleDriveUser | null = null;

    async init(): Promise<void> {
        console.log('[GoogleDrive] Starting initialization...');
        console.log('[GoogleDrive] CLIENT_ID:', CLIENT_ID);
        console.log('[GoogleDrive] API_KEY:', API_KEY ? 'Present' : 'Missing');

        await this.initGapi();
        await this.initGis();

        console.log('[GoogleDrive] ✅ Initialization complete');
    }

    private async initGapi(): Promise<void> {
        if (this.gapiInitialized) {
            console.log('[GoogleDrive] GAPI already initialized');
            return;
        }

        return new Promise((resolve, reject) => {
            if (typeof window.gapi === 'undefined') {
                const error = new Error('GAPI not loaded. Check script tag.');
                console.error('[GoogleDrive] ❌', error.message);
                reject(error);
                return;
            }

            console.log('[GoogleDrive] Loading GAPI client...');
            window.gapi.load('client', async () => {
                try {
                    await window.gapi.client.init({
                        apiKey: API_KEY,
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });
                    this.gapiInitialized = true;
                    console.log('[GoogleDrive] ✅ GAPI initialized');
                    resolve();
                } catch (error) {
                    console.error('[GoogleDrive] ❌ GAPI init failed:', error);
                    reject(error);
                }
            });
        });
    }

    private async initGis(): Promise<void> {
        if (this.gisInitialized) {
            console.log('[GoogleDrive] GIS already initialized');
            return;
        }

        return new Promise((resolve) => {
            if (typeof window.google === 'undefined') {
                console.warn('[GoogleDrive] ⚠️ GIS not loaded yet, will retry...');
                // Retry after a short delay
                setTimeout(() => this.initGis().then(resolve), 100);
                return;
            }

            console.log('[GoogleDrive] Initializing GIS token client...');
            this.tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: (response: any) => {
                    console.log('[GoogleDrive] Token response received');
                    if (response.error) {
                        console.error('[GoogleDrive] ❌ Token error:', response.error);
                        return;
                    }
                    this.accessToken = response.access_token;
                    console.log('[GoogleDrive] ✅ Access token obtained');
                    this.setAuthToken();
                    this.fetchUserInfo();
                },
            });

            this.gisInitialized = true;
            console.log('[GoogleDrive] ✅ GIS initialized');
            resolve();
        });
    }

    private setAuthToken(): void {
        if (this.accessToken) {
            window.gapi.client.setToken({ access_token: this.accessToken });
            console.log('[GoogleDrive] Auth token set in GAPI client');
        }
    }

    private async fetchUserInfo(): Promise<void> {
        if (!this.accessToken) {
            console.warn('[GoogleDrive] ⚠️ No access token available for user info');
            return;
        }

        try {
            console.log('[GoogleDrive] Fetching user info...');
            // Use the OAuth2 API to get user info
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = {
                    id: data.id,
                    email: data.email,
                    name: data.name,
                    picture: data.picture,
                };
                console.log('[GoogleDrive] ✅ User info fetched:', this.currentUser.email);
                this.authChangeCallbacks.forEach(cb => cb(this.currentUser));
            } else {
                const errorText = await response.text();
                console.error('[GoogleDrive] ❌ User info fetch failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
            }
        } catch (error) {
            console.error('[GoogleDrive] ❌ Failed to fetch user info:', error);
        }
    }

    async signIn(): Promise<GoogleDriveUser> {
        console.log('[GoogleDrive] Sign-in requested...');
        await this.init();

        return new Promise((resolve, reject) => {
            if (!this.tokenClient) {
                reject(new Error('Token client not initialized'));
                return;
            }

            // Store resolve for callback
            const originalCallback = this.tokenClient.callback;
            this.tokenClient.callback = async (response: any) => {
                await originalCallback(response);
                if (response.error) {
                    console.error('[GoogleDrive] ❌ Sign-in failed:', response.error);
                    reject(new Error(response.error));
                } else if (this.currentUser) {
                    console.log('[GoogleDrive] ✅ Sign-in successful:', this.currentUser.email);
                    resolve(this.currentUser);
                }
            };

            console.log('[GoogleDrive] Requesting access token...');
            // Use 'select_account' to allow switching between Google accounts
            // Use '' (empty) for subsequent logins to use the last account
            this.tokenClient.requestAccessToken({ prompt: 'select_account' });
        });
    }

    async signOut(): Promise<void> {
        console.log('[GoogleDrive] Sign-out requested...');

        if (this.accessToken) {
            window.google.accounts.oauth2.revoke(this.accessToken, () => {
                console.log('[GoogleDrive] ✅ Token revoked');
            });
        }

        this.accessToken = null;
        this.currentUser = null;
        window.gapi.client.setToken(null);
        this.authChangeCallbacks.forEach(cb => cb(null));
        console.log('[GoogleDrive] ✅ Signed out');
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
                console.log('[GoogleDrive] Using existing folder:', folderId);
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
            console.log('[GoogleDrive] Found existing folder:', id);
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
        console.log('[GoogleDrive] ✅ Created new folder:', id);
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

        console.log('[GoogleDrive] Reading data file from folder:', folderId);

        // Search for the data file
        const response = await window.gapi.client.drive.files.list({
            q: `name='flashcardsish_data.json' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)',
        });

        if (!response.result.files || response.result.files.length === 0) {
            console.log('[GoogleDrive] No data file found');
            return null;
        }

        const fileId = response.result.files[0].id!;
        const fileResponse = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        console.log('[GoogleDrive] ✅ Data file loaded');
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

        console.log('[GoogleDrive] Writing data file to folder:', folderId);

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
            console.log('[GoogleDrive] ✅ Data file updated');
        } else {
            // Create new file
            const metadata = {
                name: 'flashcardsish_data.json',
                mimeType: 'application/json',
                parents: [folderId],
            };
            await this.createFile(metadata, blob);
            console.log('[GoogleDrive] ✅ Data file created');
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

        console.log('[GoogleDrive] Uploading image:', filename);

        const metadata = {
            name: filename,
            mimeType: 'image/jpeg',
            parents: [folderId],
        };

        const file = await this.createFile(metadata, blob);
        console.log('[GoogleDrive] ✅ Image uploaded:', file.id);
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
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                resolve(base64);
            };
            reader.readAsDataURL(blob);
        });

        await window.gapi.client.request({
            path: `/upload/drive/v3/files/${fileId}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            headers: {
                'Content-Type': blob.type,
            },
            body: atob(base64Data),
        });
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

        console.log(`[GoogleDrive] ✅ Created subfolder '${folderName}':`, folder.result.id);
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
            fields: 'files(id)',
        });

        if (!response.result.files || response.result.files.length === 0) {
            return null;
        }

        const fileId = response.result.files[0].id!;
        const fileResponse = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        return fileResponse.body;
    }

    /**
     * Write content to a file in a folder (creates or updates)
     */
    async writeFile(folderId: string, filename: string, content: string): Promise<string> {
        await this.init();

        if (!this.accessToken) {
            throw new Error('Not authenticated');
        }

        const blob = new Blob([content], { type: 'application/json' });

        // Search for existing file
        const response = await window.gapi.client.drive.files.list({
            q: `name='${filename}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)',
        });

        if (response.result.files && response.result.files.length > 0) {
            // Update existing file
            const fileId = response.result.files[0].id!;
            await this.uploadFileContent(fileId, blob);
            return fileId;
        } else {
            // Create new file
            const metadata = {
                name: filename,
                mimeType: 'application/json',
                parents: [folderId],
            };
            const file = await this.createFile(metadata, blob);
            return file.id!;
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
            console.log(`[GoogleDrive] ✅ Deleted file: ${filename}`);
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
            console.log(`[GoogleDrive] ✅ Renamed file: ${oldFilename} -> ${newFilename}`);
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

        console.log(`[GoogleDrive] ✅ Deleted ${files.length} files from folder`);
    }
}

export const googleDrive = new GoogleDriveClient();
