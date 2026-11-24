# PerkOS Runtime visual plugin contract v0.1.0

This proposed public contract covers read-only panels and viewers in Social Video and UI Theme Desks. TASK-2's existing [v0.1 tool contract](../plugin-api/README.md) separately defines tool detection, shell commands, MCP servers, skills and activation. A release may declare both contracts. Neither contract's grants confer access under the other.

## Manifest

The host validates this closed JSON schema before offering a mount.

```ts
type Desk = 'social-video' | 'ui-theme'
type Capability = 'video.artifact.read' | 'theme.preview.read'
type Manifest = {
  visualApi: '0.1.0'
  id: string
  version: string
  surfaces: {
    id: string
    desk: Desk
    kind: 'panel' | 'viewer'
    entry: string
    capabilities: Capability[]
  }[]
}
```

Plugin and surface IDs use lowercase letters and digits with optional single hyphen separators. The release ID and exact SemVer version must match the staged release pinned by the Desk. Accept exactly visual API `0.1.0` and reject unknown fields, duplicate surface IDs, empty surface or capability lists, and duplicate or unknown capabilities. Social Video supports only `video.artifact.read` and UI Theme supports only `theme.preview.read`. Each entry is a package-relative HTML file verified against the staged contents. Reject absolute paths, URL schemes, queries, fragments, traversal and links escaping the stage.

## Session protocol

Each mount gets a fresh host-issued session bound to the window, exact release, surface, Desk, active project and active execution node. Context is read-only. A project and node are required. Init exposes only their opaque IDs, the Desk type and optional selected resource. The broker derives authority from its own session binding.

```ts
type Scope = { sessionId: string }
type Correlation = Scope & { requestId: string }
type Init = Scope & {
  type: 'init'
  context: {
    desk: Desk
    projectId: string
    nodeId: string
    selectedId?: string
  }
}
type SurfaceMessage = Correlation & (
  | { type: 'request'; capability: Capability; resourceId: string }
  | { type: 'cancel' }
)
type HostMessage = Init | (Correlation & (
  | { type: 'result'; capability: 'video.artifact.read'; value: {
      mime: 'video/mp4'; durationMs: number; mediaUrl: string
    } }
  | { type: 'result'; capability: 'theme.preview.read'; value: {
      scheme: 'light' | 'dark'
      colors: { background: string; surface: string; text: string; primary: string }
    } }
  | { type: 'error'; code: 'INVALID_REQUEST' | 'DENIED' | 'UNAVAILABLE' | 'CANCELLED' }
))
```

All listed objects are closed. Protocol IDs and resource references are nonempty opaque strings of at most 128 characters. Duration is a nonnegative safe integer in milliseconds. Colors are six-digit hex strings prefixed with `#`. The media URL is a local `blob:` URL materialized by the host-controlled surface bootstrap and valid only for this mount. Validate both directions before dispatch or use. Bound message sizes, media size and outstanding requests. Drop invalid or foreign envelopes that cannot be safely correlated. For a malformed request with a valid unused correlation ID on the bound port, return `INVALID_REQUEST` without dispatch. IDs are single-use per session. Ignore duplicate requests, and apply a reply only to a pending request with the same session and request ID and, for results, matching capability. Each accepted request has at most one terminal reply.

## Example exchanges

Each JSON array contains the manifest, init, request and successful result, in order.

### Social Video Desk artifact viewer

```json
[
  {"visualApi":"0.1.0","id":"video-artifacts","version":"0.1.0","surfaces":[{"id":"artifact-viewer","desk":"social-video","kind":"viewer","entry":"viewer.html","capabilities":["video.artifact.read"]}]},
  {"type":"init","sessionId":"video-session","context":{"desk":"social-video","projectId":"project-video","nodeId":"node-edit","selectedId":"clip-17"}},
  {"type":"request","sessionId":"video-session","requestId":"read-1","capability":"video.artifact.read","resourceId":"clip-17"},
  {"type":"result","sessionId":"video-session","requestId":"read-1","capability":"video.artifact.read","value":{"mime":"video/mp4","durationMs":12000,"mediaUrl":"blob:null/3e07d7ef-d3ae-47fb-9cc9-5f43d488b600"}}
]
```

TASK-733 supplies a completed video artifact reference. The host resolves it through the authorized project artifact service on the active node. The viewer plays the selected MP4 with local controls. Rendering and publishing stay in the tool workflow. Return `UNAVAILABLE` for unsupported media or an artifact above the host's delivery limit.

### UI Theme Desk preview panel

```json
[
  {"visualApi":"0.1.0","id":"theme-samples","version":"0.1.0","surfaces":[{"id":"theme-preview","desk":"ui-theme","kind":"panel","entry":"preview.html","capabilities":["theme.preview.read"]}]},
  {"type":"init","sessionId":"theme-session","context":{"desk":"ui-theme","projectId":"project-design","nodeId":"node-design","selectedId":"draft-4"}},
  {"type":"request","sessionId":"theme-session","requestId":"read-1","capability":"theme.preview.read","resourceId":"draft-4"},
  {"type":"result","sessionId":"theme-session","requestId":"read-1","capability":"theme.preview.read","value":{"scheme":"dark","colors":{"background":"#131720","surface":"#222A36","text":"#F4F6FA","primary":"#82C8FF"}}}
]
```

The panel applies the validated tokens to a sample header and board card inside the surface. Saving, installing and applying themes are host actions.

## Runtime seams

Verified against Runtime commit `735ab6eef90bce46661b04b2d69cb2e0d1a82289`.

| Source | Existing seam | Host work to build |
| --- | --- | --- |
| [`src/main/index.ts`](https://github.com/PerkOS-xyz/PerkOS-Runtime/blob/735ab6eef90bce46661b04b2d69cb2e0d1a82289/src/main/index.ts#L129) | Primary and project windows share `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` and the Runtime preload. Navigation rules block window navigation and new windows while routing HTTP(S) links externally. `fromAppWindow` verifies window ownership, main frame and page URL for handlers that use it. | Build the isolated surface and a trusted broker entry point with sender and scope checks. Apply tighter navigation and permission rules to the surface. |
| [`src/preload/index.ts`](https://github.com/PerkOS-xyz/PerkOS-Runtime/blob/735ab6eef90bce46661b04b2d69cb2e0d1a82289/src/preload/index.ts#L14) | `contextBridge` exposes `window.perkos` through named IPC calls and core events, plus theme catalogue, agent connection, lifecycle, drafts, speech and appearance bridges. Core event subscriptions return an unsubscribe function. | Keep these bridges in trusted Runtime UI. Add narrow broker methods for the trusted adapter and a dedicated surface transport. |
| [`src/renderer/src/work/useDeskLayout.ts`](https://github.com/PerkOS-xyz/PerkOS-Runtime/blob/735ab6eef90bce46661b04b2d69cb2e0d1a82289/src/renderer/src/work/useDeskLayout.ts) | `useDeskLayout(projectId)` persists project-specific panels, board/editor choice, width and selected file in local storage. | Add host-owned mount slots and selection wiring at the Desk view. Keep live sessions and grants outside layout persistence. |
| [`src/renderer/src/settings/ThemeStudioPreview.tsx`](https://github.com/PerkOS-xyz/PerkOS-Runtime/blob/735ab6eef90bce46661b04b2d69cb2e0d1a82289/src/renderer/src/settings/ThemeStudioPreview.tsx#L13) | `ThemeStudioPreview()` renders a trusted React sample from a draft and optional network and palette data, with scoped palette styles and draft-color fallback. | Adapt an authorized theme snapshot to the bounded token schema and use the existing sample as a visual reference for the isolated preview. |

## Host integration

Mount the verified entry in a sandboxed iframe on a dedicated asset origin with scripts enabled and an opaque origin. Keep same-origin access, forms, downloads and popups disabled. Deny all frame navigation after the verified initial load, including top navigation, and deny device permissions. Enforce a restrictive content security policy permitting verified package assets and local broker media while blocking external resources, outbound connections, nested frames and workers. The frame has no Node, Runtime preload, Electron IPC, direct main-process access or parent DOM access. Package code runs only in the frame.

Transfer a dedicated message port to the exact frame on its verified initial load, bind it to the host session and send init over the port. Window messages cannot submit requests. Bounded media bytes travel through the trusted adapter to a host-controlled bootstrap in the frame, which tracks its playback URLs. The public protocol exposes the local playback URL. Keep credentials, absolute paths, IPC channel names and backend endpoints in the host.

For each request, the broker checks the live session, declared capability and current grant for the exact release and active project/node scope. Resolve only the selected resource, using authoritative metadata on the bound node. Verify the resource belongs to the bound project and node even when IDs collide. Reject scope overrides and mismatched selections. Deny missing, revoked or out-of-scope grants with `DENIED` before reading data. Return `UNAVAILABLE` for authorized reads the host cannot complete. Recheck scope and grant before publishing any result, including delivery of media bytes.

- **TASK-729 · Review**. Read visual manifests and entries from verified staged releases by exact pinned identity.
- **TASK-730 · Backlog**. Use trusted Runtime consent UI for activation and requested access.
- **TASK-731 · Backlog**. Own mount registrations, sessions and broker resources under disposable activation. Release them on failure, replacement or deactivation.
- **TASK-732 · Backlog**. Use Runtime grants for authorization and close affected sessions on revocation.
- **TASK-733 · Backlog**. Wire completed video artifact selection to the viewer within the Desk's project and node scope.

This documentation can land before TASK-9 because it creates no release archives.

## Cancellation and teardown

Track every in-flight operation with an abort signal and its session. On a valid cancel, mark the matching operation terminal before aborting. Send `CANCELLED` once if the session stays open. Unknown or terminal request IDs are no-ops. A backend that ignores abort still cannot publish its result. Release any media handle that arrives late.

On navigation, selection change, Desk/project/node switch, revocation, deactivation or unmount, invalidate the session first. Then abort in-flight work, close ports, remove listeners, release broker handles, revoke playback URLs and destroy the frame. Frame destruction also frees frame-owned URLs if the bootstrap cannot clean up. Teardown is idempotent. Check session identity before every asynchronous delivery so old replies cannot affect a new mount even when request IDs match.

## Future Runtime tests

| Area | Required checks |
| --- | --- |
| Manifest compatibility | Accept both example manifests and exact pins. Reject incompatible API versions, stage identity mismatches, traversal, escaping links, duplicate IDs, unknown fields and invalid Desk/capability combinations. |
| Message schemas | Validate both example exchanges and cancel and error variants. Reject invalid shapes, unknown capabilities, scope overrides, unexpected fields, duplicate requests, wrong port/session and mismatched result capabilities. |
| Authorization and isolation | Assert no resource read for absent or revoked grants, wrong release or selection, cross-project or cross-node references and colliding resource IDs. Verify in Electron that frames lack Node globals, preload bridges, direct IPC and parent DOM access. Exercise blocked navigation, popups, network requests and device permissions. |
| Cancellation and late replies | Cancel a pending read and observe abort and one terminal error. Force a backend to complete anyway and assert no delivery and no leaked media. Reuse a request ID after remount and verify the old reply is ignored. |
| Revocation and teardown | Revoke during a request and after successful media delivery. Exercise navigation, selection, Desk/project/node switches, deactivation and unmount. Verify release of requests, ports, listeners, handles, media URLs and frames, including repeated disposal. |
| Desk integration | Play a completed MP4 in the Social Video viewer and check selection, denial and cleanup. Render an authorized draft's tokens in the UI Theme panel and check scope, denial and cleanup. |
