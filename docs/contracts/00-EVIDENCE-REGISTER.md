# Evidence Register

This register distinguishes evidence from product rules. It is an index, not a claim that every packaged source has equal evidential weight.

## Evidence hierarchy

1. Peer-reviewed primary research, systematic reviews and consensus statements.
2. Official manufacturer documentation for observable product behavior.
3. Audited research syntheses with traceable citations.
4. Practitioner systems and source programs.
5. Original product heuristics requiring validation.

## Conditioning, autoregulation and intensity

| Source | What it supports | What it does not support |
| --- | --- | --- |
| Düking et al. (2021), *Journal of Science and Medicine in Sport*, systematic review/meta-analysis of HRV-guided endurance training | Readiness-guided scheduling can alter the distribution of hard/moderate work; possible benefit for submaximal physiological outcomes | It does not validate WHOOP Recovery or this package's numerical zone shifts |
| Gaskill, Skinner & Quindry (2023), *Medicine & Science in Sports & Exercise* | Ventilatory-threshold location varies materially between people; fixed HRR percentages are estimates | It does not provide a universal three-zone formula |
| Porcari et al. (2018), *Kinesiology* | Talk-test prescription can produce outcomes comparable to HRR-based prescription | It does not validate Easy/Medium/Hard output-step sizes |
| Bellenger et al. and related HRV/readiness literature indexed in `03-recovery-readiness/` | HRV can contribute to monitoring when interpreted longitudinally | A single readiness value should not rewrite long-term fitness |
| Fan-bike and interval studies indexed in `02-conditioning/` | Fan-bike power/RPM are valid workload observations within device/protocol context | Anchors should not be transferred between machines or protocols |

Direct links for the newly reconciled sources:

- [Düking et al. systematic review/meta-analysis](https://consensus.app/papers/monitoring-and-adapting-endurance-training-on-the-basis-of-düking-zinner/49268eac884451478ad7aaaca5e1272b/)
- [Gaskill, Skinner & Quindry ventilatory-threshold analysis](https://consensus.app/papers/ventilatory-threshold-related-to-vo2reserve-heart-rate-gaskill-skinner/024c63fcea865ac9980d1e22379ad5ee/)
- [Porcari et al. talk-test versus HRR study](https://consensus.app/papers/comparison-of-the-talk-test-and-percent-heart-rate-reserve-porcari-falck-wiese/437695787bf4548889ce1567b4b17b26/)

## Recovery wearables and dynamic zones

| Source | Confirmed finding | Boundary |
| --- | --- | --- |
| Morpheus official support | Three HR zones move daily; baseline behavior is associated with maximum HR/fitness level; lower recovery lowers boundaries | The exact algorithm and coefficients are unpublished |
| WHOOP official support | Recovery is a proprietary 0–100 composite with Green/Yellow/Red categories | WHOOP Recovery is not Morpheus Recovery |
| Miller et al. (2020/2021 PMC record), WHOOP 2.0 validation | Supports aspects of device HR/HRV measurement under studied conditions | Does not validate the proprietary composite Recovery Score as a prescription formula |
| Doherty, Baldwin et al. (2025), composite readiness-score evaluation | Consumer readiness systems are opaque and have limited direct validation | No basis for reproducing a vendor's hidden algorithm |

Official and peer-reviewed links:

- [Morpheus: why three zones change daily](https://support.trainwithmorpheus.com/support/solutions/articles/4000226200-why-morpheus-uses-3-dynamic-hr-zones-adjusted-daily-by-recovery-score)
- [Morpheus: maximum HR](https://support.trainwithmorpheus.com/support/solutions/articles/4000148448-maximum-heart-rate-estimating-it-vs-measuring-it)
- [Morpheus: zone rationale](https://support.trainwithmorpheus.com/support/solutions/articles/4000148286-why-morpheus-heart-rate-zones-are-different-and-more-effective-)
- [WHOOP Recovery](https://support.whoop.com/s/article/WHOOP-Recovery)
- [WHOOP device validation record](https://pmc.ncbi.nlm.nih.gov/articles/PMC8160717/)
- [Doherty et al. readiness-score evaluation](https://consensus.app/papers/readiness-recovery-and-strain-an-evaluation-of-composite-doherty-baldwin/8a2f2063ad06507caa65bb162ba7e5bd/)

The user-supplied Morpheus course screenshots are preserved under `05-source-programs/morpheus-user-supplied/`. They show worked examples and method descriptions but do not reveal a transferable general equation. They are references, not permission to republish an entire proprietary course.

## Strength progression and RIR

The detailed source table and citations live in:

- `01-strength/strength-progression-research-and-product-synthesis.md`
- `01-strength/Strength-system-research-and-design-consolidated.md`
- `04-research-audits/Peak-Strength-Garage-Strength-Set-Weight-Suggestion-Evidence-Audit.md`

The evidence supports repetitions-in-reserve as a useful subjective proximity-to-failure measure, load adjustment using observed performance, and progression that respects exercise/set structure. It does not reveal Peak Strength or Garage Strength's proprietary formula. Their observed interface behavior is a product reference, not scientific validation.

## Concept2 calculations

Concept2's standard pace/power relationship is implemented as:

`watts = 2.8 / pace_seconds_per_metre^3`

and inverted for `/500 m` or `/1000 m` display. The build contract is in `00-FORMULAS-AND-RULES.md`. Power is canonical because percentage changes in watts do not map linearly to split seconds.

## Practitioner and historical sources

- Jason Brown, Built Not Burnt and Everyday Responder materials are stored in `05-source-programs/`.
- TrainHeroic exports and the rebuilt session database are stored in `06-trainheroic-source-data/`.
- Morpheus's 12-method reference/adaptation is in `02-conditioning/Morpheus-reference-and-Hybrid-adaptation.md`.

These sources help reconstruct templates and product workflows. They are not automatically efficacy evidence.

## Original product heuristics — not research findings

The following locked/approved values were chosen to make V1 predictable, testable and easy to execute:

- Echo Bike adjustments of 1–2 RPM.
- Concept2 adjustments of 3% and 5% power.
- Two comparable observations for provisional anchor confirmation.
- Approximately 3% power or 1 RPM agreement.
- 90% completion tolerance.
- 5% output-fade tolerance.
- Five-minute Easy-duration progression after two qualifying exposures.
- 45-minute review point and 60-minute automatic ceiling.
- Red-only 25% Easy-duration reduction suggestion.
- Daily WHOOP interpolation points `(0,-8)`, `(34,-5)`, `(67,-2)`, `(100,0)` in HRR percentage points.

These must be stored with rule versions and validated in shadow mode. They should be changed only through an explicit, documented calibration decision.

## Citation completeness

This root register highlights sources directly tied to the final decisions. The archived dossiers and batch files contain the longer citation lists, quoted findings, evidence grades and limitations. `00-MANIFEST.md` identifies each evidence collection so a builder can trace a rule to its source or product-decision status.
