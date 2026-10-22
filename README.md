# Paperclip 简体中文扩展

[English](README.en.md) · 社区维护 · MIT

为 [Paperclip](https://github.com/paperclipai/paperclip) 提供简体中文界面，覆盖初始化向导、导航、任务、员工、项目、技能、连接器、权限、插件、适配器、实验功能和运行详情等固定文案。

**这是独立安装的汉化扩展，不是可直接导入 Paperclip 插件管理器的原生插件包。** 原生 UI 插件无法覆盖初始化等页面，因此本项目通过 CLI 在本地修补指定版本的前端资源，并提供原版备份和回退。

## 兼容范围

| 项目 | 当前支持 |
| --- | --- |
| Paperclip | **2026.1012.0 官方 npm 发行构建** |
| Node.js | **24.11.0 或更新版本** |
| 安装形式 | managed npm；或通过 `--server-dir` 指定 server 包目录 |
| 开发模式 / 其他版本 / 自定义构建 | 暂不支持；版本或构建摘要不匹配时拒绝安装 |

本项目与 Paperclip 官方没有隶属关系。兼容配置与上游提交记录在 [compatibility.json](compatibility.json)。当前版本包含约 1.3 万条词条，在对应上游构建中替换约 2 万处展示文案；这些数字不是所有运行场景的覆盖率保证。

## 快速开始

下载本仓库，**在 Paperclip 所在的运行环境中**进入项目目录：

```bash
git clone https://github.com/niexiaoxiaocheng/paperclip-zh-cn.git
cd paperclip-zh-cn
npm ci

# 检查兼容性和拟应用的汉化，不改变 Paperclip 文件
node bin/paperclip-zh-cn.mjs audit

# 安装，然后刷新浏览器
node bin/paperclip-zh-cn.mjs install

# 检查资源完整性、语法和协议字段
node bin/paperclip-zh-cn.mjs verify
```

默认查找 `${PAPERCLIP_HOME:-$HOME/.paperclip}/cli/current`。安装不创建组织、员工或任务，也不需要模型 API 密钥。

### WSL

如果 Paperclip 安装在 WSL，请进入对应的 WSL 终端后执行上面的命令。项目源码可以放在 WSL 内，也可以从 Windows 目录访问，例如：

```bash
cd /mnt/d/projects/paperclip-zh-cn
npm ci
node bin/paperclip-zh-cn.mjs install
```

示例目录请替换成自己的项目目录。无需固定 Linux 用户名、发行版名称或 Windows 盘符。

### 手动指定安装目录

```bash
# 托管安装根目录，其内部包含 node_modules/@paperclipai/server
node bin/paperclip-zh-cn.mjs install --payload /path/to/paperclip-install

# 或直接指定 @paperclipai/server 包目录
node bin/paperclip-zh-cn.mjs install --server-dir /path/to/node_modules/@paperclipai/server
```

Windows 原生环境可使用相同命令，并传入 Windows 路径：

```powershell
node bin/paperclip-zh-cn.mjs install --server-dir 'C:\path\to\node_modules\@paperclipai\server'
```

`--payload` 和 `--server-dir` 二选一；`audit`、`verify`、`status`、`restore` 同样接受这些目录参数。

## 查看状态与回退

```bash
node bin/paperclip-zh-cn.mjs status
node bin/paperclip-zh-cn.mjs restore
```

回退后刷新浏览器。原始界面保存在 server 包旁的 `ui-dist.original-zh-cn` 中，备份目录会保留。旧版汉化工具创建的原版备份通过构建检查后也可复用。

重复安装会从原版备份重新生成，不会叠加替换。已生成的旧资源文件暂不删除，以便已经打开的浏览器页面继续使用；原始入口恢复后它们不再被新页面引用。

## 实现与边界

- 使用 Acorn 解析 JavaScript，在固定展示属性、标签、通知和文案片段中替换文本，没有 DOM 扫描或 MutationObserver。
- 结构化状态在展示处转换，例如接口中的 `backlog` 显示为“待规划”。表单值、请求参数和状态比较仍使用原始枚举。
- 安装前比较修改脚本的对象字段、条件比较值和主要协议字段。资源写入完成后，再替换 HTML 入口。
- 原版备份记录文件摘要；生成资源使用独立版本文件名，避免不可变缓存导致中英文混用。
- 产品名称、模型 ID、命令、配置示例、协议模板、用户内容和原始工具输出保留原文。

这是针对已发布构建的社区兼容层，并非上游完整 i18n。翻译包含机器辅助生成的初稿和人工维护的术语修正，欢迎提交更自然的译法。上游升级后需重新审查，当前安装器不会强行套用旧规则。

正常安装及界面运行不调用翻译服务。仓库不包含 Paperclip 服务端、模型凭据、实例数据库或个人环境备份；运行 `npm ci` 会下载锁定的 Acorn 依赖。

## 开发与验证

```bash
npm ci
npm run check
npm test

# 可选：将未翻译候选输出到已忽略的 reports 目录
node bin/paperclip-zh-cn.mjs audit --report-dir reports

# 查看 npm 分发文件清单，不发布
npm pack --dry-run
```

测试使用独立临时目录，不访问真实实例。覆盖重复安装、完整回退、版本/构建拒绝、备份损坏、并发锁、协议字段保留、状态格式化和用户内容保留。GitHub CI 在 Linux 与 Windows 上运行。

词表优先级、目录结构和维护步骤见 [贡献指南](CONTRIBUTING.md)。实际运行记录见 [验证说明](docs/VALIDATION.md)。

## 项目与反馈

源代码：[niexiaoxiaocheng/paperclip-zh-cn](https://github.com/niexiaoxiaocheng/paperclip-zh-cn)。欢迎通过 [Issues](https://github.com/niexiaoxiaocheng/paperclip-zh-cn/issues) 反馈漏译、翻译问题及兼容性问题。

本项目尚未发布到 npm；请克隆本仓库并使用本地 CLI 命令，避免误装同名远程包。

## 许可证与署名

[MIT](LICENSE)。上游 Paperclip 的许可声明保留在 [第三方声明](THIRD_PARTY_NOTICES.md) 中，词表来源见 [NOTICE](NOTICE)。
