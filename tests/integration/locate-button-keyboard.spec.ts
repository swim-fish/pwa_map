import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import LocateButton from '../../src/components/LocateButton.svelte';
import { MapController } from '../../src/map/MapController';
import { setLocale } from '../../src/i18n/index';
import { __TESTING__ as locateSignalTesting } from '../../src/map/locateSignal';
import type { Lat, Lon, WGS84DD } from '../../src/types/coord';

// Feature 013 US3 — keyboard equivalents (FR-014d):
//   Enter / Space → short-tap toggle (Off→Show→Follow→Show)
//   Shift+Enter / Shift+Space → Stop (long-press semantics)

const TAIPEI_101: WGS84DD = {
  kind: 'wgs84-dd',
  lat: 25.033611 as Lat,
  lon: 121.564472 as Lon,
};

interface Cmp {
  $destroy: () => void;
}
let host: HTMLElement;
let cmp: Cmp;

function makeController(): MapController {
  const controller = new MapController({
    container: document.createElement('div'),
    center: TAIPEI_101,
    zoom: 13,
  });
  controller.attachUnderlying({ easeTo: vi.fn(), setCenter: vi.fn(), once: vi.fn() });
  return controller;
}

beforeEach(() => {
  setLocale('en');
  document.body.innerHTML = '';
  host = document.createElement('div');
  document.body.appendChild(host);
  locateSignalTesting.resetLocateSignal();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() } as unknown as Geolocation,
  });
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: {
      query: vi.fn(async () => ({ state: 'granted', addEventListener: vi.fn() })),
    } as unknown as Permissions,
  });
});

afterEach(() => {
  cmp?.$destroy?.();
});

function mount(): void {
  const Component = LocateButton as unknown as new (args: {
    target: HTMLElement;
    props: { controller: MapController };
  }) => Cmp;
  cmp = new Component({ target: host, props: { controller: makeController() } });
}

function getButton(): HTMLButtonElement {
  return host.querySelector('button[data-testid="locate"]') as HTMLButtonElement;
}

function fireKey(key: string, shiftKey = false): void {
  const ev = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
  getButton().dispatchEvent(ev);
}

describe('LocateButton US3 — keyboard toggle (Enter / Space)', () => {
  test('Enter from Off → Show', async () => {
    mount();
    await tick();
    fireKey('Enter');
    await tick();
    expect(getButton().dataset.state).toBe('show');
  });

  test('Space from Show → Follow', async () => {
    mount();
    await tick();
    fireKey('Enter'); // Off → Show
    await tick();
    fireKey(' ');
    await tick();
    expect(getButton().dataset.state).toBe('follow');
  });

  test('Enter from Follow → Show', async () => {
    mount();
    await tick();
    fireKey('Enter'); // Off → Show
    await tick();
    fireKey('Enter'); // Show → Follow
    await tick();
    fireKey('Enter'); // Follow → Show
    await tick();
    expect(getButton().dataset.state).toBe('show');
  });
});

describe('LocateButton US3 — keyboard Stop (Shift+Enter / Shift+Space)', () => {
  test('Shift+Enter from Show → Off', async () => {
    mount();
    await tick();
    fireKey('Enter'); // Off → Show
    await tick();
    expect(getButton().dataset.state).toBe('show');

    fireKey('Enter', true);
    await tick();
    expect(getButton().dataset.state).toBe('off');
  });

  test('Shift+Space from Follow → Off', async () => {
    mount();
    await tick();
    fireKey('Enter'); // Off → Show
    await tick();
    fireKey('Enter'); // Show → Follow
    await tick();
    expect(getButton().dataset.state).toBe('follow');

    fireKey(' ', true);
    await tick();
    expect(getButton().dataset.state).toBe('off');
  });

  test('Shift+Enter from Off → no-op (FR-014g)', async () => {
    mount();
    await tick();
    expect(getButton().dataset.state).toBe('off');

    fireKey('Enter', true);
    await tick();
    expect(getButton().dataset.state).toBe('off');
  });

  test('after Shift+Enter Stop, the very next click activates again (no sticky click suppression)', async () => {
    // Regression for PR #5 review Co-3: fireStop() previously always set
    // justFiredStop=true. The keyboard Stop chord has no follow-up click
    // event (Shift+Enter on a button does not synth `click`), so the
    // flag was sticky and the user's NEXT real click was swallowed,
    // forcing them to click twice to re-activate.
    mount();
    await tick();
    fireKey('Enter'); // Off → Show
    await tick();
    expect(getButton().dataset.state).toBe('show');

    fireKey('Enter', true); // Stop → Off
    await tick();
    expect(getButton().dataset.state).toBe('off');

    // Single click should activate. With the stale-flag bug it would
    // swallow this click and stay Off; user would need a second click.
    getButton().click();
    await tick();
    expect(getButton().dataset.state).toBe('show');
  });
});

describe('LocateButton US3 — aria-keyshortcuts attribute', () => {
  test('exposes Enter Space Shift+Enter Shift+Space', async () => {
    mount();
    await tick();
    expect(getButton().getAttribute('aria-keyshortcuts')).toBe(
      'Enter Space Shift+Enter Shift+Space',
    );
  });
});
