# GitHub Pages 一键部署

## 一次性配置（首次）

1. 把仓库代码推送到 GitHub 的 `master` 分支。
2. 打开仓库页面：`Settings -> Pages`
3. 在 `Build and deployment` 里选择 `Source: GitHub Actions`

完成后，后续每次推送都会自动部署网页版本。

## 日常发布（每次更新网页）

1. 在 Cocos Creator 里构建 `Web Desktop`，确认生成：

```text
build/web-desktop/index.html
```

2. 在项目根目录执行：

```bash
npm run pages:publish
```

脚本会自动完成：

- `git add`（包括 `build/web-desktop`）
- 自动提交
- `git push origin master`
- 触发 GitHub Actions 部署到 Pages

## 部署地址

默认地址格式：

```text
https://<你的GitHub用户名>.github.io/<仓库名>/
```

你的仓库是 `dogdog`，发布后通常是：

```text
https://machengji.github.io/dogdog/
```

## 常见问题

- `Missing build/web-desktop/index.html`
  说明还没有构建网页版本，先在 Creator 里构建一次 `Web Desktop`。

- Action 失败，提示找不到构建目录
  说明本次推送没有包含 `build/web-desktop` 文件，重新构建并执行 `npm run pages:publish`。

- 页面白屏
  先按 `Ctrl+F5` 强刷；再检查 Action 是否成功、浏览器控制台是否有资源 404。

