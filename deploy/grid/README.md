# Gift Search on Grid

The hosted app runs the sample scenarios in the browser. **Multi-agent Collaboration** animates the handoffs and **Research memory** shows how the next turn uses the reviewer’s feedback. Live searches and personal harnesses run through the local launcher.

## Deploy the demo app

1. Set `GIFT_GRID_IMAGE` to the approved registry path and version. Build and publish the demo image from the repository root.

   ```sh
   docker buildx build -f deploy/grid/Dockerfile --platform linux/amd64,linux/arm64 -t "$GIFT_GRID_IMAGE" --push .
   ```

2. Add the Deployment and ClusterIP Service from [workload.yaml](workload.yaml) to the Grid GitOps configuration. Set the image to the published digest and reference the existing Grid gateway signing key. If the gateway uses a custom issuer, set the same `AGENTIC_APP_TOKEN_ISSUER` on the runtime.
3. Add the package and installation from [registration.json](registration.json) to Grid’s Agentic Apps configuration. Keep the runtime origin on the private ClusterIP Service.

The iframe uses `/apps/gift-search` as its canonical browser URL. Grid forwards the path suffix to the runtime and signs an app-scoped token. The runtime checks the token and the `gift-search:read` scope before serving the allowlisted site files. Its only unauthenticated route is `/healthz` for probes.

## Link to a demo

After deployment, open `https://grid.outshift.io/apps/gift-search?demo=chocolate` while signed in. The link selects **Chocolate under $55**. Select **Run demo** to start playback. Use **Copy demo link** to share the current selection.

The supported IDs are `chocolate`, `coffee`, `outdoors`, and `creative`. The same query links work in the standalone site and local dashboard. Links contain the sample scenario ID. Saved live runs are stored by the user’s local server.
