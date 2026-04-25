import { registerSW as workboxRegister } from 'virtual:pwa-register';

export function registerSW(): void {
  if (import.meta.env.DEV) return;
  try {
    workboxRegister({
      immediate: true,
      onOfflineReady() {
        // future: surface a toast — kept silent in MVP
      },
      onNeedRefresh() {
        // autoUpdate strategy handles the reload; no prompt needed
      },
    });
  } catch {
    /* tests and SSR paths: virtual module absent — noop */
  }
}
