import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import 'xterm/css/xterm.css';
// Apply persisted wallpaper before first paint.
import './lib/wallpaper.js';

const app = mount(App, {
  target: document.getElementById('app')!,
});

export default app;
