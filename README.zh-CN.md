# KnowPG

**How Well Do You Know PostgreSQL?**

[English](./README.md) | 中文

KnowPG 是一个 PostgreSQL 知识自测网站，帮助你检验自己对 PostgreSQL 内部工作原理的掌握程度。

- **检验核心功底**：涵盖查询规划、查询执行、存储与缓冲、索引、事务与并发、WAL 与恢复六个核心领域。
- **定位薄弱环节**：交卷后按模块展示得分与逐题解析，帮你快速找出需要补强的知识点。
- **轻松随时自测**：支持中英文切换与浅色/深色模式，并保留历史答题记录，方便随时回看对比。

## 部署说明

项目为纯静态网站，无需构建步骤，也不依赖后端服务。由于使用了 ES Modules，请通过 HTTP 静态服务访问，不要直接用浏览器打开本地 `index.html`。

### 本地预览

在项目目录下启动任意静态文件服务器：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

然后访问 <http://127.0.0.1:8765/>。

### 线上部署

将项目根目录直接作为静态站点发布即可：

- **GitHub Pages**：在仓库 `Settings → Pages` 中选择分支的根目录（`/`）发布。
- **Cloudflare Pages / Vercel / Netlify**：导入仓库后，构建命令留空，输出目录设为 `.`。
- **Nginx / Caddy 等自建服务器**：将静态根目录指向本项目目录即可（需确保服务器将 `.mjs` 文件以 `text/javascript` 或 `application/javascript` 返回）。

## 测试

校验题库数据结构与中英文完整性（需要 Node.js 20+）：

```sh
node --test assessment.test.mjs
```
