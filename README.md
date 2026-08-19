# dsh-client-sidebar-overlay

DeepSeek Harness（DSH）Web 界面的客户端插件：**侧栏弹出层**。

## 使用场景

本插件为 **VS Code 侧栏嵌入场景**设计：通过社区扩展（如 [deepseek-harness-vsc-extension](https://github.com/weinibuliu/deepseek-harness-vsc-extension)、[dsh-vscode](https://github.com/Lixxx1/dsh-vscode)、[deepseek-harness-for-vscode](https://github.com/skymecode/deepseek-harness-for-vscode) 等）把 `dsh web` 壳嵌进 VS Code 侧栏 webview 时，可用宽度非常宝贵——原生侧栏一展开就挤掉大半对话区。装上本插件后，侧栏平时完全收起，需要时以浮层形式盖在对话上方，用完即收，对话区始终占满全部宽度。

> 💡 **个人推荐仅在 VS Code（或类似的窄宽度嵌入环境）中使用。** 在桌面全宽浏览器里，原生的常驻侧栏布局通常是更好的选择，本插件不会带来明显收益。

## 功能

- 🐳 **鲸鱼开关**：会话头部「Session log」右侧出现鲸鱼图标，点击后侧栏以浮层形式弹出（不占用布局宽度），再点或点击外部收起；若侧栏处于图标栏状态会先自动展开为完整宽度。主界面（新建会话页）没有会话头部，此时右上角会出现一个**浮动鲸鱼按钮**作为入口，进入会话后自动让位给头部开关。
- ⇄ **左右换边**：侧栏底部的「侧栏移到左/右侧」按钮，切换浮层从哪一侧滑出，样式与产品底部行一致。
- 📐 **fixed 面板适配**：侧栏列使用 transform 定位后，`position:fixed` 的后代面板（如 Cordis 插件面板）会以侧栏列为定位基准；插件在侧栏居右时把它们的 `left` 锚点改写为等值 `right`，居左时还原。
- 🔽 **select 替身**：原生 `<select>` 的系统下拉无法被页面钳制，侧栏内的原生下拉被替换为页面内弹层（选项同步、回写 `value` + `change` 事件）。
- 🧲 **弹层钳制**：所有 `role=menu/listbox/tooltip/dialog/alertdialog` 的弹层飞出屏幕左右边缘时自动平移回可视区。

## 安装

假设 `DSH_HOME` 为 `~/.dsh`（默认值）：

1. 把本目录复制到 web profile 的 node_modules：

   ```bash
   cp -r dsh-client-sidebar-overlay ~/.dsh/profiles/web/node_modules/
   ```

2. 编辑 `~/.dsh/profiles/web/cordis.patch.yml`，加入一行插入项：

   ```yaml
   - insert:
       - id: ui-sidebar-overlay
         name: dsh-client-sidebar-overlay
   ```

3. 重启 `dsh web`。插件随 profile 自动挂载，无需审批。

验证组合是否正常（可选）：

```bash
dsh --profile web --dump-config | grep ui-sidebar-overlay
```

## 卸载

1. 从 `cordis.patch.yml` 删除上面的 `- insert:` 段（或整行）；
2. 删除 `~/.dsh/profiles/web/node_modules/dsh-client-sidebar-overlay`；
3. 重启 `dsh web`。

## 文件说明

| 文件 | 说明 |
|------|------|
| `package.json` | 包清单，含 `dsh.client.platform: "web"` 声明 |
| `index.js` | 宿主侧空占位（loader 要求） |
| `client.js` | 浏览器端全部逻辑（`window.__ModuleLoader__` 格式，依赖 seed 里的 `react`） |

兼容性：随 `@deepseek-ai/dsh` 0.1.0-rc.6 的 web profile 测试通过。DSH 升级后若产品 DOM 结构或 CSS 模块变动，插件内的结构探针（frame/sidebarCol 定位）可能需要调整。
