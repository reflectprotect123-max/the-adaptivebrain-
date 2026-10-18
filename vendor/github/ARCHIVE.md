# Archived upstream sources and handoff ZIPs

The full upstream snapshots and historic root ZIP handoffs were removed from the
current checkout during the Coach cleanup. They were tooling/history, not Coach
runtime. Installed skills remain under `.cursor/skills/`; license notices and the
upstream inventory remain here.

The complete archive is retained in published Git commit
`158f654a898ba9f10d16c0f19c6353f704c9628e` (before cleanup):

- [Full upstream snapshots](https://github.com/reflectprotect123-max/the-adaptivebrain-/tree/158f654a898ba9f10d16c0f19c6353f704c9628e/vendor/github)
- [All three original handoff ZIPs](https://github.com/reflectprotect123-max/the-adaptivebrain-/tree/158f654a898ba9f10d16c0f19c6353f704c9628e)
- [Source/version inventory](INVENTORY.md)

To recover any original file without rewriting history:

```sh
git restore --source=158f654a898ba9f10d16c0f19c6353f704c9628e -- vendor/github/OWNER/REPO/PATH
# Or restore one historic ZIP with its original filename:
git restore --source=158f654a898ba9f10d16c0f19c6353f704c9628e -- Hybrid-Strength-CoLocated.zip
```

Do not re-import the entire archive into the product tree. Fetch only an upstream
source needed for an actual tool task, retaining its version and license.
