# Aneety/ai project instructions

## Actions-first execution gate

For this repository and any Aneety worktree, treat GitHub Actions as the first execution surface for expensive or acceptance-relevant work.

Required order:

1. Prepare source, docs, contracts and PR locally.
2. Push branch and read GitHub Actions feedback from the PR.
3. Fix and push again until compile, lint, typecheck, build and module tests are green in GitHub Actions.
4. Start Cloudflare dry-run, deploy, smoke, API integration or e2e only after the PR gate is green.
5. Record evidence from the PR checks, Cloudflare run and published URL.

Do not use this MacBook as the acceptance runtime for the MVP. Do not use local containers, local servers, local Python services, local Playwright/Cypress, local Wrangler dev/deploy, Podman or Docker to close MVP evidence. Local work is limited to inspection, editing, Git operations, reading logs/checks and lightweight syntax validation.

MVP runtime remains 100% compatible with Cloudflare Workers. If the remote path is unavailable, register an objective blocker instead of creating a local fallback.
