<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import {
    parseGoTo,
    parseDdOnly,
    parseDmsOnly,
    parseMgrsOnly,
    parseTm2InferredOnly,
    parseTm2ExplicitOnly,
    parseTwd67Only,
    parseTaipowerOnly,
  } from '$coord/parser';
  import type { GoToRequest, GoToRequestOk } from '$coord/index';
  import { composeRaw, type SubParserHint } from '$coord/composer';
  import { tStore } from '$i18n/index';
  import type { FormatSelection, LayoutFields } from '$types/goto';

  import ChipRack from './goto/ChipRack.svelte';
  import AutoLayout from './goto/AutoLayout.svelte';
  import DdLayout from './goto/DdLayout.svelte';
  import DmsLayout from './goto/DmsLayout.svelte';
  import Tm2Layout from './goto/Tm2Layout.svelte';
  import Twd67Layout from './goto/Twd67Layout.svelte';
  import MgrsLayout from './goto/MgrsLayout.svelte';
  import TaipowerLayout from './goto/TaipowerLayout.svelte';
  import RecentChips from './goto/RecentChips.svelte';
  import Disambiguator from './goto/Disambiguator.svelte';
  import { loadRecents, saveRecents, addRecent, removeRecent } from '$storage/recents';
  import { candidates as candidatesOf } from '$coord/disambiguate';
  import type { Candidate, RecentEntry, RecentList } from '$types/goto';
  import type { Lat, Lon, WGS84DD } from '$types/coord';

  export let open: boolean = false;

  const dispatch = createEventDispatcher<{
    submit: GoToRequestOk;
    close: void;
  }>();

  let selection: FormatSelection = { kind: 'auto' };
  let fields: LayoutFields = { kind: 'auto', raw: '' };
  let error: string | null = null;
  let wasOpen = false;
  let firstFocusable: HTMLElement | null = null;
  let recents: RecentList = { version: 1, entries: [] };
  let pendingDelete: RecentEntry | null = null;
  let disambigCandidates: readonly Candidate[] = [];
  let disambigOpen = false;

  function defaultFields(s: FormatSelection): LayoutFields {
    if (s.kind === 'auto') return { kind: 'auto', raw: '' };
    switch (s.value) {
      case 'wgs84-dd':
        return { kind: 'wgs84-dd', lat: '', lon: '' };
      case 'wgs84-dms':
        return {
          kind: 'wgs84-dms',
          latDeg: '',
          latMin: '',
          latSec: '',
          latHem: 'N',
          lonDeg: '',
          lonMin: '',
          lonSec: '',
          lonHem: 'E',
        };
      case 'twd97-tm2':
        return { kind: 'twd97-tm2', easting: '', northing: '', zone: 'auto' };
      case 'twd67-tm2':
        return { kind: 'twd67-tm2', easting: '', northing: '' };
      case 'mgrs':
        return { kind: 'mgrs', gzdBand: '', square: '', easting: '', northing: '' };
      case 'taipower':
        return { kind: 'taipower', first5: '', last4or6: '' };
      default:
        return { kind: 'auto', raw: '' };
    }
  }

  $: {
    if (open && !wasOpen) {
      selection = { kind: 'auto' };
      fields = defaultFields(selection);
      error = null;
      pendingDelete = null;
      disambigCandidates = [];
      disambigOpen = false;
      recents = loadRecents();
      void tick().then(() => firstFocusable?.focus());
    }
    wasOpen = open;
  }

  function onChipChange(ev: CustomEvent<FormatSelection>): void {
    selection = ev.detail;
    fields = defaultFields(selection);
    error = null;
  }

  function routeByHint(raw: string, hint: SubParserHint): GoToRequest {
    switch (hint.kind) {
      case 'auto':
        return parseGoTo(raw);
      case 'wgs84-dd':
        return parseDdOnly(raw);
      case 'wgs84-dms':
        return parseDmsOnly(raw);
      case 'mgrs':
        return parseMgrsOnly(raw);
      case 'twd97-tm2':
        return hint.zone === 'auto'
          ? parseTm2InferredOnly(raw)
          : parseTm2ExplicitOnly(raw, hint.zone);
      case 'twd67-tm2':
        return parseTwd67Only(raw);
      case 'taipower':
        return parseTaipowerOnly(raw);
    }
  }

  function handleSubmit(): void {
    const composed = composeRaw(selection, fields);
    if (!composed.ok) {
      error = composed.error.messageKey;
      return;
    }
    if (composed.value.hint.kind === 'auto') {
      const cands = candidatesOf(composed.value.raw);
      if (cands.length >= 2) {
        disambigCandidates = cands;
        disambigOpen = true;
        error = null;
        return;
      }
    }
    const result = routeByHint(composed.value.raw, composed.value.hint);
    if (result.ok) {
      error = null;
      recents = addRecent(recents, selection, composed.value.raw);
      saveRecents(recents);
      dispatch('submit', result);
      return;
    }
    error = result.error.messageKey;
  }

  function onDisambigPick(ev: CustomEvent<Candidate>): void {
    const cand = ev.detail;
    disambigOpen = false;
    disambigCandidates = [];
    error = null;
    const target: WGS84DD = {
      kind: 'wgs84-dd',
      lat: cand.target.lat as Lat,
      lon: cand.target.lon as Lon,
    };
    const request: GoToRequestOk = {
      ok: true,
      raw: cand.raw,
      parsedAs: cand.kind,
      target,
    };
    recents = addRecent(recents, { kind: 'fixed', value: cand.kind }, cand.raw);
    saveRecents(recents);
    dispatch('submit', request);
  }

  function onDisambigCancel(): void {
    disambigOpen = false;
    disambigCandidates = [];
  }

  function submitFromRecent(entry: RecentEntry): void {
    let request: GoToRequest;
    if (entry.format.kind === 'auto') {
      request = parseGoTo(entry.raw);
    } else {
      switch (entry.format.value) {
        case 'wgs84-dd':
          request = parseDdOnly(entry.raw);
          break;
        case 'wgs84-dms':
          request = parseDmsOnly(entry.raw);
          break;
        case 'mgrs':
          request = parseMgrsOnly(entry.raw);
          break;
        case 'twd97-tm2':
          request = parseTm2InferredOnly(entry.raw);
          break;
        case 'twd67-tm2':
          request = parseTwd67Only(entry.raw);
          break;
        case 'taipower':
          request = parseTaipowerOnly(entry.raw);
          break;
        default:
          request = parseGoTo(entry.raw);
      }
    }
    if (request.ok) {
      error = null;
      recents = addRecent(recents, entry.format, entry.raw);
      saveRecents(recents);
      dispatch('submit', request);
    } else {
      error = request.error.messageKey;
    }
  }

  function onRecentPick(ev: CustomEvent<RecentEntry>): void {
    submitFromRecent(ev.detail);
  }

  function onRecentLongPress(ev: CustomEvent<RecentEntry>): void {
    pendingDelete = ev.detail;
  }

  function confirmDelete(): void {
    if (!pendingDelete) return;
    recents = removeRecent(recents, pendingDelete.format, pendingDelete.raw);
    saveRecents(recents);
    pendingDelete = null;
  }

  function cancelDelete(): void {
    pendingDelete = null;
  }

  function close(): void {
    dispatch('close');
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!open) return;
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  }

  $: titleId = 'goto-title';
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <button
    type="button"
    class="backdrop"
    on:click={close}
    aria-label={$tStore('toggle.close')}
    data-testid="goto-backdrop"
  ></button>
  <section
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby={titleId}
    data-testid="goto-dialog"
  >
    <header class="head">
      <h2 id={titleId} bind:this={firstFocusable} tabindex="-1">{$tStore('goto.title')}</h2>
      <button type="button" class="close" on:click={close} aria-label={$tStore('toggle.close')}
        >×</button
      >
    </header>

    <RecentChips
      entries={recents.entries}
      on:pick={onRecentPick}
      on:longPress={onRecentLongPress}
    />

    <ChipRack {selection} on:change={onChipChange} />

    {#if fields.kind === 'auto'}
      <AutoLayout bind:raw={fields.raw} />
    {:else if fields.kind === 'wgs84-dd'}
      <DdLayout bind:lat={fields.lat} bind:lon={fields.lon} />
    {:else if fields.kind === 'wgs84-dms'}
      <DmsLayout
        bind:latDeg={fields.latDeg}
        bind:latMin={fields.latMin}
        bind:latSec={fields.latSec}
        bind:latHem={fields.latHem}
        bind:lonDeg={fields.lonDeg}
        bind:lonMin={fields.lonMin}
        bind:lonSec={fields.lonSec}
        bind:lonHem={fields.lonHem}
      />
    {:else if fields.kind === 'twd97-tm2'}
      <Tm2Layout
        bind:easting={fields.easting}
        bind:northing={fields.northing}
        bind:zone={fields.zone}
      />
    {:else if fields.kind === 'twd67-tm2'}
      <Twd67Layout bind:easting={fields.easting} bind:northing={fields.northing} />
    {:else if fields.kind === 'mgrs'}
      <MgrsLayout
        bind:gzdBand={fields.gzdBand}
        bind:square={fields.square}
        bind:easting={fields.easting}
        bind:northing={fields.northing}
      />
    {:else if fields.kind === 'taipower'}
      <TaipowerLayout bind:first5={fields.first5} bind:last4or6={fields.last4or6} />
    {/if}

    {#if error}
      <p role="alert" aria-live="assertive" class="error" data-testid="goto-error">
        {$tStore(error)}
      </p>
    {/if}

    <footer class="actions">
      <button type="button" class="primary" on:click={handleSubmit} data-testid="goto-submit">
        {$tStore('goto.submit')}
      </button>
    </footer>
  </section>

  <Disambiguator
    open={disambigOpen}
    candidates={disambigCandidates}
    on:pick={onDisambigPick}
    on:cancel={onDisambigCancel}
  />

  {#if pendingDelete}
    <div
      class="confirm-backdrop"
      role="presentation"
      on:click={cancelDelete}
      data-testid="goto-recent-delete-confirm-backdrop"
    ></div>
    <div
      class="confirm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="goto-recent-confirm-title"
      data-testid="goto-recent-delete-confirm"
    >
      <h3 id="goto-recent-confirm-title">{$tStore('goto.recent.deleteConfirm.title')}</h3>
      <p>{$tStore('goto.recent.deleteConfirm.body', { raw: pendingDelete.raw })}</p>
      <div class="confirm-actions">
        <button
          type="button"
          class="secondary"
          on:click={cancelDelete}
          data-testid="goto-recent-delete-confirm-cancel"
        >
          {$tStore('goto.recent.deleteConfirm.cancel')}
        </button>
        <button
          type="button"
          class="danger"
          on:click={confirmDelete}
          data-testid="goto-recent-delete-confirm-ok"
        >
          {$tStore('goto.recent.deleteConfirm.ok')}
        </button>
      </div>
    </div>
  {/if}
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.3);
    z-index: 30;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(520px, calc(100vw - 24px));
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    background: var(--color-surface, #ffffff);
    color: var(--color-fg, #0f172a);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
    padding: var(--space-4, 16px);
    z-index: 31;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-2, 8px);
  }

  h2 {
    margin: 0;
    font-size: 18px;
  }

  h2:focus {
    outline: none;
  }

  .close {
    width: 32px;
    height: 32px;
    border: 0;
    background: transparent;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;
    color: var(--color-fg, #0f172a);
  }

  .error {
    margin: 0 0 var(--space-3, 12px);
    color: var(--color-danger, #dc2626);
    font-size: 13px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 8px);
  }

  .primary {
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: var(--color-accent, #0ea5e9);
    color: #ffffff;
    border: 0;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .confirm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    z-index: 40;
  }

  .confirm {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100vw - 24px));
    background: var(--color-surface, #ffffff);
    color: var(--color-fg, #0f172a);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, 0.3);
    padding: var(--space-4, 16px);
    z-index: 41;
  }

  .confirm h3 {
    margin: 0 0 var(--space-2, 8px);
    font-size: 16px;
  }

  .confirm p {
    margin: 0 0 var(--space-3, 12px);
    font-size: 13px;
  }

  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2, 8px);
  }

  .secondary {
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: var(--color-surface-elev, #f8fafc);
    color: var(--color-fg, #0f172a);
    border: 1px solid var(--color-border, #cbd5e1);
    border-radius: 6px;
    cursor: pointer;
  }

  .danger {
    padding: var(--space-2, 8px) var(--space-4, 16px);
    background: var(--color-danger, #dc2626);
    color: #ffffff;
    border: 0;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
