<script lang="ts">
  import { onMount } from 'svelte';
  import { offlineReadySignal, dismissOfflineReady } from '../../../src/pwa/updateSignal';
  import { tStore } from '../../../src/i18n/index';

  // Mirrors the toast block in App.svelte so we can integration-test the
  // store + i18n wiring without booting MapLibre. App.svelte uses the
  // exact same store + key + 5s setTimeout dismissal pattern.

  let timer: ReturnType<typeof setTimeout> | null = null;

  $: if ($offlineReadySignal.visible) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      dismissOfflineReady();
      timer = null;
    }, 5000);
  }

  onMount(() => {
    return () => {
      if (timer) clearTimeout(timer);
    };
  });
</script>

{#if $offlineReadySignal.visible}
  <div class="toast" role="status" aria-live="polite" data-testid="offline-ready-toast">
    {$tStore('pwa.offline.ready')}
  </div>
{/if}
