import './tokens.css';
import App from './App.svelte';
import { initCoord } from '$coord/index';
import { registerSW } from '$pwa/registerSW';
import { enforceCachePolicy } from '$pwa/cachePurge';
import { loadTileTtlDays, loadTileMaxEntries } from '$storage/preferences';

initCoord();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app root element in index.html');

const app = new App({ target });

registerSW();

void enforceCachePolicy(loadTileTtlDays(), loadTileMaxEntries()).catch(() => {
  /* surfaced via the Settings sheet on next open */
});

export default app;
