<script lang="ts">
  import InstanceCard from './InstanceCard.svelte';
  import { sortedInstances } from '../lib/stores.js';
</script>

<div class="instance-list">
  {#if $sortedInstances.length === 0}
    <div class="empty">
      <p>No instances</p>
      <p class="hint">Launch a new Claude instance or start one externally with hooks installed.</p>
    </div>
  {:else}
    {#each $sortedInstances as instance (instance.id)}
      <InstanceCard {instance} />
    {/each}
  {/if}
</div>

<style>
  .instance-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    overflow-y: auto;
    flex: 1;
  }

  .empty {
    text-align: center;
    padding: 32px 16px;
    color: var(--text-muted);
  }

  .empty p {
    margin-bottom: 8px;
  }

  .hint {
    font-size: 12px;
  }
</style>
