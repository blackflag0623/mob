<script lang="ts">
  import { onDestroy } from 'svelte';
  import { selectedFile, fileContent, fileContentLoading, fileChanged, wsClient } from '../lib/stores.js';
  import { instanceUrl } from '../lib/rest.js';
  import { createHighlighter, type Highlighter } from 'shiki';

  let prevWatch: { instanceId: string; path: string } | null = null;
  let highlightedHtml = '';
  let highlighter: Highlighter | null = null;

  const THEME = 'github-dark';

  // Initialize shiki lazily on first use
  async function getHighlighter(lang: string): Promise<Highlighter> {
    if (!highlighter) {
      highlighter = await createHighlighter({ themes: [THEME], langs: [lang] });
    } else {
      await highlighter.loadLanguage(lang as any);
    }
    return highlighter;
  }

  $: if ($selectedFile) {
    const same = prevWatch && prevWatch.instanceId === $selectedFile.instanceId && prevWatch.path === $selectedFile.path;
    if (!same) {
      if (prevWatch) {
        wsClient.send({ type: 'files:unwatch', payload: { instanceId: prevWatch.instanceId, filePath: prevWatch.path } });
      }
      wsClient.send({ type: 'files:watch', payload: { instanceId: $selectedFile.instanceId, filePath: $selectedFile.path } });
      prevWatch = { ...$selectedFile };
      loadContent($selectedFile.instanceId, $selectedFile.path);
    }
  }

  // React to file change notifications
  $: if ($fileChanged && $selectedFile &&
    $fileChanged.instanceId === $selectedFile.instanceId &&
    $fileChanged.filePath === $selectedFile.path) {
    loadContent($selectedFile.instanceId, $selectedFile.path);
    fileChanged.set(null);
  }

  onDestroy(() => {
    if (prevWatch) {
      wsClient.send({ type: 'files:unwatch', payload: { instanceId: prevWatch.instanceId, filePath: prevWatch.path } });
    }
    if (highlighter) {
      highlighter.dispose();
      highlighter = null;
    }
  });

  async function loadContent(instanceId: string, filePath: string) {
    fileContentLoading.set(true);
    try {
      const res = await fetch(instanceUrl(instanceId, `/files/content?path=${encodeURIComponent(filePath)}`));
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load file');
      }
      const data = await res.json();
      // Guard against stale response if user switched files during fetch
      if (prevWatch?.instanceId !== instanceId || prevWatch?.path !== filePath) return;
      fileContent.set({ path: filePath, content: data.content, language: data.language });
      highlightedHtml = await buildHighlightedHtml(data.content, data.language);
      // Guard again after async highlight
      if (prevWatch?.instanceId !== instanceId || prevWatch?.path !== filePath) return;
    } catch (e: any) {
      if (prevWatch?.instanceId !== instanceId || prevWatch?.path !== filePath) return;
      fileContent.set({ path: filePath, content: `Error: ${e.message}`, language: undefined });
      highlightedHtml = '';
    } finally {
      fileContentLoading.set(false);
    }
  }

  async function buildHighlightedHtml(content: string, language?: string): Promise<string> {
    if (!language) return '';
    try {
      const hl = await getHighlighter(language);
      return hl.codeToHtml(content, { lang: language, theme: THEME });
    } catch {
      return '';
    }
  }
</script>

<div class="file-viewer">
  {#if $fileContentLoading}
    <div class="loading">Loading...</div>
  {:else if $fileContent}
    <div class="viewer-header">
      <span class="file-path">{$fileContent.path}</span>
      {#if $fileContent.language}
        <span class="lang-badge">{$fileContent.language}</span>
      {/if}
    </div>
    <div class="content-wrapper">
      {#if highlightedHtml}
        <div class="shiki-wrapper">{@html highlightedHtml}</div>
      {:else}
        <pre class="code"><code>{$fileContent.content}</code></pre>
      {/if}
    </div>
  {/if}
</div>

<style>
  .file-viewer {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .viewer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    flex-shrink: 0;
  }

  .file-path {
    font-size: 12px;
    font-family: monospace;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lang-badge {
    font-size: 11px;
    padding: 1px 8px;
    border-radius: 4px;
    background: var(--accent);
    color: white;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .content-wrapper {
    flex: 1;
    overflow: auto;
  }

  .shiki-wrapper :global(pre.shiki) {
    margin: 0;
    padding: 12px 16px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    tab-size: 2;
    overflow-x: auto;
  }

  .code {
    margin: 0;
    padding: 12px 16px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
    background: var(--bg-primary);
    color: var(--text-primary);
    tab-size: 2;
  }

  .loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
  }
</style>
