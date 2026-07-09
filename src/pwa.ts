export const PWA_UPDATE_READY_EVENT = 'flashcardsish:pwa-update-ready';

export interface PwaUpdateReadyDetail {
  registration: ServiceWorkerRegistration;
}

export type PwaUpdateReadyEvent = CustomEvent<PwaUpdateReadyDetail>;

const dispatchUpdateReady = (registration: ServiceWorkerRegistration): void => {
  window.dispatchEvent(new CustomEvent<PwaUpdateReadyDetail>(PWA_UPDATE_READY_EVENT, {
    detail: { registration }
  }));
};

export const applyServiceWorkerUpdate = (registration: ServiceWorkerRegistration | null): void => {
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
};

export const registerFlashcardsishServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return null;
  }

  try {
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    const registration = await navigator.serviceWorker.register('/sw.js');

    if (registration.waiting) {
      dispatchUpdateReady(registration);
    }

    registration.addEventListener('updatefound', () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener('statechange', () => {
        if (
          installingWorker.state === 'installed' &&
          navigator.serviceWorker.controller &&
          registration.waiting
        ) {
          dispatchUpdateReady(registration);
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return null;
  }
};
