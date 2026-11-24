# Gift Search on Grid

The hosted app runs the sample scenarios in the browser. **Multi-agent Collaboration** animates the handoffs and **Research memory** shows how the next turn uses the reviewer’s feedback. Live searches can run through the local launcher or through an optional worker paired to a signed-in Grid account.

## Deploy the demo app

1. Set `GIFT_GRID_IMAGE` to the approved registry path and version. Build and publish the demo image from the repository root.

   ```sh
   docker buildx build -f deploy/grid/Dockerfile --platform linux/amd64,linux/arm64 -t "$GIFT_GRID_IMAGE" --push .
   ```

2. Add the Deployment and ClusterIP Service from [workload.yaml](workload.yaml) to the Grid GitOps configuration. Set the image to the published digest and reference the existing Grid gateway signing key. If the gateway uses a custom issuer, set the same `AGENTIC_APP_TOKEN_ISSUER` on the runtime.
3. Add the package and installation from [registration.json](registration.json) to Grid’s Agentic Apps configuration. Keep the runtime origin on the private ClusterIP Service.

The iframe uses `/apps/gift-search` as its canonical browser URL. Grid forwards the path suffix to the runtime and signs an app-scoped token. The runtime checks the token and the `gift-search:read` scope before serving the allowlisted site files. Its only unauthenticated route is `/healthz` for probes.

## Link to a demo

After deployment, open `/apps/gift-search?demo=chocolate` on your Grid instance while signed in. The link selects **Chocolate under $55**. Select **Run demo** to start playback. Use **Copy link** to share the current selection.

The supported IDs are `chocolate`, `coffee`, `outdoors`, and `creative`. The same query links work in the standalone site and local dashboard. Links contain the sample scenario ID. Saved live runs are stored by the user’s local server.

## Pair a private live test worker

Run Gift Search with Claude Code in a private test pod and sign in inside the pod. Run [worker-relay.js](worker-relay.js) in that pod alongside the loopback dashboard. The relay reads a dedicated 32-byte hex-encoded token from `GIFT_GRID_RELAY_TOKEN_FILE`, and defaults to port `18001`. Use a private Service and restrict inbound access to the Grid runtime pod.

Set `GIFT_GRID_LIVE_WORKER` to the relay's private HTTP origin and `GIFT_GRID_BROWSER_ORIGIN` to the Grid origin. Supply `GIFT_GRID_LIVE_TOKEN` from the deployment secret store and `GIFT_GRID_LIVE_SUBJECT` with the account's stable Grid subject. Keep the relay token and Claude credentials in the test environment. The runtime verifies the Grid app token and matches its subject on every live API request. Other signed-in visitors can run the sample scenarios.

## Run a managed Claude Code worker

Install the server dependencies with `npm ci`. Configure the worker with the following environment variables.

| Variable | Value |
| --- | --- |
| `GIFT_CLAUDE_LITELLM_BASE_URL` | Private LiteLLM gateway origin |
| `GIFT_CLAUDE_LITELLM_MODEL` | Claude model alias backed by Bedrock |
| `GIFT_CLAUDE_LITELLM_TOKEN` | Dedicated, budgeted virtual key supplied from the secret store |
| `GIFT_CLAUDE_SESSION_BUDGET_USD` | Estimated per-session cap, such as `1` |
| `GIFT_AGENTCORE_WEB_SEARCH_REGION` | AWS Region of the AgentCore endpoint |
| `GIFT_AGENTCORE_WEB_SEARCH_ENDPOINT` | HTTPS DNS name of the AgentCore interface VPC endpoint |

Give the worker an AWS workload identity with `bedrock-agentcore:InvokeWebSearch` permission on `arn:aws:bedrock-agentcore:<region>:aws:tool/web-search.v1`. The private endpoint carries text searches from the server. Exact retailer pages still use the server's public HTTPS fetcher, and optional SerpApi Google Shopping results still count as leads. The LiteLLM virtual key budget covers model calls. AgentCore search has separate AWS billing.
