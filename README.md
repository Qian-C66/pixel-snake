# Pixel Snake / 像素贪吃蛇

一个可以直接在浏览器运行的像素风贪吃蛇小游戏，使用原生 HTML、CSS 和 JavaScript 制作。

## 本地运行

双击 `index.html` 即可开始游戏，也可以用任意静态服务器打开它。

操作方式：

- `W A S D` 或方向键：移动
- `Space` / `P`：暂停或继续
- `R`：重新开始
- 页面按钮：开始、暂停、重开、音效和语言切换

游戏包含计分、最高分保存、等级提升、障碍物、加速金色食物和像素音效。

## 上传到 GitHub Pages

1. 在 GitHub 新建一个仓库，例如 `pixel-snake`。
2. 把本文件夹中的全部文件上传到仓库的 `main` 分支。
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment** 中选择 **GitHub Actions**。
5. 等待 Actions 中的 `Deploy Pixel Snake to GitHub Pages` 完成。
6. 回到 **Settings → Pages**，打开 GitHub 显示的网页地址。

仓库里的 `.github/workflows/pages.yml` 已经配置好了自动发布。之后每次更新 `main` 分支，网页都会自动更新。
