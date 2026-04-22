<script lang="ts">
  import InstanceList from './InstanceList.svelte';
  import TerminalPanel from './TerminalPanel.svelte';
  import FileExplorerPanel from './FileExplorerPanel.svelte';
  import { selectedInstance, selectedInstanceId, sidebarCollapsed, visualInstances, selectedInCollapsedGroup, activeMainTab } from '../lib/stores.js';

  let toast: { name: string; branch?: string; cwd: string } | null = null;
  let toastKey = 0;
  let toastTimeout: ReturnType<typeof setTimeout> | null = null;
  let prevInstanceId: string | null = null;

  function showToast(inst: { name: string; gitBranch?: string; cwd: string }) {
    if (toastTimeout) clearTimeout(toastTimeout);
    toastKey++;
    toast = { name: inst.name, branch: inst.gitBranch, cwd: inst.cwd };
    toastTimeout = setTimeout(() => { toast = null; }, 2000);
  }

  $: {
    const id = $selectedInstanceId;
    const inst = $selectedInstance;
    if (inst && id !== prevInstanceId && ($sidebarCollapsed || $selectedInCollapsedGroup)) {
      showToast(inst);
    }
    prevInstanceId = id;
  }
</script>

<div class="dashboard">
  <aside class="sidebar" class:collapsed={$sidebarCollapsed}>
    <div class="sidebar-content">
      <InstanceList />
    </div>
    {#if $sidebarCollapsed && $visualInstances.length > 0}
      <div class="mini-instances">
        {#each $visualInstances as inst (inst.id)}
          <button
            class="mini-square {inst.state}"
            class:selected={$selectedInstanceId === inst.id}
            on:click|stopPropagation={() => selectedInstanceId.set(inst.id)}
            title={inst.name}
          ></button>
        {/each}
      </div>
    {/if}
  </aside>
  <button
    class="collapse-toggle"
    class:collapsed={$sidebarCollapsed}
    on:click={() => sidebarCollapsed.update(v => !v)}
    title={$sidebarCollapsed ? 'Expand sidebar (Alt+B)' : 'Collapse sidebar (Alt+B)'}
  >
    <span class="collapse-icon">{$sidebarCollapsed ? '›' : '‹'}</span>
  </button>
  <main class="main-area">
    <div class="tab-bar">
      <button class="tab" class:active={$activeMainTab === 'terminal'} on:click={() => activeMainTab.set('terminal')}>Terminal</button>
      <button class="tab" class:active={$activeMainTab === 'files'} on:click={() => activeMainTab.set('files')}>Files</button>
    </div>
    {#if toast}
      {#key toastKey}
        <div class="instance-toast">
          <div class="toast-name">{toast.name}</div>
          {#if toast.branch}
            <div class="toast-detail">{toast.branch}</div>
          {/if}
          <div class="toast-detail">{toast.cwd}</div>
        </div>
      {/key}
    {/if}
    <div class="tab-content">
      <div class="tab-pane" class:hidden={$activeMainTab !== 'terminal'}>
        <TerminalPanel />
      </div>
      {#if $activeMainTab === 'files'}
        <div class="tab-pane">
          <FileExplorerPanel />
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  .dashboard {
    flex: 1;
    display: flex;
    gap: 10px;
    overflow: visible;
    position: relative;
  }

  .sidebar {
    width: var(--sidebar-width);
    min-width: var(--sidebar-width);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    background:
      linear-gradient(180deg,
        var(--sidebar-tint-top) 0%,
        rgba(255,255,255,0.04) 18%,
        transparent 45%,
        var(--sidebar-tint-bottom) 100%),
      var(--sidebar-base);
    display: flex;
    flex-direction: row;
    overflow: hidden;
    transition: width 0.2s ease, min-width 0.2s ease;
    position: relative;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      0 1px 3px rgba(0, 0, 0, 0.08),
      0 8px 24px rgba(0, 0, 0, 0.08);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
  }

  .sidebar.collapsed {
    width: 36px;
    min-width: 36px;
    flex-direction: column;
  }

  .sidebar-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar.collapsed .sidebar-content {
    display: none;
  }

  .collapse-toggle {
    position: absolute;
    top: 50%;
    left: calc(var(--sidebar-width) - 6px);
    transform: translateY(-50%);
    width: 22px;
    height: 36px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--bg-primary);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    font-size: 13px;
    box-shadow: var(--shadow-sm);
    opacity: 0;
    transition: opacity 0.15s, color 0.15s, background 0.15s, left 0.2s ease;
    z-index: 5;
  }

  .collapse-toggle.collapsed {
    left: 30px;
  }

  .dashboard:hover .collapse-toggle,
  .collapse-toggle:focus-visible {
    opacity: 1;
  }

  .collapse-toggle:hover {
    color: var(--text-primary);
    background: var(--bg-secondary);
  }

  .collapse-icon {
    line-height: 1;
  }

  .mini-instances {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 0;
    overflow-y: auto;
    flex: 1;
    align-items: center;
  }

  .mini-square {
    width: 20px;
    height: 20px;
    min-height: 20px;
    border-radius: 4px;
    cursor: pointer;
    border: none;
    padding: 0;
    background: var(--text-muted);
    transition: filter 0.15s;
  }

  .mini-square:hover {
    filter: brightness(1.3);
  }

  .mini-square.selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  .mini-square.running {
    background: var(--green);
  }

  .mini-square.idle {
    background: var(--accent);
  }

  .mini-square.waiting,
  .mini-square.launching {
    background: var(--yellow);
    animation: pulse-square 1.5s ease-in-out infinite;
  }

  .mini-square.stopped {
    background: var(--text-muted);
  }

  @keyframes pulse-square {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-bottom: none;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.06);
  }

  .tab-bar {
    display: flex;
    gap: 2px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--separator);
    background: var(--bg-secondary);
    flex-shrink: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
  }

  .tab {
    padding: 4px 14px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    font-size: 12px;
    font-weight: 500;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .tab:hover { background: var(--bg-tertiary); color: var(--text-primary); }
  .tab.active {
    background: var(--bg-primary);
    color: var(--text-primary);
    border-color: var(--border);
    box-shadow: var(--shadow-sm);
  }

  .tab-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .tab-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .tab-pane.hidden {
    display: none;
  }

  .instance-toast {
    position: absolute;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--bg-elevated);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 8px 14px;
    z-index: 100;
    pointer-events: none;
    box-shadow: var(--shadow-md);
    animation: toast-fade 2s ease forwards;
    max-width: 400px;
    text-align: center;
  }

  .toast-name {
    font-weight: 600;
    font-size: 13px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toast-detail {
    font-size: 11px;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
  }

  @keyframes toast-fade {
    0% { opacity: 0; transform: translateX(-50%) translateY(-4px); }
    10% { opacity: 1; transform: translateX(-50%) translateY(0); }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
