# Assignment ML models (C6)

Persisted artifacts for helpdesk **ML assignee suggestion**.

| File | Purpose |
| --- | --- |
| `assignment-category-v1.json` | Multinomial Naive Bayes over thread categories; used by `MlAssignmentService` |

## Train

From repo root (script cwd is `apps/api`):

```bash
# Synthetic corpus → committed default artifact (no DB)
corepack pnpm --filter @smartresidence/api ml:train-assignment

# Condo closed-thread history (requires DATABASE_URL + prisma generate)
corepack pnpm --filter @smartresidence/api ml:train-assignment -- --from-db --condo-id <uuid>

# Custom output path
corepack pnpm --filter @smartresidence/api ml:train-assignment -- --out ./ml-models/custom.json
```

Optional env `ML_ASSIGNMENT_MODEL_PATH` points the API at a custom artifact at runtime
(absolute or relative to the API process cwd).

## Runtime

When helpdesk `autoAssignment.mlEnabled` is on **and** the condo has ≥ 200 closed threads
**and** this artifact is loadable, `CompositeAssignmentAssistProvider` uses the model
(`source: "ml"`). Otherwise deterministic rules remain the fallback.
