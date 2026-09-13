# THE Hybrid System
## Traceable structured-research system design

## 1. Design objective

Build a research system that can search and reason over millions of lines of structured information without losing the meaning or origin of any number.

The system must answer five questions for every important value:

1. What is the value?
2. What exactly does it measure?
3. Under what conditions was it measured?
4. Where did it come from?
5. What decision, if any, was allowed to use it?

Tables, metrics and numerical results are first-class records. They are not just text copied into prose.

## 2. System layers

```text
Layer 1   Source and document archive
Layer 2   Extraction and normalization
Layer 3   Structured evidence warehouse
Layer 4   Claim and contradiction graph
Layer 5   Policy and rule registry
Layer 6   Model registry and calibration store
Layer 7   Decision and replay ledger
Layer 8   Search and review interfaces
```

### Layer 1 — Source archive

Preserve the original source as an immutable object.

Required source fields:

- source ID;
- title;
- authors or issuing body;
- publication date;
- version;
- source type;
- DOI, PMID, URL or official identifier;
- retrieval timestamp;
- content hash;
- licence and redistribution status;
- system tags;
- supersedes or superseded-by links.

The archive must preserve source identity even when extraction is repeated with a better tool.

### Layer 2 — Extraction and normalization

Extraction creates candidate records. It does not create truth.

Every extraction event stores:

- extractor name and version;
- input source hash;
- page, paragraph, table, row, column or figure location;
- raw extracted text or value;
- normalized value;
- transformation formula;
- extraction confidence;
- review state;
- errors and warnings.

A table must retain its original row and column structure. A number without its header, unit or footnote is incomplete.

### Layer 3 — Structured evidence warehouse

This is the main search surface for tables, numbers and metrics.

Store separate records for:

- studies;
- populations;
- interventions;
- comparators;
- outcomes;
- metric definitions;
- observations;
- ranges and intervals;
- time series;
- table cells;
- formulas and transformations.

Do not flatten an entire study into one number. One source can contain several populations, outcomes, time points and analysis sets.

### Layer 4 — Claim and contradiction graph

Claims are narrow statements that can be independently reviewed.

Graph relationships include:

- supports;
- contradicts;
- qualifies;
- replicates;
- extends;
- depends on;
- derived from;
- supersedes;
- not generalizable to.

Conflicting values are not averaged automatically. The system preserves the context that may explain the conflict.

### Layer 5 — Policy and rule registry

Separate these categories:

- evidence finding;
- evidence synthesis;
- product policy;
- software default;
- safety invariant;
- unresolved hypothesis.

A rule can use a product heuristic, but the heuristic must not be labelled as a trial result.

### Layer 6 — Model registry

The model registry stores the non-LLM adaptive control models.

For every parameter, store:

- parameter ID;
- model ID and version;
- value or distribution;
- unit;
- prior source;
- calibration source;
- training window;
- update method;
- bounds;
- safety ceiling;
- last update;
- rollback version.

### Layer 7 — Decision ledger

Every final decision is immutable. An undo or correction creates a new event rather than deleting the original.

### Layer 8 — Search and review interfaces

The interface should provide:

- text search;
- faceted filtering;
- numeric filtering;
- unit-aware comparison;
- table-cell inspection;
- claim graph traversal;
- rule-to-source trace;
- source-to-decision trace;
- conflict review;
- replay of historical decisions.

## 3. Structured-data model

### Metric identity

Every metric receives a canonical identity. For example, `protein_intake.body_mass_day` is different from `protein_intake.ffm_day` even if both are reported as grams per kilogram per day.

Required metric attributes:

```text
metricId
canonicalName
aliases
quantityType
unit
numerator
denominator
timeBasis
measurementMethod
validRange
directionOfEffect
definition
```

### Unit normalization

Store both the reported value and normalized value.

```text
reportedValue: 2.3
reportedUnit: g/kg FFM/day
normalizedValue: 2.3
normalizedUnit: g/kg FFM/day
conversion: none
```

If conversion is possible, preserve the formula and assumptions. If conversion requires an unknown body mass, fat-free mass or time basis, do not invent it.

### Denominator preservation

The denominator is part of the meaning. These are not interchangeable:

```text
g/kg body mass/day
g/kg fat-free mass/day
kcal/kg fat-free mass/day
kcal/kg body mass/day
```

The search engine must reject or clearly label comparisons that mix incompatible denominators.

### Numeric value types

Support at least:

- scalar;
- minimum and maximum;
- mean and standard deviation;
- median and interquartile range;
- confidence interval;
- standard error;
- effect size;
- percentage;
- ratio;
- count;
- time series;
- ordinal score;
- categorical value.

The record must state whether a value is observed, derived, estimated, interpolated, imputed or reported by an external device.

### Table cells

A table cell must retain:

- table ID;
- row header;
- column header;
- footnote references;
- displayed value;
- unit;
- normalized value;
- source location;
- extraction method;
- review state.

This prevents the dangerous situation where a value survives but its population or condition disappears.

## 4. Provenance model

Provenance exists at four levels.

### Source provenance

Which document or dataset supplied the material?

### Location provenance

Where exactly in that source was it found?

Examples:

```text
PDF page 12, table 3, row “trained males”, column “protein target”
HTML section “Results”, paragraph 4
CSV row 184, column “mean_change”
Figure 2, panel B, digitized point 7
```

### Transformation provenance

What happened between the reported value and the stored value?

Examples:

- unit conversion;
- rounding;
- percentage to proportion;
- extraction from a range;
- formula calculation;
- aggregation;
- filtering;
- deduplication.

### Decision provenance

Which claim, policy, rule and model version used the value?

The system must support both directions:

```text
Source → Observation → Claim → Policy → Rule → Model → Decision
Decision → Model → Rule → Policy → Claim → Observation → Source
```

## 5. Search architecture

### Exact text index

Use full-text search for exact phrases, names, identifiers, limitations and source language.

### Structured relational index

Use relational fields for system, population, age, sex, training status, modality, intervention, comparator, study design, source tier, publication date, evidence status and review status.

### Numeric index

Index numeric values with their metric ID, unit, denominator, population, context and uncertainty.

Queries must be unit-aware. A search for `5%` must distinguish percentage, percentage points, probability and relative risk.

### Graph index

Use edge tables for support, contradiction, qualification, derivation and downstream use.

### Semantic discovery index

An embedding index may suggest relevant sources or claims. It must only support discovery. Exact source location and structured filtering remain authoritative.

## 6. Conflict handling

When two sources disagree, create a conflict record rather than averaging them.

Compare:

- population;
- age and sex;
- training status;
- intervention dose;
- comparator;
- duration;
- outcome definition;
- measurement method;
- statistical uncertainty;
- study quality;
- publication date;
- adherence;
- missing data;
- environmental context.

The system then records one of:

- compatible findings;
- context-dependent findings;
- genuine contradiction;
- insufficient evidence;
- source-quality imbalance;
- unresolved.

The product response may be a bounded range, a conservative hold, a split policy or a research backlog item. It must not hide the disagreement.

## 7. From claims to runtime rules

An evidence claim can inform a policy. A policy can inform a rule. Neither transition is automatic.

Example:

```text
Claim:
Repeated performance exposure can support progression when the exercise,
technique and target conditions are comparable.

Synthesis:
The evidence supports performance-informed progression but does not establish
a universal percentage, session count or failure threshold.

Product policy:
Use a conservative configurable progression target and require comparable evidence.

Executable rule:
Promote one progression lever after the configured confirmation gate;
otherwise hold or use a repetition fallback.

Test:
Coarse equipment, missing RIR, changed exercise, pain, conditioning fatigue
and repeated comparable success must each produce the expected result.
```

Every rule records its evidence status:

- direct evidence;
- adjacent evidence;
- coaching precedent;
- software default;
- safety policy;
- unresolved hypothesis.

## 8. Model integration

The Multi-model adaptive control system receives structured facts and domain decisions, not raw research text.

```text
Five domain feeds
  → quality and freshness checks
  → state estimation
  → personal adaptation
  → constrained optimisation
  → hard validators
  → one SystemDecision
```

Model inputs must include value, unit, timestamp, source, uncertainty, missingness, domain, evidence status and model version.

Model outputs must include action, scope, changed fields, unchanged fields, reason codes, model version, rule IDs, validator results and the next recheck condition.

The model may learn personal coefficients, but it may not learn its way around a hard validator.

## 9. Decision receipt

The decision receipt is the trust unit of the system.

It must answer:

- What did the system see?
- What did each system say?
- What did the adaptive model estimate?
- What changed?
- Why was the change allowed?
- Which rules and evidence supported it?
- Which validator checks passed?
- What remained unchanged?
- Can the decision be replayed or reversed?

The receipt is immutable and references the exact input snapshot and pack versions.

## 10. First build

The first build should not attempt to process 15 million lines immediately.

It should prove the refinery on a small representative sample:

1. Ten sources per system.
2. Ten structured observations per system.
3. Five claims per system.
4. One contradiction per system.
5. One policy and rule per system.
6. One end-to-end decision receipt.
7. One replay test.

Once the chain works, scale collection and extraction without changing the contracts.

## Final design decision

The system we should build is a **local-first, provenance-preserving evidence warehouse and claim graph**, connected to versioned deterministic rule packs and a non-LLM adaptive control system.

Its defining feature is that every important number, rule, model parameter and system decision can be searched, inspected, challenged and replayed.
