<script lang="ts">
  export let progress: number | undefined;
</script>

{#if progress !== undefined && progress >= 0}
  <div class="progress-bar">
    <div class="progress-fill" style="width: {Math.min(100, Math.max(0, progress))}%"></div>
    <span class="progress-label">{Math.round(progress)}%</span>
  </div>
{/if}

<style>
  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-primary);
    border-radius: 2px;
    position: relative;
    margin-top: 6px;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-label {
    position: absolute;
    right: 0;
    top: -16px;
    font-size: 10px;
    color: var(--text-muted);
  }
</style>
