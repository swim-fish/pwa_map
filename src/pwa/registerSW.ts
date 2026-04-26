import { registerSW as workboxRegister } from 'virtual:pwa-register';
import { fireNeedRefresh, fireOfflineReady } from './updateSignal';
import { hasShownOfflineReady, markOfflineReadyShown } from '$storage/offlineReady';

export function registerSW(): void {
  if (import.meta.env.DEV) return;
  try {
    const updateSW = workboxRegister({
      immediate: true,
      onOfflineReady() {
        if (hasShownOfflineReady()) return;
        markOfflineReadyShown();
        fireOfflineReady();
      },
      onNeedRefresh() {
        fireNeedRefresh(async () => {
          await updateSW(true);
        });
      },
      onRegisterError() {
        // FR-012 — silent fallback; no toast, no console.error.
      },
    });
  } catch {
    /* virtual:pwa-register absent (tests / SSR) — noop */
  }
}
