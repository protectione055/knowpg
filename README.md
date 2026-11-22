# KnowPG

**How Well Do You Know PostgreSQL?**

English | [中文](./README.zh-CN.md)

KnowPG is a self-assessment website for checking how well you really understand PostgreSQL under the hood.

- **Test your core knowledge**: Covers six core areas — Query Planning, Query Execution, Storage & Buffers, Indexing, Transactions & Concurrency, and WAL & Recovery.
- **Find your blind spots**: Get a breakdown of your score by topic after finishing, along with explanations for every question.
- **Learn at your own pace**: Switch between English and Chinese, toggle light/dark themes, and revisit past attempts anytime.

## Deployment

KnowPG is a static website with no build step or backend required. Because it uses ES Modules, serve it over HTTP rather than opening `index.html` directly via `file://`.

### Local Preview

Run any static file server in the project root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8765/>.

### Hosting

Deploy the repository root directly to any static host:

- **GitHub Pages**: Go to `Settings → Pages` and deploy from the root (`/`) of your branch.
- **Cloudflare Pages / Vercel / Netlify**: Connect the repository, leave the build command empty, and set the publish/output directory to `.`.
- **Nginx / Caddy**: Point the document root to this directory and ensure `.mjs` files are served with `text/javascript` or `application/javascript`.

## Tests

Verify the question bank and bilingual coverage (requires Node.js 20+):

```sh
node --test assessment.test.mjs
```
