import './tokens.css';
import App from './App.svelte';
import { initCoord } from '$coord/index';
import { registerSW } from '$pwa/registerSW';

initCoord();

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app root element in index.html');

const app = new App({ target });

registerSW();

export default app;
