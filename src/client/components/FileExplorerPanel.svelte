<script lang="ts">
  import FileTree from './FileTree.svelte';
  import FileViewer from './FileViewer.svelte';
  import { selectedInstanceId, selectedInstance, selectedFile } from '../lib/stores.js';
</script>

<div class="file-explorer">
  {#if !$selectedInstance}
    <div class="empty-state">
      <p>No instance selected</p>
      <p class="hint">Select an instance from the sidebar to browse files</p>
    </div>
  {:else}
    <div class="explorer-layout">
      <div class="tree-panel">
        <FileTree instanceId={$selectedInstanceId} />
      </div>
      {#if $selectedFile}
        <div class="viewer-panel">
          <FileViewer />
        </div>
      {:else}
        <div class="viewer-panel empty-viewer">
          <p>Select a file to view its contents</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .file-explorer {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }

  .empty-state p { margin: 4px 0; }
  .empty-state .hint { font-size: 12px; }

  .explorer-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .tree-panel {
    width: 280px;
    min-width: 180px;
    max-width: 500px;
    border-right: 1px solid var(--border);
    overflow: auto;
    background: var(--bg-secondary);
  }

  .viewer-panel {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .empty-viewer {
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>
