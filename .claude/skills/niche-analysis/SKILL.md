---
name: niche-analysis
description: Use when analysing or screening a niche for Preview Factory fit. Wraps the existing ten-phase methodology. Trigger for any niche GO/HOLD decision, screening, or launch-ranking task.
---
# Niche analysis

The full methodology already lives at `strategy/_master/methodology.md`. Follow it
exactly; this skill only fixes the contract around it.

- Screen first (does it fit the model: local service business, GBP presence,
  owner-operated, LTV likely > $300, Meta-targetable). Log screen-outs in
  `decision-log.md`.
- For passers, run all ten phases into `strategy/niches/<slug>/analysis.md`,
  update `niches-master.csv` and `decision-log.md`.
- Phase 5 is category mapping: which of the seven visual categories the niche
  uses, and the generation-time tuning, not a new template.
- Output GO/HOLD with LTV:CAC. Rank by LTV:CAC and build leverage in
  `launch-recommendations.md`.
- You may run multiple niches in parallel as subagents; merge CSV/log centrally.

Niche choice for launch is a human decision gate, not an agent call. Produce the
ranked recommendation and stop for sign-off.
