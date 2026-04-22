<script lang="ts">
  import { fileTreeCache, expandedDirs, selectedFile, fileTreeLoading } from '../lib/stores.js';
  import { instanceUrl } from '../lib/rest.js';
  import type { FileEntry } from '../lib/types.js';

  export let instanceId: string;
  export let entries: FileEntry[] | null = null;
  export let depth = 0;

  let rootEntries: FileEntry[] = [];
  let error: string | null = null;

  // Only root (depth===0) loads on instanceId change
  $: if (depth === 0 && instanceId) {
    rootEntries = [];
    error = null;
    loadDirectory('');
  }

  $: items = entries ?? rootEntries;

  async function loadDirectory(dirPath: string) {
    if (dirPath === '' && depth === 0) fileTreeLoading.set(true);
    error = null;
    try {
      const q = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await fetch(instanceUrl(instanceId, `/files${q}`));
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load');
      }
      const data = await res.json();
      const key = `${instanceId}:${dirPath}`;
      fileTreeCache.update(c => { c.set(key, data.entries); return new Map(c); });
      if (dirPath === '' && depth === 0) rootEntries = data.entries;
    } catch (e: any) {
      if (dirPath === '' && depth === 0) error = e.message;
    } finally {
      if (dirPath === '' && depth === 0) fileTreeLoading.set(false);
    }
  }

  function toggleDir(entry: FileEntry) {
    expandedDirs.update(s => {
      if (s.has(entry.path)) {
        s.delete(entry.path);
      } else {
        s.add(entry.path);
        const key = `${instanceId}:${entry.path}`;
        if (!$fileTreeCache.has(key)) loadDirectory(entry.path);
      }
      return new Set(s);
    });
  }

  function handleClick(entry: FileEntry) {
    if (entry.type === 'directory') toggleDir(entry);
    else selectedFile.set({ instanceId, path: entry.path });
  }

  function formatSize(bytes?: number): string {
    if (bytes == null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="file-tree" class:root={depth === 0}>
  {#if depth === 0 && $fileTreeLoading && items.length === 0}
    <div class="status">Loading...</div>
  {:else if depth === 0 && error}
    <div class="status error">{error}</div>
  {:else}
    {#each items as entry (entry.path)}
      {@const isDir = entry.type === 'directory'}
      {@const expanded = $expandedDirs.has(entry.path)}
      <button
        class="tree-item"
        class:selected={$selectedFile?.path === entry.path}
        style="padding-left: {8 + depth * 16}px"
        on:click={() => handleClick(entry)}
      >
        <span class="chevron">{isDir ? (expanded ? '▾' : '▸') : ' '}</span>
        <span class="icon">{isDir ? (expanded ? '📂' : '📁') : '📄'}</span>
        <span class="name">{entry.name}</span>
        {#if !isDir && entry.size}<span class="size">{formatSize(entry.size)}</span>{/if}
      </button>
      {#if isDir && expanded}
        <svelte:self
          {instanceId}
          entries={$fileTreeCache.get(`${instanceId}:${entry.path}`) || []}
          depth={depth + 1}
        />
      {/if}
    {/each}
  {/if}
</div>

<style>
  .file-tree.root { padding: 4px 0; }

  .tree-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 3px 8px;
    border: none;
    background: none;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 13px;
    text-align: left;
    white-space: nowrap;
  }

  .tree-item:hover { background: var(--bg-tertiary); }
  .tree-item.selected { background: var(--accent); color: white; }

  .chevron { width: 12px; font-size: 10px; flex-shrink: 0; }
  .icon { margin-right: 4px; font-size: 14px; flex-shrink: 0; }
  .name { overflow: hidden; text-overflow: ellipsis; }
  .size { margin-left: auto; padding-left: 8px; font-size: 11px; color: var(--text-muted); flex-shrink: 0; }

  .status { padding: 16px; text-align: center; color: var(--text-muted); font-size: 13px; }
  .error { color: var(--red); }
</style>
