#!/usr/bin/env node
import { resolveTarget } from '../src/target.mjs';
import { install, audit, restore, verify, status } from '../src/installer.mjs';

const help = `Paperclip 简体中文扩展（社区维护，非原生插件包）

Usage: node bin/paperclip-zh-cn.mjs <install|audit|verify|status|restore> [options]

  --payload <directory>     Paperclip 托管安装根目录
  --server-dir <directory>  @paperclipai/server 包目录（与 --payload 二选一）
  --report-dir <directory>  audit 的可选报告输出目录
  --help                   显示帮助

未指定目录时，查找 PAPERCLIP_HOME 或 ~/.paperclip/cli/current。
Paperclip 位于 WSL 时，请在对应 WSL 发行版中运行此命令。
install/restore 后刷新浏览器。业务数据与模型凭据不在操作范围内。
`;

try {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(help);
  } else {
    const command = args.shift();
    const operations = { install, audit, restore, verify, status };
    if (!Object.hasOwn(operations, command)) throw Error(`Unknown command: ${command}`);
    const options = {};
    const flags = { '--payload': 'payload', '--server-dir': 'serverDir', '--report-dir': 'reportDir' };
    while (args.length) {
      const flag = args.shift();
      if (!Object.hasOwn(flags, flag) || !args.length || args[0].startsWith('--')) throw Error(`Invalid option: ${flag}`);
      if (Object.hasOwn(options, flags[flag])) throw Error(`Repeated option: ${flag}`);
      options[flags[flag]] = args.shift();
    }
    if (options.reportDir && command !== 'audit') throw Error('--report-dir is only valid with audit.');
    const target = resolveTarget(options);
    console.log(JSON.stringify(operations[command](target, options), null, 2));
  }
} catch (error) {
  console.error(`paperclip-zh-cn: ${error.message}`);
  process.exitCode = 1;
}
