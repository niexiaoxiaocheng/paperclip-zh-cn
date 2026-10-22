# 贡献指南

## 目录

```text
bin/                  命令行入口
src/                  目标解析、AST 汉化、安装/回退、完整性验证
locales/              公开界面词表与人工维护片段
test/                 独立临时安装目录上的测试
scripts/              词表检查、合并
compatibility.json    固定上游版本、提交和关键资源摘要
.github/              CI 和问题模板
```

## 修改译文

`locales/base.generated.json` 是基础词表，`locales/zh-CN.json` 为优先级更高的人工覆盖。新增或修正译文可直接修改后者，也可以编辑 `fragments.tsv` / `additions.tsv` 后运行 `npm run merge`。TSV 合并时先读取片段，再读取人工修正。

不要翻译占位符、环境变量名、命令和代码示例。保留 `{{ agent.name }}` 等模板以及反引号内的参数。新增正文译法时应连同句子语境一起检查，避免使用“工艺”“出口”等不符合平台含义的直译。

提交前运行：

```bash
npm ci
npm run check
npm test
```

`audit --report-dir reports` 输出的是候选，不是可全部自动翻译的列表，其中包含品牌、模型 ID、协议标识和第三方内部常量。诊断报告不应提交。

## 支持新版本

不能只修改版本号：应从该版本的官方构建检查资源布局，更新 `compatibility.json`，重新审查 AST 规则及展示边界，并验证原始接口枚举、条件比较、用户内容、初始化与主要页面。保留此前支持版本的记录，或在发布说明中明确替换了支持范围。

请勿提交 Paperclip 安装目录、实例数据、备份、密钥或个人诊断日志。本仓库只维护扩展代码、公开界面词表与合成测试数据。
