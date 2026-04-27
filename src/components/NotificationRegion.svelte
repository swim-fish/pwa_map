<!--
  Feature 009 — single fixed stacking host for transient banners.
  See specs/009-mobile-ui-fixes/contracts/notification-region.md.
-->
<script lang="ts"></script>

<section
  class="notification-region"
  data-testid="notification-region"
  aria-live="polite"
  aria-atomic="false"
>
  <slot />
</section>

<style>
  .notification-region {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: var(--notification-zone-top);
    bottom: auto;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: var(--space-3, 12px);
    max-width: min(360px, calc(100vw - 24px));
    width: max-content;
    pointer-events: none;
  }

  /* Slot children come from the parent component (App.svelte) and so
     do not carry NotificationRegion's svelte-scoped class hash. The
     `:global(...)` wrapper opts the universal child selector out of
     scoping so that `pointer-events: auto` actually lands on banner
     roots — without it Svelte 4 emits `> *.svelte-XXX`, which never
     matches slotted elements and leaves the banner inheriting the
     parent's `pointer-events: none`, making every button untappable. */
  .notification-region > :global(*) {
    pointer-events: auto;
  }

  :global(body[data-dialog-open]) .notification-region {
    top: auto;
    bottom: var(--notification-zone-bottom);
  }
</style>
