# Npm Audit Action

Github action to run npm audit, and even create a PR with the fixes

## Inputs

Check [action.yml](action.yml) for documentation

## Example usage

Simple usage:

```yaml
uses: luisfontes19/npm-audit-action@v0.1.0
with:
  fix: true # To create pull requests with npm audit fix
  github-token: ${{ secrets.TOKEN }} # github token to create the pull request. Here you need to have a secret named TOKEN.
```

## Full Action Example

```yaml
on:
  schedule:
    - cron: '0 0 * * *'

jobs:
  npm-audit:
    runs-on: ubuntu-latest
    name: NPM Audit (and fix)
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: NPM Audit
        uses: luisfontes19/npm-audit-action@v0.1.0
        with:
          project-path: "."
          json: false
          only: prod
          level: critical
          fix: true
          package-lock-only: false
          force: true
          git-user: action-npm-audit
          git-email: action-npm-audit
          git-message: npm fix run from npm-audit action
          git-pr-title: [SECURITY] NPM audit fix
          git-branch: npm-audit-action
          git-remote: origin
          github-token: ${{ secrets.MY_TOKEN }} 
```
