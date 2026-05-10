# @agentlinthq/core

Pure types and score calculator for [agentlint](https://github.com/agentlint/agentlint).

This package has no IO. It exports the `Result`, `Rule`, `Report`, and
`ScanContext` types and the `buildReport` / `registerRuleCategory` helpers.
The `agentlint` CLI consumes this package; you only need to depend on it
directly if you are building a custom runner, a hosted dashboard, or a
library that consumes pre-collected results.

## Install

```bash
pnpm add @agentlinthq/core
```

## Usage

```ts
import { buildReport, registerRuleCategory } from "@agentlinthq/core";
import type { Result, Rule } from "@agentlinthq/core";

// Compute a score from already-collected results.
const report = buildReport({
  results: [
    /* ...Result[]... */
  ],
});
console.log(report.score); // 0..100
```

For the full CLI experience, install [`@agentlinthq/cli`](https://www.npmjs.com/package/@agentlinthq/cli) instead:

```bash
npx @agentlinthq/cli
```

## License

MIT
