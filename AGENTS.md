# Aneety/ai project instructions

## Actions-first execution gate

For this repository and any Aneety worktree, treat GitHub Actions as the first execution surface for expensive or acceptance-relevant work.

Required order:

1. Prepare source, docs, contracts and PR locally.
2. Push branch and read GitHub Actions feedback from the PR.
3. Fix and push again until compile, lint, typecheck, build and module tests are green in GitHub Actions.
4. For the Codex Cloud controller flow, once the controller PR gate is green, the agent must conclude the merge automatically, record the final `main` SHA, and only then move the cycle forward.
5. Start Cloudflare dry-run, deploy, smoke, API integration or e2e only after the PR gate is green and the controller cycle has recorded the merge evidence when that flow owns the change.
6. Record evidence from the PR checks, merge result, Cloudflare run and published URL.

Do not use local or cloud Codex environments as the acceptance runtime for the MVP. Do not use local/cloud containers, local/cloud servers, Python services, Playwright/Cypress, Wrangler dev/deploy, Podman or Docker to close MVP evidence. Codex local or cloud work is limited to inspection, editing, Git operations, reading logs/checks and lightweight syntax validation.

MVP runtime remains 100% compatible with Cloudflare Workers. If the remote path is unavailable, register an objective blocker instead of creating a local fallback.
