# Paperclip Simplified Chinese Extension

[简体中文](README.md) · Community project · MIT

A local, reversible Chinese UI extension for the **official Paperclip 2026.1012.0 npm build**. Requires Node.js **24.11.0+**.

This is **not a native plugin-manager package**. Native UI plugins do not cover onboarding, so the CLI patches the pinned distribution's frontend assets. It is not affiliated with Paperclip AI.

## Install

Download this repository and run these commands **in the environment where Paperclip is installed**:

```bash
npm ci
node bin/paperclip-zh-cn.mjs audit
node bin/paperclip-zh-cn.mjs install
node bin/paperclip-zh-cn.mjs verify
```

Refresh the browser after installation. WSL installations must be patched from the matching WSL environment.

The CLI defaults to `${PAPERCLIP_HOME:-$HOME/.paperclip}/cli/current`. Override the target with either `--payload <managed-install-root>` or `--server-dir <@paperclipai/server-directory>`. Other versions and unrecognized builds are rejected.

```bash
node bin/paperclip-zh-cn.mjs status
node bin/paperclip-zh-cn.mjs restore
```

Original resources are retained in `ui-dist.original-zh-cn`. Reinstallation starts from that backup. Versioned asset names avoid immutable-cache conflicts; older generated assets remain available to existing browser sessions.

## Scope

Chinese UI text covers onboarding, navigation, tasks, agents, projects, skills, connectors, permissions, plugins, adapters, experimental features, and run detail surfaces. Catalogs contain approximately 13,000 entries and apply approximately 20,000 presentation edits in the supported build; these counts are not a runtime coverage guarantee.

AST transformations preserve comparisons, object keys and major protocol fields. Structured roles/statuses are localized at display boundaries. Product/model names, executable samples, agent-facing protocol templates, user content, and raw tool output remain original. No database changes, model credentials, DOM scanning, or runtime translation service is involved.

This is a version-specific compatibility layer rather than upstream i18n. Translations include machine-assisted drafts and maintained terminology overrides; corrections are welcome.

## Development

```bash
npm run check
npm test
node bin/paperclip-zh-cn.mjs audit --report-dir reports
npm pack --dry-run
```

Tests run against disposable fixtures, not a live instance. See [CONTRIBUTING.md](CONTRIBUTING.md) and [validation notes](docs/VALIDATION.md). No npm release has been published by this project; use the local CLI.

MIT licensed. Upstream notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
