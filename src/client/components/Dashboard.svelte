<script lang="ts">
  import InstanceList from './InstanceList.svelte';
  import TerminalPanel from './TerminalPanel.svelte';
</script>

<div class="dashboard">
  <aside class="sidebar">
    <InstanceList />
  </aside>
  <main class="main-area">
    <TerminalPanel />
  </main>
</div>

<style>
  .dashboard {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    border-right: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
