<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { selectedInstance, selectedInstanceId, wsClient } from '../lib/stores.js';
  import type { InstanceInfo } from '../lib/types.js';

  let terminalEl: HTMLDivElement;
  let terminal: Terminal | null = null;
  let fitAddon: FitAddon | null = null;
  let currentSubscription: string | null = null;
  let unsubMessage: (() => void) | null = null;
  let quickInput = '';
  let resizeObserver: ResizeObserver | null = null;

  // Cache terminals per instance
  const terminalCache = new Map<string, { terminal: Terminal; fitAddon: FitAddon }>();

  function getOrCreateTerminal(instanceId: string): { terminal: Terminal; fitAddon: FitAddon } {
    let cached = terminalCache.get(instanceId);
    if (!cached) {
      const t = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
          black: '#484f58',
          red: '#f85149',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39d353',
          white: '#e6edf3',
          brightBlack: '#6e7681',
          brightRed: '#ffa198',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d364',
          brightWhite: '#f0f6fc',
        },
        scrollback: 5000,
        convertEol: true,
      });
      const f = new FitAddon();
      t.loadAddon(f);
      cached = { terminal: t, fitAddon: f };
      terminalCache.set(instanceId, cached);
    }
    return cached;
  }

  function attachTerminal(inst: InstanceInfo | null) {
    // Unsubscribe from previous
    if (currentSubscription) {
      wsClient.send({ type: 'terminal:unsubscribe', payload: { instanceId: currentSubscription } });
      if (terminal) {
        terminal.element?.remove();
      }
      currentSubscription = null;
    }

    if (!inst || !inst.managed || !terminalEl) {
      terminal = null;
      fitAddon = null;
      return;
    }

    const cached = getOrCreateTerminal(inst.id);
    terminal = cached.terminal;
    fitAddon = cached.fitAddon;

    // Clear container and attach
    terminalEl.innerHTML = '';
    if (!terminal.element) {
      terminal.open(terminalEl);
    } else {
      terminalEl.appendChild(terminal.element);
    }

    fitAddon.fit();

    // Subscribe to output
    wsClient.send({ type: 'terminal:subscribe', payload: { instanceId: inst.id } });
    currentSubscription = inst.id;

    // Send resize
    wsClient.send({
      type: 'terminal:resize',
      payload: { instanceId: inst.id, cols: terminal.cols, rows: terminal.rows },
    });

    // Forward input
    terminal.onData((data) => {
      wsClient.send({ type: 'terminal:input', payload: { instanceId: inst.id, data } });
    });
  }

  function handleQuickSend() {
    if (!quickInput.trim() || !$selectedInstanceId) return;
    wsClient.send({
      type: 'terminal:input',
      payload: { instanceId: $selectedInstanceId, data: quickInput + '\r' },
    });
    quickInput = '';
  }

  onMount(() => {
    unsubMessage = wsClient.onMessage((msg) => {
      if (msg.type === 'terminal:output' && msg.payload.instanceId === currentSubscription) {
        terminal?.write(msg.payload.data);
      }
    });

    resizeObserver = new ResizeObserver(() => {
      if (fitAddon && terminal) {
        fitAddon.fit();
        if (currentSubscription) {
          wsClient.send({
            type: 'terminal:resize',
            payload: { instanceId: currentSubscription, cols: terminal.cols, rows: terminal.rows },
          });
        }
      }
    });
    if (terminalEl) resizeObserver.observe(terminalEl);
  });

  onDestroy(() => {
    unsubMessage?.();
    resizeObserver?.disconnect();
    if (currentSubscription) {
      wsClient.send({ type: 'terminal:unsubscribe', payload: { instanceId: currentSubscription } });
    }
  });

  $: attachTerminal($selectedInstance);
</script>

<div class="terminal-panel">
  {#if $selectedInstance}
    {#if $selectedInstance.managed}
      <div class="quick-input">
        <input
          type="text"
          bind:value={quickInput}
          on:keydown={(e) => e.key === 'Enter' && handleQuickSend()}
          placeholder="Quick send to Claude..."
        />
        <button on:click={handleQuickSend}>Send</button>
      </div>
      <div class="terminal-container" bind:this={terminalEl}></div>
    {:else}
      <div class="external-info">
        <h3>External Instance</h3>
        <div class="info-grid">
          <span class="label">ID:</span><span>{$selectedInstance.id}</span>
          <span class="label">CWD:</span><span>{$selectedInstance.cwd}</span>
          {#if $selectedInstance.gitBranch}
            <span class="label">Branch:</span><span>{$selectedInstance.gitBranch}</span>
          {/if}
          <span class="label">State:</span><span>{$selectedInstance.state}</span>
          {#if $selectedInstance.currentTool}
            <span class="label">Tool:</span><span>{$selectedInstance.currentTool}</span>
          {/if}
          {#if $selectedInstance.model}
            <span class="label">Model:</span><span>{$selectedInstance.model}</span>
          {/if}
        </div>
        <p class="external-hint">
          This instance was started externally. Terminal I/O is only available for managed instances.
        </p>
      </div>
    {/if}
  {:else}
    <div class="no-selection">
      <p>Select an instance from the sidebar</p>
      <p class="hint">or launch a new one with the button above</p>
    </div>
  {/if}
</div>

<style>
  .terminal-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    overflow: hidden;
  }

  .quick-input {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
  }

  .quick-input input {
    flex: 1;
    font-size: 13px;
  }

  .quick-input button {
    background: var(--accent);
    color: #fff;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .quick-input button:hover {
    background: var(--accent-hover);
  }

  .terminal-container {
    flex: 1;
    padding: 4px;
    overflow: hidden;
  }

  .terminal-container :global(.xterm) {
    height: 100%;
  }

  .no-selection, .external-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted);
    gap: 8px;
  }

  .hint, .external-hint {
    font-size: 12px;
    color: var(--text-muted);
  }

  .external-info h3 {
    color: var(--text-primary);
    margin-bottom: 16px;
  }

  .info-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 13px;
    max-width: 500px;
  }

  .label {
    color: var(--text-secondary);
    font-weight: 600;
  }

  .external-hint {
    margin-top: 24px;
    text-align: center;
    max-width: 300px;
  }
</style>
