# SEO Blog Image Generation

1. Read the accepted article/layout handoff and choose `human_scene` or
   `abstract_graphic` from article meaning.
2. Call `paperclip.openrouter-image-agent-tools:image-visual-history-get` with
   `limit=8` before constructing a human-scene prompt.
3. For `human_scene`, create typed `artDirection` with narrative moment, scene,
   setting, subjects, action, emotional beat, at least two visible emotion cues,
   shot distance, camera angle, gaze, props, brand anchors, and avoid patterns.
4. Compare the fingerprint with recent history. Change the concept before
   provider spend when fewer than four of nine visual axes are distinct.
5. Call `generate-image` once with the configured model, one candidate, 16:9,
   target 1472x822, declared subject mode, and typed art direction.
6. Inspect the actual file. For human scenes, verify that the declared emotion
   is visible at card crop and that the output did not collapse back to the
   seated-table/laptop/notebook/cup formula.
7. Accept the provider-native file when visual QA passes and each dimension is
   within 20 percent of 1472x822. Do not upscale, stretch, destructively crop,
   or regenerate only for size or format.
8. Register one attachment-backed work product containing the accepted file,
   visual fingerprint, emotion evidence, dimensions, model, cost evidence, and
   QA result. A material visual failure requires explicit CMO recovery before a
   new paid generation.
