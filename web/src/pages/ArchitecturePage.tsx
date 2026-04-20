import { useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Globe, Scale, Monitor, Activity, Package, Database,
  Zap, HardDrive, GitFork, GitBranch, Sparkles,
  Mail, Network, Map, Search, AlertCircle, LucideIcon, X,
  MessageSquare, FileText, Cpu, MessageCircle, Image, Plane,
} from 'lucide-react'
import Layout from '../components/Layout'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Globe, Scale, Monitor, Activity, Package, Database,
  Zap, HardDrive, GitFork, GitBranch, Sparkles,
  Mail, Network, Map, Search, AlertCircle,
  MessageSquare, FileText, Cpu, MessageCircle, Image, Plane,
}

// ─── Node detail data ─────────────────────────────────────────────────────────

interface NodeDetail {
  whatIsIt: string
  whatItDoes: string[]
  whyThisChoice?: string
}

const NODE_DETAILS: Record<string, NodeDetail> = {
  user: {
    whatIsIt: "Represents any user of the Papaya platform — either a client managing their trip, or an admin (travel planner) overseeing the operation. Both roles access the system through a standard web browser; the experience and available features differ based on the JWT token issued at login.",
    whatItDoes: [
      "Clients authenticate via a magic link sent by email — a signed, single-use token that expires after 1 hour. No passwords are stored or required",
      "Admins authenticate via a password at /admin/login, receiving a separate JWT with elevated permissions",
      "All browser-to-server communication is encrypted over HTTPS — the browser never communicates over plain HTTP",
      "The React app is downloaded once on first load; subsequent page interactions are API calls only, with no full page reloads",
    ],
    whyThisChoice: "Magic link authentication removes the password management burden for clients who may only log in once or twice per trip. JWTs are stateless — the API can validate a token without a database lookup on every request.",
  },
  dns: {
    whatIsIt: "DNS (Domain Name System) translates the human-readable domain travel-papaya.com into the numeric IP address of the AWS load balancer. It acts as the first step in every request before traffic even reaches AWS.",
    whatItDoes: [
      "Both travel-papaya.com and www.travel-papaya.com resolve to the AWS Application Load Balancer via a CNAME record",
      "DNS records are managed through GoDaddy, where the domain is registered",
      "A CNAME record (rather than an A record) is used — this points to the ALB's DNS name rather than a fixed IP, which is necessary because AWS load balancer IPs can change",
    ],
    whyThisChoice: "GoDaddy hosts the domain registration. A future migration to AWS Route 53 would tighten integration with the rest of the AWS stack, but the current setup functions correctly and requires no immediate change.",
  },
  alb: {
    whatIsIt: "The Application Load Balancer is the entry point for all traffic into the AWS infrastructure. It terminates HTTPS, handles the SSL certificate, and routes each request to the correct container based on the URL path.",
    whatItDoes: [
      "Listens on port 443 (HTTPS) and issues a permanent redirect for any plain HTTP traffic — HTTPS is enforced at the infrastructure level, not in application code",
      "Routes any request path beginning with /api/ to the API container (FastAPI); all other paths go to the web container (React/Nginx)",
      "SSL certificates are provisioned and auto-renewed by AWS Certificate Manager (ACM) — no manual certificate management is required",
      "Provides horizontal scalability: if multiple container instances were running, the ALB would distribute traffic across them automatically",
    ],
    whyThisChoice: "ALB is the standard routing layer for ECS Fargate deployments. Native integration with Fargate target groups and ACM means SSL termination and certificate renewal are fully automated.",
  },
  'ecs-web': {
    whatIsIt: "A Fargate container serving the React frontend. Fargate is AWS's serverless container runtime — the underlying EC2 instances are fully managed by AWS, with no direct server access required. The container runs Nginx, which serves the pre-built React application as static files.",
    whatItDoes: [
      "Serves the compiled React + TypeScript application as static HTML, CSS, and JavaScript via Nginx",
      "Built with Vite — a fast modern bundler — and compiled to an optimised production bundle at deploy time",
      "Handles client-side routing via React Router: navigation between pages is handled in-browser without server round-trips",
      "Calls Mapbox's JavaScript SDK directly from the browser to render interactive trip maps — Mapbox is never proxied through the API",
      "Delivers the full client portal: itinerary timeline, accommodation tab, interactive map, Maya chat panel, flights tab, and document management",
    ],
    whyThisChoice: "React + TypeScript provides a strongly-typed, component-based frontend with fast client-side navigation. Nginx is purpose-built for serving static files efficiently. Fargate eliminates OS patching and instance management entirely.",
  },
  'ecs-api': {
    whatIsIt: "A Fargate container running the Python backend. This is where all business logic executes — authentication, AI orchestration, database operations, file management, and email delivery. Built with FastAPI, a modern async Python framework with automatic OpenAPI documentation generation.",
    whatItDoes: [
      "Issues and validates JWT tokens for both client and admin authentication — tokens are stateless and verified on every request without a database lookup",
      "Orchestrates the full trip lifecycle: intake submission → background AI generation → client review → itinerary editing → confirmation",
      "Runs the four-agent Maya AI pipeline: Intake, Analyser, Generator (with web search), and Concierge — all via the Anthropic SDK",
      "Performs RAG (Retrieval-Augmented Generation): before itinerary generation, retrieves relevant DestinationCard records from the database using keyword and PostgreSQL full-text search, providing the Generator with curated local context",
      "Geocodes activity locations via Google Places in a background thread post-generation, so the client-facing response is never blocked",
      "Enriches AI-generated hotel suggestions with real photos, ratings, and addresses via Google Places, also in a background thread",
      "Manages all database reads and writes via SQLAlchemy ORM, and runs Alembic schema migrations automatically on container startup",
    ],
    whyThisChoice: "FastAPI offers async request handling, automatic input validation via Pydantic, and auto-generated API docs. Python is the primary language for Anthropic's SDK and the broader AI tooling ecosystem.",
  },
  cloudwatch: {
    whatIsIt: "AWS CloudWatch is the native monitoring and logging service for AWS infrastructure. All stdout/stderr output from both containers is automatically streamed to CloudWatch log groups, and container-level metrics are captured continuously.",
    whatItDoes: [
      "Aggregates logs from both the API and web containers into the /ecs/papaya log group — searchable and filterable in the AWS console",
      "Captures structured request logs: endpoint called, response time, status code, and any errors or tracebacks",
      "Tracks container-level metrics: CPU utilisation, memory usage, and task health across both Fargate services",
      "Can be configured to trigger alarms on error rate thresholds or resource exhaustion — the first diagnostic tool when a production issue occurs",
    ],
    whyThisChoice: "CloudWatch requires zero additional setup when running on ECS — AWS streams logs automatically. It provides sufficient observability for the current scale without introducing a third-party logging stack.",
  },
  ecr: {
    whatIsIt: "ECR (Elastic Container Registry) is AWS's private Docker image repository. Every deployment produces two new Docker images — one for the API, one for the web container — which are stored in ECR and pulled by ECS when starting new tasks.",
    whatItDoes: [
      "Stores two image repositories: papaya-api (Python/FastAPI) and papaya-web (React/Nginx)",
      "GitHub Actions pushes newly built images to ECR on every deployment triggered by a push to main",
      "ECS pulls the latest tagged image from ECR when launching or replacing container tasks",
      "Images are built for linux/amd64 — the architecture used by AWS Fargate",
    ],
    whyThisChoice: "ECR integrates natively with ECS and IAM — no separate credentials are needed for ECS to pull images. Images remain private within the AWS account.",
  },
  rds: {
    whatIsIt: "RDS (Relational Database Service) is AWS's managed PostgreSQL service. It runs inside a private VPC subnet — inaccessible from the public internet — and is only reachable from within the AWS environment.",
    whatItDoes: [
      "Stores all application data: clients, trips, intake responses, itineraries, messages, flights, stays, hotel suggestion records, destination cards, and document metadata",
      "Isolated in a private VPC subnet — no public IP, no direct internet access. Only the API container can connect",
      "AWS handles automated backups, minor version patching, and storage management",
      "Schema migrations are managed by Alembic and run automatically each time the API container starts — the database structure stays in sync with the codebase without manual intervention",
    ],
    whyThisChoice: "PostgreSQL is the industry standard for relational application data, with excellent support for JSON columns (used for itinerary data) and full-text search (used in the RAG retrieval layer). RDS removes all server management overhead.",
  },
  s3: {
    whatIsIt: "S3 (Simple Storage Service) is AWS's object storage service, used for any file that should not live in the database — documents, uploaded screenshots, and other binary assets.",
    whatItDoes: [
      "Stores trip documents uploaded by clients or admins: booking confirmations, passports, travel insurance certificates",
      "Stores booking screenshots uploaded by admins for AI parsing — Claude Haiku extracts structured flight and hotel data from these images",
      "All objects are private by default — clients access files via presigned URLs, which are time-limited signed links generated server-side by the API",
      "File references (S3 keys) are stored in the database; the actual file content never touches the database",
    ],
    whyThisChoice: "S3 is purpose-built for file storage — cheap, durable, and infinitely scalable. Storing binary files in a relational database would degrade query performance and inflate costs.",
  },
  github: {
    whatIsIt: "GitHub hosts the complete version-controlled codebase for Papaya. Every change to the application — frontend, backend, infrastructure configuration — is tracked as a Git commit, providing a full audit trail and the ability to revert any change.",
    whatItDoes: [
      "Hosts three main directories: /web (React frontend), /api (Python backend + Alembic migrations), and /seed (destination card JSON files)",
      "Every commit is a permanent, reversible snapshot — any breaking change can be identified and rolled back",
      "A push to the main branch is the single trigger for the entire CI/CD pipeline — there is no separate deploy step",
      "The task definition (ECS container configuration) is gitignored and managed separately — secrets never enter the repository",
    ],
  },
  gha: {
    whatIsIt: "GitHub Actions is the CI/CD automation layer. A workflow file in the repository defines a sequence of steps that execute automatically whenever code is pushed to main — building, packaging, and deploying the updated application without any manual steps.",
    whatItDoes: [
      "Triggered automatically on every push to the main branch",
      "Builds Docker images for both the API and web containers, compiled for linux/amd64 to match the Fargate runtime",
      "Pushes the new images to ECR, tagged for the deployment",
      "Forces a new ECS deployment for both services, causing Fargate to pull the fresh images and replace running tasks",
      "Waits for ECS to report both services as stable before marking the deployment complete — a failed health check rolls back automatically",
      "Injects frontend environment variables (Mapbox token, Sentry DSN) at build time via Vite — they are baked into the compiled JS bundle",
    ],
    whyThisChoice: "GitHub Actions is the natural CI/CD choice when the codebase is already on GitHub — no additional tooling or credentials are needed. The workflow configuration lives in the repository alongside the code it deploys.",
  },
  anthropic: {
    whatIsIt: "Anthropic is the AI research company behind Claude, the large language model that powers all of Papaya's AI features. Two Claude model variants are used: Claude Sonnet 4.6 for all primary generation and reasoning tasks, and Claude Haiku 4.5 for lightweight classification and memory extraction where speed and cost matter more than depth.",
    whatItDoes: [
      "Claude Sonnet 4.6 runs the full intake chat, intake analysis (via tool_use), itinerary generation (agentic loop with web search), concierge chat, block editing, accommodation suggestions, and flight suggestions",
      "Claude Haiku 4.5 handles intent classification before each concierge response — a fast, cheap model call that routes the message before Sonnet is invoked",
      "Claude Haiku 4.5 also runs client memory extraction after each chat session, summarising what was learned about the client into a persistent memory string",
      "Claude Haiku 4.5 performs the activity photo vision quality gate — checking whether an Unsplash photo actually depicts the activity before displaying it",
      "Anthropic's tool_use API (structured outputs / function calling) is used by the Analyser to guarantee valid JSON output without regex parsing",
    ],
    whyThisChoice: "Claude Sonnet 4.6 produces the highest-quality long-form travel writing of any available model. The two-model strategy (Sonnet for depth, Haiku for speed) optimises both output quality and cost — classification and memory tasks don't need Sonnet's capability.",
  },
  gmail: {
    whatIsIt: "Gmail SMTP is used as the transactional email delivery layer. Rather than running a dedicated mail server, the API authenticates with Gmail using an App Password and sends via Google's SMTP infrastructure.",
    whatItDoes: [
      "Delivers magic login links to clients — a signed, single-use JWT embedded in the email link",
      "Sends a welcome email when a new client record is created",
      "Notifies clients when their itinerary has been generated and is ready to view in the portal",
      "Sends confirmation emails to both the client and admin when an itinerary is confirmed",
      "Alerts the admin when a client posts a new message in the portal messaging thread",
    ],
    whyThisChoice: "Gmail SMTP offers high deliverability with minimal setup — emails are unlikely to be flagged as spam. It's a pragmatic choice for current scale, with a clear upgrade path to a dedicated transactional service (SendGrid, Postmark) if volume grows.",
  },
  mapbox: {
    whatIsIt: "Mapbox is a developer-focused mapping platform. In Papaya, it operates entirely client-side — the React app loads the Mapbox GL JS SDK directly in the browser to render interactive maps. No Mapbox calls are made from the API.",
    whatItDoes: [
      "Renders the interactive trip map on the client portal — pannable, zoomable, with custom styling matching the Papaya design",
      "Displays destination markers, per-day activity pins (colour-coded morning/afternoon/evening), and confirmed hotel pins",
      "Draws animated flight arc lines between cities, visualising the journey route",
      "Renders per-day route lines from the stay to each activity, with toggle between walking and driving time",
      "All geocoordinates are sourced from the API (generated by Claude and verified by Google Places) — Mapbox receives coordinates and handles rendering only",
    ],
    whyThisChoice: "Mapbox GL JS offers finer styling control than Google Maps for building branded map experiences. Running it client-side keeps map tile requests off the API entirely, reducing server load and cost.",
  },
  places: {
    whatIsIt: "Google Places API provides access to Google's global database of businesses and locations — verified names, addresses, coordinates, photos, ratings, and website URLs. It is used by the API to verify and enrich AI-generated content.",
    whatItDoes: [
      "Verifies AI-generated hotel suggestions against Google's database — only hotels that can be matched to a real Places record are surfaced to clients",
      "Fetches verified photos, ratings, website URLs, and addresses for each confirmed hotel suggestion",
      "Photo URLs are cached against the hotel suggestion record in the database — Google Places is queried once per hotel, not on every page load",
      "Geocodes itinerary activity locations to precise lat/lng coordinates for map pin placement — this runs in a background thread post-generation",
    ],
    whyThisChoice: "Google Places has the most comprehensive and current business database available. Using it as a verification layer prevents hallucinated or closed venues from appearing in client itineraries.",
  },
  sentry: {
    whatIsIt: "Sentry is a frontend error monitoring platform. The Sentry SDK is initialised in the React app and silently captures any unhandled JavaScript errors, reporting them with full context — stack trace, browser, user actions — to the Sentry dashboard.",
    whatItDoes: [
      "Captures unhandled JavaScript errors and promise rejections in the browser, including errors clients experience but never report",
      "Records the exact file, line number, component stack, and sequence of user interactions that preceded the error",
      "Groups duplicate errors — the dashboard shows unique issues with occurrence counts rather than flooding with individual events",
      "Tracks error frequency over time, making it possible to distinguish a one-off edge case from a widespread regression",
      "Only active when VITE_SENTRY_DSN is set — disabled in local development to avoid noise",
    ],
    whyThisChoice: "Sentry is the industry standard for frontend error tracking. Without it, production JavaScript errors are invisible unless a client reports them — which the majority won't.",
  },
  unsplash: {
    whatIsIt: "Unsplash is used in two distinct places: activity photos in the itinerary timeline, and full-width hero photos on trip cards. Both use cases apply independent Claude Haiku vision quality gates before any photo is displayed.",
    whatItDoes: [
      "Activity photos: the Generator agent writes a photo_query per activity block at itinerary creation time — queries are specific and visually distinct within each day (e.g. 'Fushimi Inari torii gates', 'Nishiki Market street food', 'Kyoto kaiseki dinner'). Each candidate passes a Haiku vision check that confirms the image actually depicts the activity before display",
      "Hero photos: wide scenic destination images shown on trip cards. The API uses destination-mapped query patterns (e.g. Santorini → 'whitewash blue dome golden light', Tokyo → 'skyline dusk warm') to bias results toward iconic, high-impact imagery",
      "Hero photos pass a stricter Haiku vision gate: accepted only if scenic landscape, skyline, coast, mountain, landmark, or architecture — in full colour, well-exposed, and representative of the destination. Crowds, B&W, generic interiors, and pitch-black shots are rejected",
      "For trips with multiple destinations, a scene-type diversity filter prevents two hero photos sharing the same tag (mountain, city, coast, beach, etc.) — ensuring the trip card panel feels visually varied",
    ],
    whyThisChoice: "Unsplash has broad coverage of travel destinations and requires no per-image attribution on the API plan. The two-layer approach — targeted query generation plus vision verification — addresses both failure modes: irrelevant photos passing keyword search, and technically correct but visually poor photos making it through.",
  },
  aerodatabox: {
    whatIsIt: "AeroDataBox is a flight information API that provides scheduled and live flight data by flight number and departure date — including route, times, terminals, and airline details.",
    whatItDoes: [
      "Powers the flight lookup feature in the client portal: a client enters a flight number and date and receives full route details",
      "Returns departure and arrival airports (IATA codes), scheduled times, terminal assignments, and airline name",
      "The returned IATA codes are used to construct a Mapbox route map for the specific flight, rendered directly in the portal",
    ],
    whyThisChoice: "AeroDataBox offers the most cost-effective pricing for low-volume flight lookups and covers the major Australian and international carriers that Papaya clients use.",
  },
  'intake-maya': {
    whatIsIt: "Intake Maya is the first agent in the pipeline — a conversational AI built on Claude Sonnet 4.6 that gathers trip preferences through natural dialogue. Its system prompt defines a specific persona, tone constraints, conversation rules, and 11 data categories that must be collected before the intake is complete.",
    whatItDoes: [
      "Conducts a real-time multi-turn conversation, collecting destination, dates, budget, companions, pace, accommodation style, food profile, activity interests, fitness level, travel experience, and non-negotiables",
      "Asks one or two questions per message, adapting based on client responses — never presenting a form-like list of questions",
      "Appends a [SUGGESTIONS] tag to messages that offer enumerable choices, which the frontend renders as clickable suggestion buttons — reducing friction for common answers",
      "Signals pipeline completion with a [INTAKE_COMPLETE] token on the final message, which the backend detects to fire the generation pipeline as a background task",
      "Tone is defined precisely in the system prompt: warm but not salesy, dry humour permitted sparingly, no generic affirmations ('Great choice!', 'Absolutely!')",
    ],
    whyThisChoice: "Conversational intake collects qualitative data that forms cannot — nuance like 'I hate rushing' or 'we love street food' directly informs itinerary tone and activity selection. The [SUGGESTIONS] tag bridges structured UX (clickable buttons) with free-form conversation.",
  },
  analyser: {
    whatIsIt: "The Analyser is a pure synthesis agent — it takes the full intake conversation transcript and converts it into a structured ClientProfile JSON object. It uses Claude Sonnet 4.6 with tool_use (Anthropic's structured output / function calling capability) to guarantee valid JSON output.",
    whatItDoes: [
      "Reads the complete intake transcript and calls the extract_client_profile tool, forcing output into a validated JSON schema",
      "Extracts typed fields: traveller count, group size, trip purpose, pace enum, accommodation style enum, food profile object, activity interest list, fitness level, experience level, non-negotiables, must-avoids, and personality type",
      "Writes a personality_type field — 1-2 sentences describing how the client travels — and key_insights for the Generator to act on",
      "Explicitly records information gaps: fields the client did not mention, so the Generator knows what to assume rather than fabricate",
    ],
    whyThisChoice: "Using tool_use guarantees the output conforms to the expected schema — no regex parsing, no fragile string extraction. Separating analysis from generation means each agent can be tested and refined independently.",
  },
  generator: {
    whatIsIt: "The Generator is the most computationally intensive agent. It receives the structured ClientProfile from the Analyser and produces a complete itinerary JSON — real venues, day-by-day plans, geocoordinates, costs, transport legs, hotel suggestions, packing list, and travel notes. It runs on Claude Sonnet 4.6 in an agentic loop with web search enabled.",
    whatItDoes: [
      "Before generation, the RAG retrieval layer queries the database for relevant DestinationCard records — curated destination knowledge matched by name and interest tags using PostgreSQL full-text search — providing the Generator with verified local context",
      "Runs an agentic loop with up to 8 web search turns (web_search_20250305 tool), using live search results to verify real venues, opening hours, booking requirements, and current conditions",
      "Generates geocoordinates for every activity at creation time — embedding them in the itinerary JSON so the map layer requires no additional geocoding pass",
      "Writes a photo_query field per activity block, crafted to return visually distinct, high-quality Unsplash results for morning/afternoon/evening slots within each day",
      "Produces 6-8 hotel suggestions per destination using exact official hotel names — a deliberate choice to maximise Google Places match rate during the enrichment step",
      "Post-generation, activity geocoding and hotel suggestion enrichment (Google Places verification + photos) are dispatched as background threads — the client-facing response is not blocked",
    ],
    whyThisChoice: "The agentic web search loop grounds the itinerary in verifiable reality rather than plausible-sounding approximations. The RAG layer adds curated destination knowledge that generalised web search alone may not surface. Background threading for geocoding and enrichment keeps the API response time fast while ensuring full data quality by the time the client views their portal.",
  },
  concierge: {
    whatIsIt: "Concierge Maya handles all client interaction after the itinerary is delivered — running on Claude Sonnet 4.6. Before each Sonnet call, a fast intent classification step using Claude Haiku 4.5 routes the message to the correct handler, avoiding expensive operations when a simple conversational response would suffice.",
    whatItDoes: [
      "Classifies every incoming message using Claude Haiku 4.5 via tool_use — routing to one of four intents: casual_question, targeted_edit (single block), full_regeneration, or block_removal",
      "For targeted edits, calls the edit_block endpoint which patches a single morning/afternoon/evening activity without touching the rest of the itinerary — fast and surgical",
      "For full regeneration, re-runs the complete Generator pipeline with updated context and replaces the itinerary record in the database",
      "Maintains a persistent client_memory string per client — extracted and updated after each session by a Claude Haiku 4.5 call, so the Concierge retains context across separate conversations",
      "Has full access to the itinerary JSON on every turn, enabling specific references to activities, days, and costs in its responses",
    ],
    whyThisChoice: "Intent classification with Haiku before invoking Sonnet avoids triggering a full regeneration (expensive, slow) when the client simply asked a question. The two-model approach cuts cost and latency on the most frequent interaction type while preserving full capability when genuinely needed.",
  },
}

// ─── Node types ────────────────────────────────────────────────────────────────

interface NodeData {
  label: string
  sublabel?: string
  icon: string
  color: string
  [key: string]: unknown
}

const HANDLE_STYLE = { opacity: 0, width: 6, height: 6, border: 'none' }

function ServiceNode({ id, data, selected }: NodeProps) {
  const d = data as NodeData
  const Icon = ICON_MAP[d.icon]
  const hasDetail = !!NODE_DETAIL_KEY[id]
  return (
    <div style={{
      background: selected ? '#1a2744' : '#0f172a',
      border: `1px solid ${selected ? d.color : d.color + '40'}`,
      borderRadius: '10px',
      padding: '12px 16px',
      minWidth: 150,
      boxShadow: selected
        ? `0 0 20px ${d.color}33, 0 0 0 1px ${d.color}44`
        : '0 2px 12px rgba(0,0,0,0.5)',
      transition: 'all 0.15s',
      cursor: hasDetail ? 'pointer' : 'default',
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <div style={{
        width: 36, height: 36, borderRadius: '8px',
        background: `${d.color}18`,
        border: `1px solid ${d.color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 9px',
      }}>
        {Icon && <Icon size={16} color={d.color} strokeWidth={1.8} />}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', lineHeight: 1.3 }}>{d.label}</div>
      {d.sublabel && (
        <div style={{ fontSize: '10px', color: d.color + 'bb', marginTop: 3, fontWeight: 500 }}>{d.sublabel}</div>
      )}
      <Handle type="source" position={Position.Right} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
    </div>
  )
}

function GroupNode({ data }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      border: `1px solid ${d.color}25`,
      borderRadius: '14px',
      background: `${d.color}07`,
      width: '100%',
      height: '100%',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -12, left: 14,
        background: '#0d1117',
        border: `1px solid ${d.color}35`,
        color: d.color + 'cc',
        fontSize: '9px', fontWeight: 800,
        padding: '2px 10px',
        borderRadius: '100px',
        letterSpacing: '1.2px',
        textTransform: 'uppercase',
      }}>
        {d.label}
      </div>
    </div>
  )
}

const nodeTypes = { service: ServiceNode, group: GroupNode }

// ─── Colors ────────────────────────────────────────────────────────────────────

const AWS_COLOR  = '#f07332'
const EXT_COLOR  = '#818cf8'
const CD_COLOR   = '#34d399'
const USER_COLOR = '#38bdf8'
const MAYA_COLOR = '#a78bfa'

// ─── Nodes ─────────────────────────────────────────────────────────────────────

const initialNodes = [
  // Groups
  { id: 'grp-aws',  type: 'group', position: { x: 280, y: 30  }, style: { width: 1000, height: 720 }, data: { label: 'AWS — us-east-1', color: AWS_COLOR, icon: '' } },
  { id: 'grp-maya', type: 'group', position: { x: 280, y: 800 }, style: { width: 1000, height: 230 }, data: { label: 'Maya Agent Pipeline', color: MAYA_COLOR, icon: '' } },
  { id: 'grp-cd',   type: 'group', position: { x: 30,  y: 455 }, style: { width: 210,  height: 330 }, data: { label: 'CI / CD Pipeline', color: CD_COLOR, icon: '' } },
  { id: 'grp-ext',  type: 'group', position: { x: 1350, y: 30 }, style: { width: 230,  height: 1120 }, data: { label: 'External Services', color: EXT_COLOR, icon: '' } },

  // User
  { id: 'user', type: 'service', position: { x: 60, y: 230 }, data: { label: 'Browser', sublabel: 'Client / Admin', icon: 'Globe', color: USER_COLOR } },

  // AWS nodes — generous spacing for readability
  { id: 'dns',        type: 'service', position: { x: 320,  y: 90  }, data: { label: 'DNS', sublabel: 'GoDaddy', icon: 'Network', color: AWS_COLOR } },
  { id: 'alb',        type: 'service', position: { x: 600,  y: 90  }, data: { label: 'Load Balancer', sublabel: 'ALB + ACM', icon: 'Scale', color: AWS_COLOR } },
  { id: 'ecs-web',    type: 'service', position: { x: 940,  y: 90  }, data: { label: 'Web Container', sublabel: 'React + Nginx · Fargate', icon: 'Monitor', color: AWS_COLOR } },
  { id: 'cloudwatch', type: 'service', position: { x: 600,  y: 340 }, data: { label: 'CloudWatch', sublabel: 'Logs + Monitoring', icon: 'Activity', color: AWS_COLOR } },
  { id: 'ecr',        type: 'service', position: { x: 320,  y: 380 }, data: { label: 'Container Registry', sublabel: 'ECR', icon: 'Package', color: AWS_COLOR } },
  { id: 'ecs-api',    type: 'service', position: { x: 940,  y: 320 }, data: { label: 'API Container', sublabel: 'FastAPI · Fargate', icon: 'Zap', color: AWS_COLOR } },
  { id: 's3',         type: 'service', position: { x: 320,  y: 560 }, data: { label: 'Document Storage', sublabel: 'S3', icon: 'HardDrive', color: AWS_COLOR } },
  { id: 'rds',        type: 'service', position: { x: 940,  y: 530 }, data: { label: 'PostgreSQL', sublabel: 'RDS', icon: 'Database', color: AWS_COLOR } },

  // Maya agent pipeline — 250px spacing
  { id: 'intake-maya', type: 'service', position: { x: 305,  y: 855 }, data: { label: 'Intake', sublabel: 'Conversational intake', icon: 'MessageSquare', color: MAYA_COLOR } },
  { id: 'analyser',    type: 'service', position: { x: 555,  y: 855 }, data: { label: 'Analyser', sublabel: 'Transcript → ClientProfile', icon: 'FileText', color: MAYA_COLOR } },
  { id: 'generator',   type: 'service', position: { x: 805,  y: 855 }, data: { label: 'Generator', sublabel: 'Itinerary + web search', icon: 'Cpu', color: MAYA_COLOR } },
  { id: 'concierge',   type: 'service', position: { x: 1055, y: 855 }, data: { label: 'Concierge', sublabel: 'Post-generation chat', icon: 'MessageCircle', color: MAYA_COLOR } },

  // CI/CD
  { id: 'github', type: 'service', position: { x: 50, y: 510 }, data: { label: 'GitHub', sublabel: 'Source control', icon: 'GitFork', color: CD_COLOR } },
  { id: 'gha',    type: 'service', position: { x: 50, y: 650 }, data: { label: 'GitHub Actions', sublabel: 'CD pipeline', icon: 'GitBranch', color: CD_COLOR } },

  // External services
  { id: 'anthropic',   type: 'service', position: { x: 1370, y: 60  }, data: { label: 'Anthropic', sublabel: 'Claude Sonnet 4.6', icon: 'Sparkles', color: EXT_COLOR } },
  { id: 'mapbox',      type: 'service', position: { x: 1370, y: 210 }, data: { label: 'Mapbox', sublabel: 'Interactive maps', icon: 'Map', color: EXT_COLOR } },
  { id: 'places',      type: 'service', position: { x: 1370, y: 360 }, data: { label: 'Google Places', sublabel: 'Hotel photos + geocoding', icon: 'Search', color: EXT_COLOR } },
  { id: 'unsplash',    type: 'service', position: { x: 1370, y: 510 }, data: { label: 'Unsplash', sublabel: 'Activity + hero photos', icon: 'Image', color: EXT_COLOR } },
  { id: 'aerodatabox', type: 'service', position: { x: 1370, y: 660 }, data: { label: 'AeroDataBox', sublabel: 'Flight lookup', icon: 'Plane', color: EXT_COLOR } },
  { id: 'gmail',       type: 'service', position: { x: 1370, y: 810 }, data: { label: 'Gmail SMTP', sublabel: 'Transactional email', icon: 'Mail', color: EXT_COLOR } },
  { id: 'sentry',      type: 'service', position: { x: 1370, y: 960 }, data: { label: 'Sentry', sublabel: 'Error tracking', icon: 'AlertCircle', color: EXT_COLOR } },
]

// ─── Edges ─────────────────────────────────────────────────────────────────────

const E = (color: string, width = 1.5) => ({ stroke: color, strokeWidth: width })
const L = (label: string) => ({
  label,
  labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 600 },
  labelBgStyle: { fill: '#0d1117', fillOpacity: 1 },
  labelBgPadding: [3, 7] as [number, number],
  labelBgBorderRadius: 4,
})

const initialEdges = [
  // User → AWS
  { id: 'e-user-dns',      source: 'user',    target: 'dns',        animated: true,  style: E(USER_COLOR), ...L('HTTPS') },
  { id: 'e-dns-alb',       source: 'dns',     target: 'alb',        style: E(AWS_COLOR) },
  { id: 'e-alb-web',       source: 'alb',     target: 'ecs-web',    style: E(AWS_COLOR), ...L('web') },
  { id: 'e-alb-api',       source: 'alb',     target: 'ecs-api',    style: E(AWS_COLOR), ...L('API') },

  // AWS internal
  { id: 'e-api-rds',       source: 'ecs-api', target: 'rds',        style: E(AWS_COLOR) },
  { id: 'e-api-s3',        source: 'ecs-api', target: 's3',         style: E(AWS_COLOR) },
  { id: 'e-ecr-api',       source: 'ecr',     target: 'ecs-api',    style: E(AWS_COLOR), ...L('pull image') },
  { id: 'e-ecr-web',       source: 'ecr',     target: 'ecs-web',    style: E(AWS_COLOR) },
  { id: 'e-web-cw',        source: 'ecs-web', target: 'cloudwatch', style: E('#334155'), type: 'smoothstep' },
  { id: 'e-api-cw',        source: 'ecs-api', target: 'cloudwatch', style: E('#334155'), type: 'smoothstep' },

  // CI/CD
  { id: 'e-gh-gha',        source: 'github',  target: 'gha',        animated: true, style: E(CD_COLOR), ...L('push to main') },
  { id: 'e-gha-ecr',       source: 'gha',     target: 'ecr',        style: E(CD_COLOR), ...L('push image') },
  { id: 'e-gha-ecs',       source: 'gha',     target: 'ecs-api',    style: E(CD_COLOR), ...L('deploy') },
  { id: 'e-gha-ecs-web',   source: 'gha',     target: 'ecs-web',    style: E(CD_COLOR) },

  // API → External services
  { id: 'e-api-anthropic',  source: 'ecs-api', target: 'anthropic',   animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-places',     source: 'ecs-api', target: 'places',      animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-unsplash',   source: 'ecs-api', target: 'unsplash',    animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-aerodatabox', source: 'ecs-api', target: 'aerodatabox', animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-gmail',      source: 'ecs-api', target: 'gmail',       animated: true, style: E(EXT_COLOR) },
  { id: 'e-web-mapbox',     source: 'ecs-web', target: 'mapbox',      animated: true, style: E(EXT_COLOR) },
  { id: 'e-web-sentry',     source: 'ecs-web', target: 'sentry',      style: E('#334155'), type: 'smoothstep' },

  // Maya pipeline
  { id: 'e-api-intake',        source: 'ecs-api',     target: 'intake-maya', style: E(MAYA_COLOR), ...L('triggers') },
  { id: 'e-intake-analyser',   source: 'intake-maya', target: 'analyser',    animated: true, style: E(MAYA_COLOR), ...L('transcript') },
  { id: 'e-analyser-gen',      source: 'analyser',    target: 'generator',   animated: true, style: E(MAYA_COLOR), ...L('profile') },
  { id: 'e-gen-concierge',     source: 'generator',   target: 'concierge',   style: E(MAYA_COLOR), ...L('itinerary') },
]

// ─── Detail modal ──────────────────────────────────────────────────────────────

// Map node id → detail key
const NODE_DETAIL_KEY: Record<string, string> = {
  user: 'user',
  dns: 'dns',
  alb: 'alb',
  'ecs-web': 'ecs-web',
  'ecs-api': 'ecs-api',
  cloudwatch: 'cloudwatch',
  ecr: 'ecr',
  rds: 'rds',
  s3: 's3',
  github: 'github',
  gha: 'gha',
  anthropic: 'anthropic',
  mapbox: 'mapbox',
  places: 'places',
  unsplash: 'unsplash',
  aerodatabox: 'aerodatabox',
  gmail: 'gmail',
  sentry: 'sentry',
  'intake-maya': 'intake-maya',
  analyser: 'analyser',
  generator: 'generator',
  concierge: 'concierge',
}

function DetailModal({ nodeId, nodeData, onClose }: {
  nodeId: string
  nodeData: NodeData
  onClose: () => void
}) {
  const detailKey = NODE_DETAIL_KEY[nodeId]
  const detail = detailKey ? NODE_DETAILS[detailKey] : null
  const Icon = ICON_MAP[nodeData.icon]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f172a',
          border: `1px solid ${nodeData.color}30`,
          borderRadius: 18,
          padding: '32px 36px',
          maxWidth: 640,
          width: '100%',
          boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${nodeData.color}12`,
          position: 'relative',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '50%', width: 30, height: 30,
            cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `${nodeData.color}18`,
            border: `1.5px solid ${nodeData.color}35`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            {Icon && <Icon size={22} color={nodeData.color} strokeWidth={1.6} />}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#e2e8f0', lineHeight: 1.2 }}>{nodeData.label}</div>
            {nodeData.sublabel && (
              <div style={{ fontSize: 12, color: nodeData.color + 'bb', fontWeight: 600, marginTop: 2 }}>{nodeData.sublabel}</div>
            )}
          </div>
        </div>

        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* What is it */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: nodeData.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                What is this?
              </div>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.75, margin: 0 }}>
                {detail.whatIsIt}
              </p>
            </div>

            {/* What it does */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: nodeData.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                What does it do in Papaya?
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detail.whatItDoes.map((point, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: nodeData.color, flexShrink: 0,
                      marginTop: 7,
                    }} />
                    <span style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.65 }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Why this choice */}
            {detail.whyThisChoice && (
              <div style={{
                background: `${nodeData.color}0d`,
                border: `1px solid ${nodeData.color}20`,
                borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: nodeData.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  Why this choice?
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
                  {detail.whyThisChoice}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>Click any highlighted node on the diagram to see details.</p>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes as any)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<{ id: string; data: NodeData } | null>(null)

  function handleNodeClick(_: React.MouseEvent, node: any) {
    const key = NODE_DETAIL_KEY[node.id]
    if (key) {
      setSelectedNode(selectedNode?.id === node.id ? null : { id: node.id, data: node.data as NodeData })
    }
  }

  return (
    <Layout variant="public">
      <div style={{ background: '#0d1117', borderBottom: '1px solid #1e293b', padding: '24px 40px 18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#e2e8f0', marginBottom: 4, letterSpacing: '-0.3px' }}>
          System Architecture
        </h1>
        <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>
          How Papaya is built and deployed. Click any node to learn what it does and why it's there.
        </p>
      </div>

      <div style={{ width: '100%', height: 'calc(100vh - 120px)', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.3}
          maxZoom={2}
          style={{ background: '#0d1117' }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background color="#1e293b" gap={30} size={1} />
          <Controls
            showInteractive={false}
            style={{ borderRadius: '8px', border: '1px solid #1e293b', background: '#0f172a', boxShadow: 'none' }}
          />
          <MiniMap
            nodeColor={(n) => { const d = n.data as NodeData; return d?.color || '#1e293b' }}
            maskColor="rgba(13,17,23,0.8)"
            style={{ borderRadius: '8px', border: '1px solid #1e293b', background: '#0f172a' }}
          />
        </ReactFlow>

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 10,
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: '8px', padding: '8px 14px',
          display: 'flex', gap: 18,
          fontSize: '11px',
        }}>
          {[
            { color: AWS_COLOR,  label: 'AWS' },
            { color: MAYA_COLOR, label: 'AI Pipeline' },
            { color: EXT_COLOR,  label: 'External Services' },
            { color: CD_COLOR,   label: 'CI/CD' },
            { color: USER_COLOR, label: 'User' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
              <span style={{ color: '#475569', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail modal — centered overlay */}
      {selectedNode && (
        <DetailModal
          nodeId={selectedNode.id}
          nodeData={selectedNode.data}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </Layout>
  )
}
