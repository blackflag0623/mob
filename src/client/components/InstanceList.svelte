<script lang="ts">
  import InstanceCard from './InstanceCard.svelte';
  import { sortedInstances, wsClient } from '../lib/stores.js';

  $: resumableInstances = $sortedInstances.filter(
    (i) => i.managed && i.state === 'stopped'
  );

  function resumeAll() {
    for (const instance of resumableInstances) {
      wsClient.send({ type: 'resume', payload: { instanceId: instance.id } });
    }
  }
</script>

<div class="instance-list">
  {#if $sortedInstances.length === 0}
    <div class="empty">
      <p>No instances</p>
      <p class="hint">Launch a new Claude instance or start one externally with hooks installed.</p>
    </div>
  {:else}
    {#if resumableInstances.length > 1}
      <button class="resume-all-btn" on:click={resumeAll}>
        Resume all ({resumableInstances.length})
      </button>
    {/if}
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

  .resume-all-btn {
    font-size: 12px;
    padding: 6px 12px;
    border-radius: 6px;
    color: var(--accent);
    border: 1px solid var(--accent);
    background: transparent;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
  }

  .resume-all-btn:hover {
    background: rgba(88, 166, 255, 0.15);
  }
</style>
