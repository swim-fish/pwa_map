# Contract: `SettingsSheet.svelte` — modal sheet for cache inspection + control

**Component**: `src/components/SettingsSheet.svelte` (NEW)
**Mounted from**: `src/app/App.svelte` (gated by an `open` boolean
prop; the toolbar gear button toggles it).
**Verifies**: spec FR-001..FR-005, FR-008..FR-018, FR-020, FR-021;
research D3, D4, D5, D6, D11.

## §1. Render contract

The component renders a `<dialog>` element using `dialog.showModal()`
when `open === true`. When `open === false` the dialog is closed and
the markup is removed from the layout.

```svelte
<dialog
  bind:this={dialogEl}
  class="settings-sheet"
  data-testid="settings-sheet"
  on:close={onCloseDialog}
>
  <header>
    <h2 id="settings-title">{$tStore('settings.title')}</h2>
    <button
      type="button"
      class="settings-close"
      data-testid="settings-close"
      aria-label={$tStore('settings.close')}
      on:click={() => onClose()}
    >
      <!-- inline SVG ✕ -->
    </button>
  </header>

  <p class="settings-licence" data-testid="settings-licence">
    {$tStore('settings.licenceNotice')}
  </p>

  <section class="settings-cacheList">
    {#each rows as row (row.name)}
      <CacheRow {row} on:clear={() => onClearOne(row.name)} />
    {/each}
  </section>

  <p class="settings-quota" data-testid="settings-quota">
    {quotaText}  <!-- '≈ 12.3 MB' or localised "—" -->
  </p>

  <section class="settings-controls">
    <label>
      {$tStore('settings.ttl.label')}
      <select
        data-testid="settings-ttl"
        bind:value={ttlDays}
        on:change={onChangeTtl}
      >
        {#each TTL_OPTIONS as opt}
          <option value={opt}>{$tStore('settings.ttl.option', { days: opt })}</option>
        {/each}
      </select>
    </label>

    <label>
      {$tStore('settings.maxEntries.label')}
      <select
        data-testid="settings-max-entries"
        bind:value={maxEntries}
        on:change={onChangeMaxEntries}
      >
        {#each MAX_ENTRIES_OPTIONS as opt}
          <option value={opt}>{opt.toLocaleString()}</option>
        {/each}
      </select>
    </label>
  </section>

  <footer class="settings-actions">
    <button
      type="button"
      class="settings-clearAll danger"
      data-testid="settings-clear-all"
      on:click={() => onClearAll()}
      disabled={busy}
    >
      {$tStore('settings.clear.all.button')}
    </button>
  </footer>

  {#if confirmTarget}
    <ConfirmClearDialog
      target={confirmTarget}
      busy={busy}
      on:cancel={onConfirmCancel}
      on:confirm={onConfirmConfirm}
    />
  {/if}

  {#if statusMessage}
    <p class="settings-status" role="status" data-testid="settings-status">
      {statusMessage}
    </p>
  {/if}
</dialog>
```

(The `CacheRow` and `ConfirmClearDialog` slots may be inlined or
extracted as private sub-components — implementer's choice. The
required `data-testid` selectors below assume inlined; if extracted,
the same selectors must apply on the rendered output.)

Required `data-testid` selectors:

| Selector                | Purpose                                               |
| ----------------------- | ----------------------------------------------------- |
| `settings-sheet`        | the `<dialog>` itself                                 |
| `settings-close`        | the ✕ close button                                     |
| `settings-licence`      | the licence-notice paragraph                          |
| `settings-cache-row-osm-tiles` (etc.) | each cache row container                                |
| `settings-cache-row-osm-tiles-count` | the entry-count number in each row                       |
| `settings-cache-row-osm-tiles-clear` | the per-row clear button                                |
| `settings-quota`        | the quota-estimate paragraph                          |
| `settings-ttl`          | the TTL `<select>`                                    |
| `settings-max-entries`  | the max-entries `<select>`                            |
| `settings-clear-all`    | the "Clear all" button                                |
| `settings-confirm-dialog` | the confirmation `<dialog>` (rendered by ConfirmClearDialog) |
| `settings-confirm-cancel` | Cancel button in the confirmation dialog              |
| `settings-confirm-ok`     | Confirm/Clear button in the confirmation dialog       |
| `settings-status`       | the inline success / failure status banner            |

## §2. Behaviour

| Trigger                                       | Action                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open` becomes `true`                         | `dialogEl.showModal()`. Then `await refresh()` populates `rows` and `quotaText`. The status banner is cleared.                                                                                                                                                                                                                                                                                                                  |
| `Escape` keypress                             | Browser default for `showModal()` — fires `close` event. The component sets `open = false` and notifies the parent.                                                                                                                                                                                                                                                                                                            |
| Click on scrim (the `::backdrop` pseudo)      | Browser default — same as Escape (we don't need a custom handler).                                                                                                                                                                                                                                                                                                                                                              |
| Click on `settings-close`                     | `onClose()` → `dialogEl.close()` → `close` event → `open = false`.                                                                                                                                                                                                                                                                                                                                                              |
| Click on `settings-cache-row-X-clear`         | Sets `confirmTarget = { kind: 'one', name: X }`. Renders `<ConfirmClearDialog>` which `showModal()`s.                                                                                                                                                                                                                                                                                                                          |
| Click on `settings-clear-all`                 | Sets `confirmTarget = { kind: 'all' }`. Renders confirmation dialog.                                                                                                                                                                                                                                                                                                                                                            |
| Click on `settings-confirm-cancel`            | Sets `confirmTarget = null`. The `<ConfirmClearDialog>` un-mounts.                                                                                                                                                                                                                                                                                                                                                              |
| Click on `settings-confirm-ok`                | Sets `busy = true`. Calls `clearCache(name)` or `clearAllTileCaches()` per `confirmTarget.kind`. On success, sets `statusMessage = '...localised confirmation...'` and re-`refresh()`es. On failure (caught), sets `statusMessage = '...localised error...'`. Either way, sets `busy = false` and `confirmTarget = null` last.                                                                                                                |
| Change of `settings-ttl`                      | `saveTileTtlDays(newValue)` → fire-and-forget `enforceCachePolicy(newValue, currentMaxEntries)` → on completion, `refresh()` and a status banner naming the affected cache count change. The TTL `<select>` is disabled while purge is in flight.                                                                                                                                                                                |
| Change of `settings-max-entries`              | `saveTileMaxEntries(newValue)` → fire-and-forget `enforceCachePolicy(currentTtl, newValue)` → on completion, `refresh()` and a status banner. Same disabled-during-flight handling.                                                                                                                                                                                                                                              |
| Locale change while sheet is open             | Re-renders all text (Svelte reactivity on `$tStore`). No need to close/re-open.                                                                                                                                                                                                                                                                                                                                                  |
| Cache inspection unavailable (rows[i].count === null) | Row renders the localised "—" placeholder for the count and disables that row's clear button (FR-016).                                                                                                                                                                                                                                                                                                                          |

## §3. Visual / layout

| Property              | Value                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Position              | Browser-managed (HTML5 `<dialog>` modal), centred horizontally, vertically near the top.                                                       |
| Max-width             | `min(440px, calc(100vw - var(--space-4) * 2))`                                                                                                  |
| Padding               | `var(--space-5)` inside the dialog                                                                                                              |
| Scrim                 | `dialog::backdrop { background: rgba(15, 23, 42, 0.6); }` (matches the LocalePicker pattern).                                                  |
| Border / shadow       | Reuse `--color-border` + `--shadow-elev` tokens from `tokens.css`.                                                                              |
| Border radius         | `12px`                                                                                                                                          |
| Tap targets           | All buttons ≥ 36 × 36 px (verified via `getBoundingClientRect`).                                                                                |
| Open / close          | CSS `transition: opacity 120ms ease, transform 120ms ease` on the dialog; gated off by `@media (prefers-reduced-motion: reduce)`.              |
| Danger button styling | `.danger { background: var(--color-danger-bg); color: var(--color-danger-fg); }` — if these tokens are absent from `tokens.css` they are added in this PR (one-line addition documented in `docs/ui/0007-settings-tile-cache.md`). |

## §4. Accessibility (FR-018)

| Aspect              | Requirement                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Element             | A real `<dialog>` (browser-managed focus-trap + Escape close).                                                                                                |
| Title link          | The dialog's first heading has `id="settings-title"` and the `<dialog>` has `aria-labelledby="settings-title"`.                                              |
| Status banner       | `role="status"` + `aria-live="polite"`. Screen readers announce success/failure without interrupting.                                                         |
| Confirm dialog      | Same `<dialog>` pattern; `aria-labelledby` to its own title; focus moves to Cancel by default (browser default for `showModal`).                              |
| Tap target          | All buttons + `<select>` ≥ 36 × 36 px (SC-005). Verified by integration test.                                                                                 |
| Keyboard            | Tab cycles within the dialog (browser default for `showModal`). `Enter` activates buttons. `Escape` closes. `Space` toggles `<select>`.                       |
| Contrast            | All text MUST meet ≥ 4.5:1 against the dialog's background in both light AND dark schemes. Danger-button colours hit ≥ 4.5:1 against white text in light mode and against dark text in dark mode. Verified by source-token check pattern (`tests/integration/settings-contrast.spec.ts`). |
| Reduced motion      | Dialog open/close transitions skipped by the existing `@media (prefers-reduced-motion: reduce)` block.                                                        |

## §5. i18n keys

The component reads ~22 keys via `$tStore(...)`. All keys MUST exist
in `zh / en / ja`. Missing-key fallback returns the key verbatim per
the existing i18n behaviour.

| Key                                       | zh                                       | en                                                    | ja                                              |
| ----------------------------------------- | ---------------------------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `settings.title`                          | `設定`                                   | `Settings`                                            | `設定`                                          |
| `settings.close`                          | `關閉`                                   | `Close`                                               | `閉じる`                                        |
| `settings.licenceNotice`                  | `圖磚快取僅作為短暫離線備援，不提供地圖下載功能。依 OpenStreetMap、NLSC、Google 圖磚使用條款，不得進行散布或大量預先下載。` | `The tile cache exists solely as a short-term offline fallback. Bulk map downloading is forbidden by the OpenStreetMap, NLSC, and Google tile-source licences.` | `タイルキャッシュは短時間のオフラインフォールバックとしてのみ使用されます。OpenStreetMap、NLSC、Google のタイル利用規約により、地図の一括ダウンロードや再配布は禁止されています。` |
| `settings.cache.heading`                  | `圖磚快取`                                | `Tile caches`                                         | `タイルキャッシュ`                              |
| `settings.cache.source.osm`               | `OpenStreetMap`                          | `OpenStreetMap`                                       | `OpenStreetMap`                                 |
| `settings.cache.source.nlsc`              | `NLSC 國土測繪中心`                       | `NLSC (Taiwan)`                                       | `NLSC（台湾国土測量センター）`                  |
| `settings.cache.source.google`            | `Google`                                 | `Google`                                              | `Google`                                        |
| `settings.cache.entries`                  | `{count} / {cap} 筆`                      | `{count} of {cap}`                                    | `{count} / {cap} 件`                            |
| `settings.cache.unavailable`              | `—`                                       | `—`                                                   | `—`                                             |
| `settings.cache.clear.row`                | `清除`                                    | `Clear`                                               | `クリア`                                        |
| `settings.quota.estimateLabel`            | `瀏覽器儲存粗估：≈ {usageMb} MB`           | `Browser storage estimate: ≈ {usageMb} MB`            | `ブラウザ ストレージの概算: 約 {usageMb} MB`    |
| `settings.quota.unavailable`              | `瀏覽器儲存粗估：—`                        | `Browser storage estimate: —`                         | `ブラウザ ストレージの概算: —`                  |
| `settings.ttl.label`                      | `保留天數`                                | `Retention TTL`                                       | `保持日数`                                      |
| `settings.ttl.option`                     | `{days} 天`                               | `{days} days`                                         | `{days} 日`                                     |
| `settings.maxEntries.label`               | `每個圖磚來源上限`                          | `Per-source entry limit`                              | `ソースごとの上限`                              |
| `settings.clear.all.button`               | `清除全部圖磚快取`                          | `Clear all map tile cache`                            | `すべてのタイルキャッシュをクリア`              |
| `settings.confirm.title`                  | `確認清除？`                                | `Confirm clear?`                                      | `クリアしますか？`                              |
| `settings.confirm.body.all`               | `將清除全部三個來源的圖磚快取。下次造訪該區域時需重新下載。` | `This clears the cached tiles for all three sources. The tiles will be re-fetched on your next visit to those areas.` | `3 つのソースのタイルキャッシュをすべてクリアします。次回その地域を表示する際に再取得されます。` |
| `settings.confirm.body.one`               | `將清除「{source}」的圖磚快取。`            | `This clears the cached tiles for "{source}".`        | `「{source}」のタイルキャッシュをクリアします。` |
| `settings.confirm.cancel`                 | `取消`                                    | `Cancel`                                              | `キャンセル`                                    |
| `settings.confirm.confirm`                | `清除`                                    | `Clear`                                               | `クリア`                                        |
| `settings.status.cleared.all`             | `已清除全部圖磚快取`                        | `All tile caches cleared`                             | `すべてのタイルキャッシュをクリアしました`      |
| `settings.status.cleared.one`             | `已清除「{source}」的圖磚快取`              | `Cleared "{source}" tile cache`                       | `「{source}」のタイルキャッシュをクリアしました` |
| `settings.status.purged.ttl`              | `TTL 已更新為 {days} 天，已清除 {count} 筆過期項目` | `TTL updated to {days} days; {count} expired entries removed` | `TTL を {days} 日に変更し、期限切れの {count} 件を削除しました` |
| `settings.status.trimmed.maxEntries`      | `每來源上限已更新為 {cap}，已清除 {count} 筆`   | `Per-source limit updated to {cap}; {count} entries trimmed` | `ソースごとの上限を {cap} に変更し、{count} 件をトリミングしました` |
| `settings.status.error`                   | `操作失敗，請稍後重試`                      | `Action failed; please try again`                     | `操作に失敗しました。しばらくしてから再試行してください。` |
| `settings.toolbar.button`                 | `設定`                                    | `Settings`                                            | `設定`                                          |

(All `zh` strings use Taiwan Traditional Chinese terminology per the
locale convention. `en` and `ja` strings follow the wording style of
features 003–005's existing keys.)

## §6. Required tests

`tests/unit/components/SettingsSheet.spec.ts` MUST cover:

1. **Sheet opens via `open=true`** — `<dialog>` has `open` attribute;
   `data-testid="settings-sheet"` present.
2. **Three rows render**, ordered OSM / NLSC / Google.
3. **Each row shows the count from `countCacheEntries`** — uses
   the fake `caches` set up in the test helper.
4. **Each row shows the cap from preferences**.
5. **Quota estimate renders** with the `≈` prefix on success path.
6. **Quota estimate shows "—" placeholder** when `estimateQuota`
   returns `{ usage: null, quota: null }`.
7. **Click on `settings-clear-all` opens the confirmation dialog**
   and does NOT yet call `clearAllTileCaches`.
8. **Confirm in the dialog calls `clearAllTileCaches` exactly once**
   and re-`refresh()`es the rows.
9. **Cancel in the dialog leaves caches untouched**.
10. **Per-row clear opens a confirmation naming that source**.
11. **Confirm per-row calls `clearCache(name)` exactly once**.
12. **TTL change calls `saveTileTtlDays` AND `enforceCachePolicy`**
    with the new value and the current max-entries value.
13. **Max-entries change calls `saveTileMaxEntries` AND
    `enforceCachePolicy`** with the current TTL and the new max.
14. **Locale switch re-renders the licence notice** in the new
    locale (`vi.runOnlyPendingTimers` after `setLocale('en')` →
    expect English text).
15. **Tap targets** — every visible button and the two `<select>`
    elements have `getBoundingClientRect()` width AND height ≥ 36.
16. **Keyboard close** — dispatching `Escape` keydown closes the
    sheet.
17. **`<dialog>` exposes `aria-labelledby`** pointing to the title
    element's `id`.
18. **Status banner uses `role="status"`** when set.

Integration spec `tests/integration/settings-clear-cache.spec.ts`
covers the cross-module flow:

19. **Open → clear-all → confirm → counts go to zero → close →
    re-open → counts still zero**, exercising the real
    `cachePurge`/`cacheStats` modules against the fake CacheStorage.
20. **TTL change triggers a real purge** — pre-seed entries with
    mixed dates, change TTL, assert exactly the stale ones are gone.
21. **Max-entries change triggers a real trim** — pre-seed 100
    entries, change cap to 30, assert exactly the most-recent 30
    survive (oldest-first deletion).

## §7. Out of scope (explicitly NOT in this contract)

- The component does NOT subscribe to `CacheStorage` events
  directly — there are no events; refresh is driven by
  `refresh()` calls.
- The component does NOT call `caches.delete(name)` (whole-namespace
  delete). It uses the `cachePurge` exports only.
- The component does NOT render per-tile information.
- The component does NOT offer a "download an area" / "prefetch" /
  "refresh map" affordance under any guise. Such a feature would
  fail the SC-006 audit and the FR-013 + FR-021 review.
