<script lang="ts">
  export let text: string;
</script>

<small class="attribution" data-testid="attribution">{text}</small>

<style>
  .attribution {
    position: absolute;
    right: var(--space-2, 8px);
    bottom: var(--space-2, 8px);
    padding: 2px var(--space-2, 8px);
    background: rgba(255, 255, 255, 0.82);
    color: var(--color-fg, #0f172a);
    font-size: 12px;
    line-height: 1.3;
    border-radius: 4px;
    pointer-events: none;
    z-index: 4;
  }
</style>
