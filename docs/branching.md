# Branch Maintenance

To keep feature branches aligned with the latest changes, regularly rebase on top of `main`:

```bash
git fetch origin
git checkout work
git rebase origin/main
```

Resolve any conflicts that appear, run the project's checks, and push the updated branch with `--force-with-lease` to avoid overwriting others' work.
