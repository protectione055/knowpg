# How Well Do You Know PostgreSQL?

基于 PostgreSQL 18.6 的浏览器端内核自测卷，包含 36 道单选题，覆盖查询规划、查询执行、堆表与缓冲管理、索引、事务与并发、WAL 与恢复六个模块。交卷后按模块汇总加权得分，并提供源码行号与官方文档出处。

## 本地运行

在 `pg-kernel-assessment` 目录下启动静态服务：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

访问 [http://127.0.0.1:8765/](http://127.0.0.1:8765/)。答题进度与历史报告仅保存在当前浏览器的 `localStorage` 中（按 origin 隔离），不上传服务器。

## 测试与题库说明

使用 Node.js 20+ 运行单元测试：

```sh
node --test assessment.test.mjs
```

题库位于 `questions.mjs`，源码引用固定在 `REL_18_6` 对应提交 `724edf9bde9d356724ad384a2e196edc3c9f80f7`。已提交的历史报告会连同当时的题目、作答和评分一起快照保存。
