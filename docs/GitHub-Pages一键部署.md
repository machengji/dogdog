# GitHub Pages 一键部署

## 一次性配置（首次）

1. 把仓库代码推送到 GitHub 的 `master` 分支。
2. 打开仓库页面：`Settings -> Pages`。
3. 在 `Build and deployment` 中选择 `Source: GitHub Actions`。

完成后，后续每次推送都会自动触发部署。

## 日常发布（每次更新网页）

1. 在 Cocos Creator 中构建 `Web Desktop`，确认生成：

```text
build/web-desktop/index.html
```

2. 在项目根目录执行：

```bash
npm run pages:publish
```

脚本会自动完成：

- 暂存 Pages 相关文件（包括 `build/web-desktop`）
- 自动提交
- `git push origin master`
- 触发 GitHub Actions 部署到 Pages

## 部署地址

默认地址格式：

```text
https://<你的GitHub用户名>.github.io/<仓库名>/
```

本仓库通常是：

```text
https://machengji.github.io/dogdog/
```

## 你这次报错的处理方式

报错：

```text
Get Pages site failed. Please verify that the repository has Pages enabled and configured to build using GitHub Actions.
```

这表示仓库还没有启用 Pages，或者没有切到 GitHub Actions 源。

处理顺序：

1. 先去 `Settings -> Pages` 手动设置 `Source: GitHub Actions`。
2. 重新运行工作流（`Actions -> Deploy Web To GitHub Pages -> Re-run jobs`）。

## 可选：让工作流自动启用 Pages

当前工作流已支持可选自动启用逻辑：

- 如果仓库里存在 `PAGES_PAT` Secret，就会尝试自动启用 Pages。
- 如果没有 `PAGES_PAT`，则按普通模式部署（要求你已手动开启 Pages）。

创建 `PAGES_PAT` 的要求：

1. 使用 Fine-grained PAT 或 classic PAT。
2. 需要对该仓库有管理权限（至少可修改 Pages 设置）。
3. 在仓库 `Settings -> Secrets and variables -> Actions` 新增：
   - Name: `PAGES_PAT`
   - Value: 你的 token

## 常见问题

1. `Missing build/web-desktop/index.html`
先在 Creator 里构建一次 `Web Desktop`，再提交。

2. 页面 404
通常是 Pages 尚未启用，或刚部署完成还在生效（等待 1-5 分钟后刷新）。

3. 页面白屏
先 `Ctrl+F5` 强刷，再看浏览器控制台是否有资源 404。

