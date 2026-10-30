# Mix Space unified entry — approved B ripple design

Approved in this session: the user chose B (纸上涟漪), requested real WebGL, scene-specific shapes, smooth morphing and interaction, then approved implementation. Reference: `.ryugi/artifacts/artboard/space-entry`, pages `play` and `morphs`.

## Product behavior

Unify `/login`, `/setup-api` and `/setup` with one persistent two-column entry shell. Keep the app's warm surfaces, cobalt accent, Inter/system typography, semantic tokens, existing controls and icons. The left column contains the Mix Space brand, the approved short introduction and the ripple artwork; the right column contains the current task. On phones, hide the artwork, retain a compact brand header, and allow forms to scroll. Both themes must work.

Retain existing password, Passkey and OAuth behavior, enabled-provider rules, login return destinations, API/gateway overrides and history, persistence/reset/local-development actions, fresh/backup setup, account creation, site configuration, AI provider/model/feature steps, skip/later/resume behavior. API settings retain their existing save-and-reload semantics; do not claim to have tested a connection without performing a probe.

## Persistent scene artwork

Use WebGL/GLSL to draw B's procedural contours. Login has closed concentric ellipses; API connection uses two merging sources; welcome opens into three lobes; account resembles a fingerprint; site forms a rounded square; AI providers resonate across several lobes; model selection becomes orderly; feature selection blooms; ready settles into a complete circle.

Morph the scalar-field parameters from the currently rendered values, including during interrupted transitions, without recreating the canvas or crossfading separate pictures. Animate independently of React renders. Pointer hover attracts nearby contours, dragging distorts them, and click/touch emits bounded, decaying radial impulses. Provide a keyboard-accessible ripple trigger. Reduced-motion preference disables ongoing animation and impulses, and changes scenes immediately. Hidden/offscreen/small-screen artwork must not animate. Release listeners, observers, animation frames and GPU resources on unmount; rebuild after a restored WebGL context. Unsupported WebGL must leave a static decorative fallback and usable forms.

## Integration and verification

The shared route layout owns the canvas across all three entry routes. Each step supplies its current scene while the existing form components own their business logic. No preview controls, mock credentials, demo navigation or internal renderer state belong in the product.

Add behavior tests for interrupted/frame-independent morphing, reduced-motion snapping, bounded interactions and persistent shell ownership. Run existing auth/setup regressions, focused lint/type checks, an admin production build and real-browser checks of all entry paths, scene continuity, themes, mobile scrolling and keyboard interaction. Preserve unrelated work in this checkout. Do not push or release.
