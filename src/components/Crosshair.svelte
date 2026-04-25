<script lang="ts">
  export let ariaLabel: string = '';
</script>

<div class="crosshair" role="img" aria-label={ariaLabel} data-testid="crosshair" aria-live="off">
  <svg viewBox="0 0 48 48" width="48" height="48" focusable="false" aria-hidden="true">
    <!-- Dark halo ring for light tiles -->
    <circle cx="24" cy="24" r="11" fill="none" stroke="#0f172a" stroke-width="3" />
    <!-- Light inner ring for dark tiles -->
    <circle cx="24" cy="24" r="11" fill="none" stroke="#ffffff" stroke-width="1" />
    <!-- Cross strokes with dark underlay + light overlay -->
    <line x1="24" y1="2" x2="24" y2="14" stroke="#0f172a" stroke-width="3" />
    <line x1="24" y1="34" x2="24" y2="46" stroke="#0f172a" stroke-width="3" />
    <line x1="2" y1="24" x2="14" y2="24" stroke="#0f172a" stroke-width="3" />
    <line x1="34" y1="24" x2="46" y2="24" stroke="#0f172a" stroke-width="3" />
    <line x1="24" y1="2" x2="24" y2="14" stroke="#ffffff" stroke-width="1" />
    <line x1="24" y1="34" x2="24" y2="46" stroke="#ffffff" stroke-width="1" />
    <line x1="2" y1="24" x2="14" y2="24" stroke="#ffffff" stroke-width="1" />
    <line x1="34" y1="24" x2="46" y2="24" stroke="#ffffff" stroke-width="1" />
    <!-- Center dot -->
    <circle cx="24" cy="24" r="2" fill="#0f172a" />
    <circle cx="24" cy="24" r="1" fill="#ffffff" />
  </svg>
</div>

<style>
  .crosshair {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 48px;
    height: 48px;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 5;
  }
</style>
