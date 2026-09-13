# Graph Report - wiring  (2026-09-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 54 nodes · 99 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `03476519`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7

## God Nodes (most connected - your core abstractions)
1. `RULE_VERSION` - 9 edges
2. `decideNext()` - 6 edges
3. `decideNextStrength()` - 6 edges
4. `confirmAnchor()` - 5 edges
5. `decideNextEngine()` - 5 edges
6. `close()` - 4 edges
7. `open()` - 4 edges
8. `dailyZones()` - 4 edges
9. `decideNext()` - 3 edges
10. `decideNextStrength()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `decideNext()` --calls--> `decideNextStrength()`  [EXTRACTED]
  src/session.js → src/strength.js
- `close()` --calls--> `confirmAnchor()`  [EXTRACTED]
  src/session.js → src/anchors.js
- `decideNext()` --calls--> `decideNextEngine()`  [EXTRACTED]
  src/session.js → src/engine.js

## Import Cycles
- None detected.

## Communities (8 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.35
Nodes (7): confirmAnchor(), decideNextEngine(), close(), decideNext(), open(), root, require

### Community 1 - "Community 1"
Cohesion: 0.31
Nodes (8): close(), confirmAnchor(), dailyZones(), decideNext(), decideNextEngine(), decideNextStrength(), rank(), shiftHrrPoints()

### Community 2 - "Community 2"
Cohesion: 0.38
Nodes (5): dailyZones(), shiftHrrPoints(), baseInput, root, v

### Community 3 - "Community 3"
Cohesion: 0.33
Nodes (5): name, private, scripts, test, type

### Community 4 - "Community 4"
Cohesion: 0.47
Nodes (4): decideNextStrength(), rank(), root, vectors

### Community 5 - "Community 5"
Cohesion: 0.60
Nodes (3): rules, EFFORTS, RULE_VERSION

### Community 6 - "Community 6"
Cohesion: 0.50
Nodes (3): root, rules, vectors

## Knowledge Gaps
- **17 isolated node(s):** `root`, `require`, `baseInput`, `root`, `v` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 18 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RULE_VERSION` connect `Community 5` to `Community 0`, `Community 2`, `Community 4`, `Community 7`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `decideNextStrength()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `root`, `require`, `baseInput` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._