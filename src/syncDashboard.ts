export type CloudSyncStatus = 'idle' | 'saving' | 'saved' | 'saved_faded' | 'error';

export interface SyncDashboardInput {
  offlineMode: boolean;
  isSignedIn: boolean;
  isLibraryLoaded: boolean;
  isCloudLoading: boolean;
  cloudSyncStatus: CloudSyncStatus;
  cloudConflictCount: number;
  dirtySetCount: number;
  hasPendingLocalLibraryChanges: boolean;
  hasPendingLibrarySave: boolean;
  hasPendingStructureChanges: boolean;
  cloudSaveInFlight: boolean;
  syncInProgress: boolean;
  lastLocalFallbackAt: number | null;
}

export interface SyncDashboardState {
  modeLabel: string;
  statusLabel: string;
  detail: string;
  tone: 'idle' | 'busy' | 'success' | 'warning' | 'error';
  canManualSync: boolean;
  pendingLocalChanges: boolean;
  lastLocalFallbackLabel: string;
}

export const formatLocalFallbackTimestamp = (value: number | null): string => {
  if (!value) return 'Not written yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
};

export const deriveSyncDashboardState = (input: SyncDashboardInput): SyncDashboardState => {
  const pendingLocalChanges = Boolean(
    input.hasPendingLocalLibraryChanges ||
    input.hasPendingLibrarySave ||
    input.dirtySetCount > 0 ||
    input.hasPendingStructureChanges
  );
  const isBusy = Boolean(
    input.isCloudLoading ||
    input.cloudSaveInFlight ||
    input.syncInProgress ||
    input.cloudSyncStatus === 'saving'
  );

  if (input.offlineMode) {
    return {
      modeLabel: 'Offline-only',
      statusLabel: pendingLocalChanges ? 'Local changes pending' : 'Local only',
      detail: 'Cloud sync is disabled in offline mode. Use Settings export if you want to move this data elsewhere.',
      tone: pendingLocalChanges ? 'warning' : 'idle',
      canManualSync: false,
      pendingLocalChanges,
      lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
    };
  }

  if (!input.isSignedIn) {
    return {
      modeLabel: 'Local',
      statusLabel: pendingLocalChanges ? 'Local changes pending' : 'Not signed in',
      detail: 'Sign in with Google to sync this library across devices.',
      tone: pendingLocalChanges ? 'warning' : 'idle',
      canManualSync: false,
      pendingLocalChanges,
      lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
    };
  }

  if (!input.isLibraryLoaded || isBusy) {
    return {
      modeLabel: 'Google Drive',
      statusLabel: input.isCloudLoading ? 'Pulling cloud data' : 'Syncing',
      detail: 'Flashcardsish saves locally first, then reconciles with Google Drive.',
      tone: 'busy',
      canManualSync: false,
      pendingLocalChanges,
      lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
    };
  }

  if (input.cloudConflictCount > 0) {
    return {
      modeLabel: 'Google Drive',
      statusLabel: `${input.cloudConflictCount} conflict${input.cloudConflictCount === 1 ? '' : 's'}`,
      detail: 'Review the conflict banner before pushing more cloud changes.',
      tone: 'warning',
      canManualSync: false,
      pendingLocalChanges,
      lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
    };
  }

  if (input.cloudSyncStatus === 'error') {
    return {
      modeLabel: 'Google Drive',
      statusLabel: 'Sync needs attention',
      detail: 'The last cloud operation failed. Local fallback storage is still updated.',
      tone: 'error',
      canManualSync: true,
      pendingLocalChanges,
      lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
    };
  }

  if (pendingLocalChanges) {
    return {
      modeLabel: 'Google Drive',
      statusLabel: 'Queued for sync',
      detail: 'Local changes are saved and waiting for the next cloud write.',
      tone: 'warning',
      canManualSync: true,
      pendingLocalChanges,
      lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
    };
  }

  return {
    modeLabel: 'Google Drive',
    statusLabel: input.cloudSyncStatus === 'saved' ? 'Saved just now' : 'Up to date',
    detail: 'No pending local changes are waiting to upload.',
    tone: input.cloudSyncStatus === 'saved' ? 'success' : 'idle',
    canManualSync: true,
    pendingLocalChanges,
    lastLocalFallbackLabel: formatLocalFallbackTimestamp(input.lastLocalFallbackAt)
  };
};
