# dsh-client-sidebar-overlay

[中文](README.md) | English

Client plugin for the DeepSeek Harness (DSH) web UI: **sidebar as an overlay**.

## Use case

Built for **VS Code sidebar embeds**: when the `dsh web` shell is embedded into a VS Code sidebar webview via community extensions (e.g. [deepseek-harness-vsc-extension](https://github.com/weinibuliu/deepseek-harness-vsc-extension), [dsh-vscode](https://github.com/Lixxx1/dsh-vscode), [deepseek-harness-for-vscode](https://github.com/skymecode/deepseek-harness-for-vscode)), horizontal width is precious — the native sidebar squeezes away most of the conversation as soon as it opens. With this plugin, the sidebar stays fully collapsed by default and pops up as an overlay **on top of** the conversation when needed; dismiss it and the conversation gets the full width back.

> 💡 **Personally I only recommend using this inside VS Code (or similarly narrow embeds).** In a full-width desktop browser, the native persistent sidebar is usually the better layout and this plugin brings no real benefit.

## Features

- 🐳 **Whale toggle**: a whale icon appears right of "Session log" in the session header; clicking it pops the sidebar out as an overlay (zero layout width), clicking again — or clicking outside — collapses it. If the sidebar is in icon-rail state it first auto-expands to full width. On the home screen (new-session page) where no session header exists, a **floating whale button** in the top-right corner serves as the entry point and yields to the header toggle once you enter a session. While the overlay is open the floating whale hides itself (v0.1.3: its corner sat exactly on top of the product's own collapse toggle inside the revealed sidebar) and returns on close; that collapse toggle's clicks are mapped to closing the overlay itself.
- ⇄ **Side switch**: a "move sidebar to left/right" row at the bottom of the sidebar controls which side the overlay slides from, styled like the product's bottom rows.
- 📐 **Fixed-panel adaptation**: once the sidebar column is transform-positioned, `position:fixed` descendants (e.g. Cordis plugin panels) anchor to that column; the plugin rewrites their `left` anchor to an equal `right` when the sidebar sits on the right, and restores it on the left.
- 🔽 **Select shim**: native `<select>` system dropdowns cannot be clamped by the page, so native dropdowns inside the sidebar are replaced with in-page popups (options synced, `value` + `change` events written back).
- 🧲 **Popup clamping**: any `role=menu/listbox/tooltip/dialog/alertdialog` popup that would fly past the left/right screen edge is automatically translated back into the viewport.

## Install

Assuming `DSH_HOME` is `~/.dsh` (the default):

1. Copy this directory into the web profile's node_modules:

   ```bash
   cp -r dsh-client-sidebar-overlay ~/.dsh/profiles/web/node_modules/
   ```

2. Edit `~/.dsh/profiles/web/cordis.patch.yml` and add an insert entry:

   ```yaml
   - insert:
       - id: ui-sidebar-overlay
         name: dsh-client-sidebar-overlay
   ```

3. Restart `dsh web`. The plugin mounts automatically with the profile — no approval needed.

Optionally verify the composition:

```bash
dsh --profile web --dump-config | grep ui-sidebar-overlay
```

## Uninstall

1. Remove the `- insert:` block (or the line) from `cordis.patch.yml`;
2. Delete `~/.dsh/profiles/web/node_modules/dsh-client-sidebar-overlay`;
3. Restart `dsh web`.

## Files

| File | Purpose |
|------|---------|
| `package.json` | Package manifest with the `dsh.client.platform: "web"` declaration |
| `index.js` | Host-side empty placeholder (required by the loader) |
| `client.js` | All browser-side logic (`window.__ModuleLoader__` format, depends on `react` from the seed) |

Compatibility: tested against the web profile of `@deepseek-ai/dsh` 0.1.0-rc.7. If a DSH upgrade changes the product DOM structure or CSS modules, the structural probes in this plugin (frame/sidebarCol locating) may need adjusting.
