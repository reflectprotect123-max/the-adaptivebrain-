# @adaptivebrain/kernel

Deterministic session kernel: `open`, `decideNext`, and `close`. No HTTP. No LLM. No athlete UI.

This package is the Brain decision hub. Athlete UI snapshots (wired to this kernel) live in `apps/strength` and `apps/engine` because this bot cannot push the sibling GitHub remotes.

Browser copy: `browser-iife.js` (`HybridBrainKernel`), duplicated into each app as `brain-kernel.js`.

## Tests

From this directory:

```bash
npm test
```

Runs Node's built-in test runner against `test/*.test.js`.
