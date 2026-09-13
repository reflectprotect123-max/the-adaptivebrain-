# Access and Recovery Limits

## What was searched

- Currently accessible prior-conversation context using multiple broad and exact fitness queries
- Persistent file inventory and semantic/title search
- Known file identifiers retained in conversation history
- Current workspace uploads
- Visual inspection of recovered candidate images

## Hard limitation

Deleted chats and deleted files cannot be guaranteed recoverable. The history search returned useful summaries and source names, but no full conversation transcript for most queries. The persistent file inventory/search also returned no general listing, although several known file identifiers still allowed direct recovery.

Therefore this ZIP is comprehensive for **currently retrievable evidence**, not proof that every deleted byte has been restored.

## Originals discovered by history but not recoverable byte-for-byte

- No longer missing: the original TrainHeroic exports and derived archives were recovered in the second pass and are included under `08-original-research/trainheroic/`.
- `2026-08-06-athlete-onboarding-research-brief.md`
- `CODEX_DEEP_BUILD_PROMPT.md`
- older workout images referenced by numeric filenames such as `15267.jpg`, `16328.jpg`, `9530.jpg`, `16283.jpg`, `16244.jpg`, and `16217.jpg`

The major named Hybrid Engine, conditioning, readiness, TrainHeroic, Aerobic 40, exercise-library, platform-research, and prototype files were searched again and recovered under `08-original-research/`.

The older fitness images `15305.jpg`, `15368.jpg`, `16273.jpg`, `14105.jpg`, and `15357.jpg` were identified by history but returned `content_missing`; their exact retained prescriptions are recorded in the history reconstruction.

## How missing material is represented

Known facts and prescriptions from unavailable originals were preserved in the reconstructed Markdown documents. Anything not present in those reconstructions was not guessed.

## One known failed file reference

An earlier reference associated with `28723.jpg` returned file-not-found. Nearby recovered screenshots were nutrition-app material, so this missing image was not assumed to be fitness-related.
