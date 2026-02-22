# GitHub Pages 部署说明

## 重要：合并前需要手动更改的设置

在合并此 PR 之前，需要更改 GitHub Pages 的源设置：

### 步骤

1. 打开仓库设置页面：https://github.com/towersxu/auto-game/settings/pages

2. 在 "Build and deployment" → "Source" 部分：
   - 将源从 "GitHub Actions" 更改为 "Deploy from a branch"
   - 选择 "gh-pages" 分支
   - 选择 "/ (root)" 文件夹
   - 点击 "Save"

3. 等待几分钟让更改生效

### 验证

更改设置后，以下 URL 应该可以正常访问：
- 主站点：https://towersxu.github.io/auto-game/
- PR 预览（例如 PR #14）：https://towersxu.github.io/auto-game/14/

### 技术说明

此更改将 GitHub Pages 的部署方式从 "GitHub Actions Artifact 部署" 改为 "gh-pages 分支部署"。这样可以让主站点和 PR 预览使用相同的部署机制：

- 主站点部署到 `gh-pages` 分支根目录
- PR 预览部署到 `gh-pages` 分支的子目录（如 `/14/`）

这种方案允许每个 PR 都有独立的预览 URL。
