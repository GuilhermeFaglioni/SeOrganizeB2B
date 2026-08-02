# Financial Module — Task 18

> Parent plan: `docs/superpowers/plans/2026-08-02-financial-module.md`
> Design: `docs/superpowers/specs/2026-08-02-financial-module-design.md`

### Task 18: Run Final Verification Gates

**Files:**
- Modify: only files with defects found by the gates.

- [ ] **Step 1: Run the full automated suite**

```bash
npm test
```

Expected: all tests pass, including every pre-existing story and regression
test.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: no errors. Fix any lint findings before continuing.

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit --incremental false
```

Expected: clean.

- [ ] **Step 4: Validate the Prisma schema**

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

Expected: schema formatted, valid and client regenerated.

- [ ] **Step 5: Run the production build**

```bash
npm run build
```

Expected: production build succeeds with the new financial routes.

- [ ] **Step 6: Check for whitespace and conflict markers**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 7: Run the final integrated review**

Review the complete `git diff` end-to-end against the design spec and the
tasks, covering schema, services, controllers, hooks, UI and tests. Confirm
the scope contains only financial-module files plus any defect fixes. The
integrated review must be `APPROVED` before proceeding.

- [ ] **Step 8: Commit pending changes, push and open the single PR**

Under the continuous authorization granted at the start of the plan, ensure
every task commit is in place and commit any remaining pending changes
(including any `fix(financial): ...` defect fixes). Then push the branch and
open exactly one pull request after the gates above are green and the
integrated review is approved:

```bash
git status
git add -A
git commit -m "feat(financial): final pending changes" # only when the working tree is not clean
git push origin feat/financial-module
gh pr create --base main --head feat/financial-module \
  --title "feat(financial): financial module" \
  --body "Implements the financial module. All verification gates green and integrated review approved."
```

Expected: any pending changes are committed, the branch is pushed, and exactly
one PR targeting `main` is created.

---

## Self-Review

- **Spec coverage:** Schema/migration (Task 1), decimal money and civil dates
  (Task 2), equal installments, rounding remainder, exact sums and recurring
  horizon (Tasks 3 and 6), MRR/ARR for every frequency and all metric
  grouping rules (Task 4), lifecycle, cancellation, renewal and
  one-active-contract-per-project (Tasks 5 and 6), before/after financial
  audit (Task 5), clients, contracts, lifecycle, changes, installments,
  overview and CSV APIs (Tasks 7–11), React Query hooks (Task 12), Overview,
  Contracts, Receivables and Clients UI (Tasks 13–16), responsive and
  accessible states plus loading/empty/error/validation feedback (Task 17),
  and the boolean gates (Task 18). Out-of-scope items (DRE, partial payments,
  CSV import, multi-currency, catalogs, financial roles, PDF reports) are not
  planned.
- **Placeholder scan:** no TBD/TODO/"implement later"/"similar to" text; every
  code step shows complete concrete code.
- **Type consistency:** `Money` = `Prisma.Decimal`; `InstallmentPlanItem`,
  `ContractStatus`, `DurationType`, `BillingFrequency`, `PaymentMethod`,
  `ChangeType`, `LifecycleAction`, `Paginated<T>` and `OverviewFilters` are
  defined once in `src/lib/financial/types.ts` and reused by the services,
  routes, hooks and UI. Function names (`activateContract`,
  `applyLifecycleAction`, `applyContractChange`, `recordPayment`,
  `refundInstallment`, `extendRecurringHorizons`, `computeOverview`) match
  across test contracts, services and API adapters.
