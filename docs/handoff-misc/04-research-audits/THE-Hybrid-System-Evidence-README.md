# THE Hybrid System Evidence Platform

## Five-system structured research and traceability system

**Version:** 1.0  
**Date:** 28 August 2026  
**Status:** Design specification

## What this is

This is the research foundation for **THE Hybrid System**.

It is designed to hold, search, compare and convert **1–3 million normalized research lines for each of five systems**:

1. Strength
2. Conditioning
3. Nutrition
4. Recovery
5. Coordinator

The total ambition is **5–15 million research lines**.

The product is not a giant document. It is a searchable evidence platform that preserves the path from a source to a number, from a number to a claim, and from a claim to a runtime decision.

```text
Source
  → structured extraction
  → normalized metric or table cell
  → evidence claim
  → synthesis
  → product policy
  → executable rule
  → model parameter
  → tested system decision
```

## Core rule

Raw research must never directly control the athlete app.

An LLM such as Gemini may help sort, classify or extract incoming material, but its output is untrusted until it passes schema validation, source verification and review. Runtime athlete decisions remain deterministic, versioned and validator-controlled.

## What this platform optimises for

- structured tables and numerical findings;
- exact units, denominators and populations;
- metric definitions and synonyms;
- cell-level source provenance;
- reproducible transformations;
- contradiction tracking;
- searchable evidence claims;
- rule and model traceability;
- replayable decisions;
- local-first operation;
- no silent invention of missing values.

## Main components

### Source registry

Stores identity, origin, date, version, URL, document hash, licence status and research-system tags for every source.

### Document and table archive

Stores original documents, extracted text, tables, figures and structured rows. Raw material is preserved separately from normalized values.

### Metric dictionary

Defines what every number means, including its unit, denominator, population, time window, measurement method, direction of effect, valid range and transformation rules.

### Evidence claim registry

Stores narrow claims supported by one or more exact source locations and structured observations.

### Synthesis and contradiction graph

Records which claims support, contradict, qualify, duplicate or extend one another.

### Policy and rule registry

Separates scientific findings from product decisions and software defaults.

### Model registry

Stores the non-LLM adaptive model versions, coefficients, assumptions, training windows and calibration results.

### Decision ledger

Stores the final system decision and the complete input, rule, model and validator lineage used to create it.

## Recommended storage design

```text
Original files and captures   → content-addressed file store
Registry and claims           → SQLite
Structured observations       → DuckDB / Parquet
Text search                   → SQLite FTS5
Relationship search           → relational edge tables
Runtime rules and models      → versioned JSON or YAML packs
```

This is suitable for a personal system and millions of structured records. PostgreSQL can be added later without changing the evidence contracts.

## Search modes

### Text search

Find exact wording, names, identifiers, limitations, papers, authors, exercises and interventions.

### Structured search

Filter by system, population, study design, metric, unit, sample size, date, modality, intensity, duration and evidence tier.

### Numeric search

Find values, ranges, effect estimates, uncertainty intervals, thresholds and dose-response relationships without losing their context.

### Provenance search

Start with a rule, model parameter or decision and walk backward to the exact source passage, table cell or figure from which it came.

Vector or semantic search may help discovery, but it never replaces exact structured filters or citations.

## Evidence lifecycle

```text
discovered
  → captured
  → extracted
  → normalized
  → verified
  → synthesized
  → policy-approved
  → rule-approved
  → released
```

Rejected, superseded, disputed and insufficient items remain in the archive with their reason. They are not silently deleted.

## Gemini boundary

Gemini may assist with:

- system classification;
- source-type classification;
- table and number extraction;
- duplicate suggestions;
- claim-candidate drafting;
- missing-field detection;
- natural-language query conversion.

Gemini may not:

- approve evidence;
- invent values;
- resolve scientific contradictions automatically;
- promote a claim to a rule;
- change model parameters;
- write directly to the runtime database;
- override validators;
- make athlete decisions.

## Required quality gates

No structured record becomes trusted until it has:

- a source ID;
- an exact location;
- a metric definition;
- a unit and denominator;
- population and context;
- extraction method;
- missingness status;
- evidence tier;
- review state;
- transformation history;
- limitations.

No runtime rule is released until it has:

- a policy owner;
- linked evidence claims;
- documented uncertainty;
- boundary tests;
- missing-data behaviour;
- validator coverage;
- a version number;
- replay support.

## Folder structure

```text
evidence-platform/
├── README.md
├── docs/
│   ├── TRACEABILITY-SYSTEM-DESIGN.md
│   └── research-plans/
├── schemas/
│   ├── evidence-record.schema.json
│   └── decision-receipt.schema.json
├── registry/
│   ├── sources.jsonl
│   ├── metrics.jsonl
│   ├── claims.jsonl
│   ├── policies.jsonl
│   ├── rules.jsonl
│   └── models.jsonl
├── structured/
│   ├── observations.parquet
│   └── table-cells.parquet
├── tests/
│   ├── golden-scenarios/
│   └── replay-fixtures/
└── releases/
    └── rule-packs/
```

## First implementation sequence

1. Inventory all existing research files.
2. Create source IDs and checksums.
3. Deduplicate documents and superseded versions.
4. Build the metric dictionary.
5. Extract structured tables and numerical observations.
6. Attach exact provenance to every observation.
7. Draft and verify atomic claims.
8. Map claims to policies and rules.
9. Create golden test scenarios.
10. Run the rule packs in shadow mode.

## Definition of success

The platform is successful when a developer can ask:

> Why did THE Hybrid System make this decision?

and receive a complete machine-readable chain:

```text
decision ID
→ input snapshot
→ domain outputs
→ model version
→ rule IDs
→ policies
→ evidence claims
→ exact source locations
→ validator results
→ applied adapter action
```

That chain is the actual product. The millions of research lines are its foundation.
