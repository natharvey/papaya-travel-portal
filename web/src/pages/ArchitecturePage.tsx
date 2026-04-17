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
} from 'lucide-react'
import Layout from '../components/Layout'

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Globe, Scale, Monitor, Activity, Package, Database,
  Zap, HardDrive, GitFork, GitBranch, Sparkles,
  Mail, Network, Map, Search, AlertCircle,
}

// ─── Node detail data ─────────────────────────────────────────────────────────

interface NodeDetail {
  whatIsIt: string
  whatItDoes: string[]
  whyThisChoice?: string
}

const NODE_DETAILS: Record<string, NodeDetail> = {
  user: {
    whatIsIt: "This represents anyone using the Papaya platform — either a client booking a trip, or you as the admin managing trips. They access the system through a regular web browser on any device.",
    whatItDoes: [
      "Clients log in via a magic link emailed to them (no password required)",
      "Admins log in with a password at /admin/login",
      "All traffic is encrypted — the browser only ever communicates over HTTPS (the padlock icon in your URL bar)",
      "The browser downloads the React app once and then talks to the API for all data",
    ],
    whyThisChoice: "Magic link login means clients never need to remember a password — they just click a link in their email. This reduces friction for people who may only log in once or twice.",
  },
  dns: {
    whatIsIt: "DNS (Domain Name System) is like a phonebook for the internet. When someone types travel-papaya.com into their browser, DNS translates that human-readable name into a numeric address the internet can route to.",
    whatItDoes: [
      "travel-papaya.com and www.travel-papaya.com both point to the AWS load balancer",
      "The DNS records are managed through GoDaddy, where the domain was purchased",
      "Uses a CNAME record — a type of DNS record that points one name to another name (rather than a specific IP address)",
    ],
    whyThisChoice: "GoDaddy is where the domain was originally registered. In the future, this could be migrated to AWS Route 53 for tighter integration, but GoDaddy works fine as-is.",
  },
  alb: {
    whatIsIt: "A load balancer sits between the internet and your servers, acting as a traffic director. It receives all incoming requests and decides where to send them. ACM (AWS Certificate Manager) handles the SSL certificate — the technology that makes HTTPS work.",
    whatItDoes: [
      "Receives all traffic on port 443 (HTTPS) and automatically redirects any plain HTTP requests to HTTPS",
      "Routes requests starting with /api/ to the API container (FastAPI), and everything else to the web container (React/Nginx)",
      "The SSL certificate is free and auto-renews — AWS manages it so you never get a surprise expired certificate",
      "If you ever scaled to multiple servers, the load balancer would split traffic between them automatically",
    ],
    whyThisChoice: "AWS ALB is the standard choice for ECS-based applications. It integrates natively with Fargate and ACM, making SSL certificates completely automated.",
  },
  'ecs-web': {
    whatIsIt: "A container running your React front-end application. A container is like a lightweight, self-contained box that includes everything needed to run the app — the code, the web server, all dependencies. Fargate means AWS manages the underlying server hardware — you never SSH into a machine or patch an OS.",
    whatItDoes: [
      "Serves the React application (the actual website your clients see) using Nginx — a fast, lightweight web server",
      "The React app was built with Vite (a modern build tool) and compiled to plain HTML, CSS, and JavaScript files",
      "Handles client-side routing — when you click between pages, the browser doesn't reload, it just swaps React components",
      "All the map visualisations (Mapbox), date pickers, chat interface, and itinerary timeline run here in the browser",
    ],
    whyThisChoice: "React + TypeScript gives a fast, interactive experience without full page reloads. Nginx is extremely efficient at serving static files. Fargate eliminates server management entirely.",
  },
  'ecs-api': {
    whatIsIt: "The brain of the operation. This container runs the Python backend — all the business logic, AI calls, database operations, and email sending happen here. FastAPI is a modern Python web framework known for being fast and having automatic API documentation.",
    whatItDoes: [
      "Handles all authentication — issues JWT tokens (secure, tamper-proof login tickets) to clients and admins",
      "Manages the full trip lifecycle: intake → review → itinerary generation → client confirmation",
      "Makes calls to Anthropic's Claude AI for all AI features (itinerary generation, Maya chat, suggestions)",
      "Reads and writes all data to the PostgreSQL database using SQLAlchemy (a database toolkit for Python)",
      "Runs database migrations automatically on startup using Alembic — so when the code changes the database structure, it updates itself",
      "Handles document uploads/downloads through S3, and sends all transactional emails",
    ],
    whyThisChoice: "FastAPI is extremely fast for a Python framework, has automatic input validation, and generates API documentation automatically. Python was chosen because the best AI libraries (Anthropic SDK) are Python-first.",
  },
  cloudwatch: {
    whatIsIt: "AWS CloudWatch is Amazon's built-in monitoring and logging service. Every time your containers print something to the console (errors, info messages, requests), CloudWatch captures and stores it.",
    whatItDoes: [
      "Stores all logs from both containers — you can search through them to debug issues",
      "Captures every API request: what was called, how long it took, whether it succeeded",
      "Monitors container health: CPU usage, memory usage, crash counts",
      "Can trigger alerts if something goes wrong (e.g. if the API starts throwing lots of errors)",
    ],
    whyThisChoice: "CloudWatch comes built into AWS — no extra setup required when you're already using ECS. It's the first place to look when something breaks.",
  },
  ecr: {
    whatIsIt: "ECR (Elastic Container Registry) is AWS's private Docker image storage. A Docker image is like a blueprint or snapshot of your application — it contains the code, runtime, and everything needed to run the app. ECR stores these images so ECS can pull them when deploying.",
    whatItDoes: [
      "Stores two images: papaya-api (the Python backend) and papaya-web (the React frontend + Nginx)",
      "When you or GitHub Actions runs a deploy, new images are built and pushed here",
      "ECS pulls the latest image from ECR whenever it starts a new container",
      "Images are built for linux/amd64 architecture — the platform AWS Fargate runs on",
    ],
    whyThisChoice: "ECR is the natural companion to ECS — they're both AWS services and integrate seamlessly. Images stay private inside your AWS account.",
  },
  rds: {
    whatIsIt: "RDS (Relational Database Service) is AWS's managed PostgreSQL database. PostgreSQL is a powerful, open-source relational database — think of it as a very sophisticated, organised filing system for all your application data.",
    whatItDoes: [
      "Stores every piece of data: clients, trips, itineraries, messages, flights, stays, hotel suggestions, documents",
      "Lives inside a private VPC (Virtual Private Cloud) — it's not accessible from the internet, only from inside AWS",
      "AWS manages backups, patches, and failover automatically — you don't need to maintain the database server",
      "The database schema (structure) is managed by Alembic, which runs migrations automatically when the API starts",
    ],
    whyThisChoice: "PostgreSQL is the industry standard for applications needing reliable, structured data. RDS means you get all the power of PostgreSQL without managing the server — AWS handles uptime, backups, and security patches.",
  },
  s3: {
    whatIsIt: "S3 (Simple Storage Service) is AWS's cloud file storage. It's designed to store any type of file — PDFs, images, spreadsheets — reliably and cheaply, at any scale.",
    whatItDoes: [
      "Stores documents that admins or clients upload to trips (e.g. booking confirmations, passports, travel insurance)",
      "Stores booking screenshots that admins upload for AI parsing (flight and hotel confirmation emails)",
      "Files are private — clients access them via 'presigned URLs', which are temporary, expiring links generated by the API",
      "Never stores files in the database — the database just stores a reference (key) to where the file lives in S3",
    ],
    whyThisChoice: "S3 is extremely cheap, infinitely scalable, and purpose-built for file storage. Storing files in a database would be slow and expensive.",
  },
  github: {
    whatIsIt: "GitHub is where the entire codebase lives — every line of code for the website, API, and infrastructure. It provides version control (Git), meaning every change is tracked, can be reviewed, and can be reversed if something breaks.",
    whatItDoes: [
      "Stores the complete source code: /web (React frontend), /api (Python backend), /deploy.sh, task definitions",
      "Every commit is a saved snapshot of the code at a point in time — you can always go back",
      "Pushing to the main branch automatically triggers the GitHub Actions deployment pipeline",
      "Acts as the single source of truth — what's in main is what's running in production",
    ],
  },
  gha: {
    whatIsIt: "GitHub Actions is an automation platform built into GitHub. It runs workflows — sequences of steps — automatically in response to events like pushing code. In Papaya's case, pushing to main automatically builds and deploys the entire application.",
    whatItDoes: [
      "Triggered automatically whenever code is pushed to the main branch",
      "Builds Docker images for both the API and web containers (compiled for linux/amd64)",
      "Pushes those images to ECR (the image registry)",
      "Forces ECS to start new containers using the fresh images",
      "Waits until the new containers are healthy before considering the deployment done",
      "Bakes in environment variables like the Mapbox token and Sentry DSN at build time",
    ],
    whyThisChoice: "GitHub Actions is free for public repos and very affordable for private ones. Since the code is already on GitHub, it's the natural place to run automation — no extra services needed.",
  },
  anthropic: {
    whatIsIt: "Anthropic is the AI company that makes Claude — the large language model (LLM) powering all of Papaya's AI features. Claude Sonnet 4.6 is the specific model version being used. A large language model is an AI system trained on vast amounts of text that can understand and generate human-like text.",
    whatItDoes: [
      "Generates complete multi-day itineraries from a client's profile — day-by-day plans with morning, afternoon, and evening activities, including geocoordinates for the map",
      "Powers the Maya intake chat — the conversational interview where Maya asks questions to understand what the client wants",
      "Powers Ask Maya — the sidebar chat where clients can refine their itinerary after it's generated",
      "Generates accommodation suggestions — contextual hotel recommendations per destination based on the trip profile",
      "Generates flight route suggestions — realistic flight options with pricing and booking tips",
      "Analyses intake conversations to extract a structured client profile for use in generation",
    ],
    whyThisChoice: "Claude is widely regarded as the best model for long-form, nuanced writing — which is exactly what a well-crafted itinerary requires. Anthropic's API is reliable, fast, and has a generous context window (how much text it can process at once).",
  },
  gmail: {
    whatIsIt: "Gmail SMTP is Google's email sending service. SMTP (Simple Mail Transfer Protocol) is the technical standard for sending emails across the internet. By using Gmail's servers, Papaya can send emails reliably without running its own email infrastructure.",
    whatItDoes: [
      "Sends magic login links — when a client requests to log in, they receive an email with a secure, one-time link",
      "Sends welcome emails when a new client is registered in the system",
      "Notifies clients when their itinerary is ready to view",
      "Sends confirmation emails when a trip is confirmed",
      "Notifies the advisor when a client sends a message in the portal",
    ],
    whyThisChoice: "Gmail SMTP is simple to set up and highly deliverable — emails sent via Gmail are unlikely to land in spam. For a small-scale operation, it's a pragmatic choice that can be swapped for a dedicated service (like SendGrid or Postmark) if volume grows.",
  },
  mapbox: {
    whatIsIt: "Mapbox is a mapping platform — think Google Maps but for developers. It provides interactive maps, geocoding (converting place names to coordinates), routing (calculating directions between places), and map tile rendering.",
    whatItDoes: [
      "Renders the interactive trip map on every client's trip detail page",
      "Geocodes destination names and activity locations — converts 'Fushimi Inari Shrine, Kyoto' into the exact latitude/longitude coordinates needed to place a pin",
      "Draws flight arcs between cities on the map — the curved dotted lines showing the journey",
      "Calculates walking and driving routes between a client's hotel and their daily activities",
      "Renders the destination markers, activity dot icons, and hotel pins on the map",
    ],
    whyThisChoice: "Mapbox has better customisation than Google Maps for building branded, interactive experiences. The free tier is generous enough for a boutique travel operation, and the SDK integrates cleanly with React.",
  },
  places: {
    whatIsIt: "Google Places API is part of Google Maps Platform. It gives access to Google's enormous database of businesses and locations worldwide — names, addresses, photos, ratings, opening hours, and more.",
    whatItDoes: [
      "Verifies hotel suggestions generated by Claude — after the AI suggests hotels, the API checks they actually exist in Google's database",
      "Fetches real photos for hotel cards in the accommodation tab — the photos you see on hotel suggestion cards come from Google",
      "Retrieves ratings, website URLs, and addresses for hotels to display alongside AI-generated descriptions",
      "Geocodes itinerary activity locations to get precise coordinates for the map markers",
    ],
    whyThisChoice: "Google has the most comprehensive and accurate business database in the world. It's the best way to verify AI-generated hotel suggestions are real and get high-quality photos without building a scraper.",
  },
  sentry: {
    whatIsIt: "Sentry is an error tracking and monitoring platform. When something goes wrong in the browser — a JavaScript crash, an unhandled error, a failed API call — Sentry captures it automatically and sends an alert. It runs invisibly in the background on the front-end.",
    whatItDoes: [
      "Catches JavaScript errors in the browser that users experience, even if they don't report them",
      "Records the exact file, line number, and sequence of actions that led to the error",
      "Tracks error frequency — so you know if one person hit a bug once, or if 50 people are hitting the same bug every day",
      "Groups similar errors together so you're not flooded with duplicates",
      "Only active in production — errors during local development are not sent to Sentry",
    ],
    whyThisChoice: "Sentry is the industry standard for front-end error tracking. The free tier is more than sufficient for Papaya's current scale. Without it, you'd only know about errors when clients report them — which most won't.",
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

function ServiceNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  const Icon = ICON_MAP[d.icon]
  const hasDetail = !!NODE_DETAILS[d.icon?.toLowerCase() ?? '']
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

// ─── Nodes ─────────────────────────────────────────────────────────────────────

const initialNodes = [
  // Groups
  { id: 'grp-aws', type: 'group', position: { x: 320, y: 30  }, style: { width: 780, height: 520 }, data: { label: 'AWS — us-east-1', color: AWS_COLOR, icon: '' } },
  { id: 'grp-cd',  type: 'group', position: { x: 320, y: 600 }, style: { width: 480, height: 150 }, data: { label: 'CI / CD Pipeline', color: CD_COLOR, icon: '' } },
  { id: 'grp-ext', type: 'group', position: { x: 1160, y: 30 }, style: { width: 220, height: 740 }, data: { label: 'External Services', color: EXT_COLOR, icon: '' } },

  // User
  { id: 'user', type: 'service', position: { x: 60, y: 250 }, data: { label: 'Browser', sublabel: 'Client / Admin', icon: 'Globe', color: USER_COLOR } },

  // AWS nodes
  { id: 'dns',        type: 'service', position: { x: 360, y: 70  }, data: { label: 'DNS', sublabel: 'GoDaddy', icon: 'Network', color: AWS_COLOR } },
  { id: 'alb',        type: 'service', position: { x: 565, y: 70  }, data: { label: 'Load Balancer', sublabel: 'ALB + ACM', icon: 'Scale', color: AWS_COLOR } },
  { id: 'ecs-web',    type: 'service', position: { x: 790, y: 70  }, data: { label: 'Web Container', sublabel: 'React + Nginx · Fargate', icon: 'Monitor', color: AWS_COLOR } },
  { id: 'ecs-api',    type: 'service', position: { x: 790, y: 300 }, data: { label: 'API Container', sublabel: 'FastAPI · Fargate', icon: 'Zap', color: AWS_COLOR } },
  { id: 'cloudwatch', type: 'service', position: { x: 565, y: 220 }, data: { label: 'CloudWatch', sublabel: 'Logs + Monitoring', icon: 'Activity', color: AWS_COLOR } },
  { id: 'ecr',        type: 'service', position: { x: 360, y: 300 }, data: { label: 'Container Registry', sublabel: 'ECR', icon: 'Package', color: AWS_COLOR } },
  { id: 'rds',        type: 'service', position: { x: 565, y: 390 }, data: { label: 'PostgreSQL', sublabel: 'RDS', icon: 'Database', color: AWS_COLOR } },
  { id: 's3',         type: 'service', position: { x: 360, y: 410 }, data: { label: 'Document Storage', sublabel: 'S3', icon: 'HardDrive', color: AWS_COLOR } },

  // CD
  { id: 'github', type: 'service', position: { x: 360, y: 640 }, data: { label: 'GitHub', sublabel: 'Source control', icon: 'GitFork', color: CD_COLOR } },
  { id: 'gha',    type: 'service', position: { x: 575, y: 640 }, data: { label: 'GitHub Actions', sublabel: 'CD pipeline', icon: 'GitBranch', color: CD_COLOR } },

  // External
  { id: 'anthropic', type: 'service', position: { x: 1180, y: 70  }, data: { label: 'Anthropic', sublabel: 'Claude Sonnet 4.6', icon: 'Sparkles', color: EXT_COLOR } },
  { id: 'mapbox',    type: 'service', position: { x: 1180, y: 240 }, data: { label: 'Mapbox', sublabel: 'Maps + Geocoding', icon: 'Map', color: EXT_COLOR } },
  { id: 'places',    type: 'service', position: { x: 1180, y: 410 }, data: { label: 'Google Places', sublabel: 'Hotel verification + photos', icon: 'Search', color: EXT_COLOR } },
  { id: 'gmail',     type: 'service', position: { x: 1180, y: 580 }, data: { label: 'Gmail SMTP', sublabel: 'Transactional email', icon: 'Mail', color: EXT_COLOR } },
  { id: 'sentry',    type: 'service', position: { x: 1180, y: 660 }, data: { label: 'Sentry', sublabel: 'Error tracking', icon: 'AlertCircle', color: EXT_COLOR } },
]

// ─── Edges ─────────────────────────────────────────────────────────────────────

const E = (color: string, width = 1.5) => ({ stroke: color, strokeWidth: width })

const initialEdges = [
  { id: 'e-user-dns',      source: 'user',    target: 'dns',        animated: true,  style: E(USER_COLOR), label: 'HTTPS' },
  { id: 'e-dns-alb',       source: 'dns',     target: 'alb',        style: E(AWS_COLOR) },
  { id: 'e-alb-web',       source: 'alb',     target: 'ecs-web',    style: E(AWS_COLOR), label: '/*' },
  { id: 'e-alb-api',       source: 'alb',     target: 'ecs-api',    style: E(AWS_COLOR), label: '/api/*' },
  { id: 'e-api-rds',       source: 'ecs-api', target: 'rds',        style: E(AWS_COLOR) },
  { id: 'e-api-s3',        source: 'ecs-api', target: 's3',         style: E(AWS_COLOR) },
  { id: 'e-ecr-api',       source: 'ecr',     target: 'ecs-api',    style: E(AWS_COLOR), label: 'pulls image' },
  { id: 'e-ecr-web',       source: 'ecr',     target: 'ecs-web',    style: E(AWS_COLOR) },
  { id: 'e-web-cw',        source: 'ecs-web', target: 'cloudwatch', style: E('#334155'), label: 'logs', type: 'smoothstep' },
  { id: 'e-api-cw',        source: 'ecs-api', target: 'cloudwatch', style: E('#334155'), label: 'logs', type: 'smoothstep' },
  { id: 'e-gh-gha',        source: 'github',  target: 'gha',        animated: true, style: E(CD_COLOR), label: 'push to main' },
  { id: 'e-gha-ecr',       source: 'gha',     target: 'ecr',        style: E(CD_COLOR), label: 'push image' },
  { id: 'e-gha-ecs',       source: 'gha',     target: 'ecs-api',    style: E(CD_COLOR), label: 'force deploy' },
  { id: 'e-api-anthropic', source: 'ecs-api', target: 'anthropic',  animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-mapbox',    source: 'ecs-api', target: 'mapbox',     animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-places',    source: 'ecs-api', target: 'places',     animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-gmail',     source: 'ecs-api', target: 'gmail',      animated: true, style: E(EXT_COLOR) },
  { id: 'e-web-sentry',    source: 'ecs-web', target: 'sentry',     style: E('#334155'), type: 'smoothstep' },
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
  gmail: 'gmail',
  sentry: 'sentry',
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
          nodesDraggable={false}
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
