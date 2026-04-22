<script lang="ts">
  import type { InstanceState } from '../lib/types.js';
  export let state: InstanceState;

  const labels: Record<InstanceState, string> = {
    launching: 'Starting',
    running: 'Running',
    idle: 'Idle',
    waiting: 'Needs Input',
    stopped: 'Stopped',
  };
</script>

<span class="badge {state}">{labels[state] || state}</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .badge::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .running { color: var(--green); background: var(--green-soft); }
  .running::before { background: var(--green); }

  .idle { color: var(--accent); background: var(--accent-soft); }
  .idle::before { background: var(--accent); }

  .waiting { color: var(--yellow); background: var(--yellow-soft); }
  .waiting::before {
    background: var(--yellow);
    animation: pulse 1s ease-in-out infinite;
  }

  .stopped { color: var(--text-muted); background: var(--muted-soft); }
  .stopped::before { background: var(--text-muted); }

  .launching { color: var(--yellow); background: var(--yellow-soft); }
  .launching::before {
    background: var(--yellow);
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
