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
  Zap, HardDrive, GitFork, GitBranch, Brain, Sparkles,
  Mail, Network, LucideIcon,
} from 'lucide-react'
import Layout from '../components/Layout'

// ─── Icon map ────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Globe, Scale, Monitor, Activity, Package, Database,
  Zap, HardDrive, GitFork, GitBranch, Brain, Sparkles,
  Mail, Network,
}

// ─── Node types ──────────────────────────────────────────────────────────────

interface NodeData {
  label: string
  sublabel?: string
  icon: string
  color: string
  detail?: string[]
  [key: string]: unknown
}

const HANDLE_STYLE = { opacity: 0, width: 6, height: 6, border: 'none' }

function ServiceNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  const Icon = ICON_MAP[d.icon]
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
      cursor: 'pointer',
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

// ─── Colors ───────────────────────────────────────────────────────────────────

const AWS_COLOR = '#f07332'
const EXT_COLOR = '#818cf8'
const CD_COLOR = '#34d399'
const USER_COLOR = '#38bdf8'

// ─── Nodes ───────────────────────────────────────────────────────────────────

const initialNodes = [
  // Groups
  { id: 'grp-aws', type: 'group', position: { x: 320, y: 50 }, style: { width: 760, height: 490 }, data: { label: 'AWS — us-east-1', color: AWS_COLOR, icon: '' } },
  { id: 'grp-cd',  type: 'group', position: { x: 320, y: 580 }, style: { width: 480, height: 150 }, data: { label: 'CI / CD Pipeline', color: CD_COLOR, icon: '' } },
  { id: 'grp-ext', type: 'group', position: { x: 1130, y: 50 }, style: { width: 210, height: 490 }, data: { label: 'External Services', color: EXT_COLOR, icon: '' } },

  // User
  { id: 'user', type: 'service', position: { x: 60, y: 240 }, data: { label: 'Browser', sublabel: 'Client / Admin', icon: 'Globe', color: USER_COLOR, detail: ['Accesses travel-papaya.com', 'HTTPS only'] } },

  // AWS nodes
  { id: 'dns',     type: 'service', position: { x: 355, y: 90  }, data: { label: 'DNS', sublabel: 'GoDaddy', icon: 'Network', color: AWS_COLOR, detail: ['www → ALB via CNAME', 'Root domain forwarding'] } },
  { id: 'alb',     type: 'service', position: { x: 555, y: 90  }, data: { label: 'Load Balancer', sublabel: 'ALB + ACM', icon: 'Scale', color: AWS_COLOR, detail: ['HTTPS on port 443', 'HTTP → HTTPS redirect', 'Free SSL via ACM', 'Routes by path prefix'] } },
  { id: 'ecs-web', type: 'service', position: { x: 775, y: 90  }, data: { label: 'Web Container', sublabel: 'React + Nginx · Fargate', icon: 'Monitor', color: AWS_COLOR, detail: ['React 18 + TypeScript', 'Vite build, served by Nginx', 'Lazy-loaded routes'] } },
  { id: 'ecs-api', type: 'service', position: { x: 775, y: 290 }, data: { label: 'API Container', sublabel: 'FastAPI · Fargate', icon: 'Zap', color: AWS_COLOR, detail: ['Python + FastAPI', 'SQLAlchemy ORM', 'Alembic migrations on startup', 'JWT auth (client + admin)'] } },
  { id: 'cloudwatch', type: 'service', position: { x: 555, y: 220 }, data: { label: 'CloudWatch', sublabel: 'Logs + Monitoring', icon: 'Activity', color: AWS_COLOR, detail: ['Container logs from ECS', 'Request counts + error rates', 'ECS CPU / memory', 'RDS metrics'] } },
  { id: 'ecr',     type: 'service', position: { x: 355, y: 290 }, data: { label: 'Container Registry', sublabel: 'ECR', icon: 'Package', color: AWS_COLOR, detail: ['Stores API + Web Docker images', 'linux/amd64 platform', 'ECS pulls on deploy'] } },
  { id: 'rds',     type: 'service', position: { x: 555, y: 370 }, data: { label: 'PostgreSQL', sublabel: 'RDS', icon: 'Database', color: AWS_COLOR, detail: ['Managed RDS instance', 'Private VPC — not public', 'Trips, clients, itineraries, messages'] } },
  { id: 's3',      type: 'service', position: { x: 355, y: 390 }, data: { label: 'Document Storage', sublabel: 'S3', icon: 'HardDrive', color: AWS_COLOR, detail: ['Private bucket', 'Trip documents (PDFs, images)', 'Presigned URLs for secure download'] } },

  // CD
  { id: 'github', type: 'service', position: { x: 355, y: 620 }, data: { label: 'GitHub', sublabel: 'Source control', icon: 'GitFork', color: CD_COLOR, detail: ['Push to main triggers deploy', 'Pre-commit hook blocks secrets'] } },
  { id: 'gha',    type: 'service', position: { x: 575, y: 620 }, data: { label: 'GitHub Actions', sublabel: 'CD pipeline', icon: 'GitBranch', color: CD_COLOR, detail: ['Builds linux/amd64 images', 'Pushes to ECR', 'Forces new ECS deployment', 'Waits for service stability'] } },

  // External
  { id: 'openai',    type: 'service', position: { x: 1150, y: 90  }, data: { label: 'OpenAI', sublabel: 'GPT-4o · Fallback', icon: 'Brain', color: EXT_COLOR, detail: ['Reads uploaded booking screenshots', 'Extracts flight & hotel details automatically', 'Retained as AI fallback if needed'] } },
  { id: 'anthropic', type: 'service', position: { x: 1150, y: 255 }, data: { label: 'Anthropic', sublabel: 'Claude Sonnet 4.6', icon: 'Sparkles', color: EXT_COLOR, detail: ['Itinerary generation', 'Ask Maya — client refinement chat', 'Intake conversational chat', 'Accommodation & flight suggestions'] } },
  { id: 'gmail',     type: 'service', position: { x: 1150, y: 420 }, data: { label: 'Gmail SMTP', sublabel: 'Transactional email', icon: 'Mail', color: EXT_COLOR, detail: ['Welcome + magic login emails', 'Itinerary ready notifications', 'Confirmation emails', 'Message thread notifications'] } },
]

// ─── Edges ───────────────────────────────────────────────────────────────────

const E = (color: string, width = 1.5) => ({ stroke: color, strokeWidth: width })

const initialEdges = [
  { id: 'e-user-dns',       source: 'user',    target: 'dns',     animated: true,  style: E(USER_COLOR), label: 'HTTPS' },
  { id: 'e-dns-alb',        source: 'dns',     target: 'alb',     style: E(AWS_COLOR) },
  { id: 'e-alb-web',        source: 'alb',     target: 'ecs-web', style: E(AWS_COLOR), label: '/*' },
  { id: 'e-alb-api',        source: 'alb',     target: 'ecs-api', style: E(AWS_COLOR), label: '/api/*' },
  { id: 'e-api-rds',        source: 'ecs-api', target: 'rds',     style: E(AWS_COLOR) },
  { id: 'e-api-s3',         source: 'ecs-api', target: 's3',      style: E(AWS_COLOR) },
  { id: 'e-ecr-api',        source: 'ecr',     target: 'ecs-api', style: E(AWS_COLOR), label: 'pulls image' },
  { id: 'e-web-cw',         source: 'ecs-web', target: 'cloudwatch', style: E('#334155'), label: 'logs', type: 'smoothstep' },
  { id: 'e-api-cw',         source: 'ecs-api', target: 'cloudwatch', style: E('#334155'), label: 'logs', type: 'smoothstep' },
  { id: 'e-gh-gha',         source: 'github',  target: 'gha',     animated: true,  style: E(CD_COLOR), label: 'push to main' },
  { id: 'e-gha-ecr',        source: 'gha',     target: 'ecr',     style: E(CD_COLOR), label: 'push image' },
  { id: 'e-gha-ecs',        source: 'gha',     target: 'ecs-api', style: E(CD_COLOR), label: 'force deploy' },
  { id: 'e-api-openai',     source: 'ecs-api', target: 'openai',    animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-anthropic',  source: 'ecs-api', target: 'anthropic', animated: true, style: E(EXT_COLOR) },
  { id: 'e-api-gmail',      source: 'ecs-api', target: 'gmail',     animated: true, style: E(EXT_COLOR) },
]

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: typeof initialNodes[0] | null; onClose: () => void }) {
  if (!node) return null
  const d = node.data as NodeData
  if (!d.detail) return null
  const Icon = ICON_MAP[d.icon]
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, zIndex: 10,
      background: '#0f172a',
      border: `1px solid ${d.color}40`,
      borderRadius: '12px',
      padding: '18px 20px',
      width: 240,
      boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 24px ${d.color}18`,
    }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#334155', fontSize: '16px', lineHeight: 1, padding: 0 }}>×</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '8px', background: `${d.color}18`, border: `1px solid ${d.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {Icon && <Icon size={15} color={d.color} strokeWidth={1.8} />}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{d.label}</div>
          {d.sublabel && <div style={{ fontSize: '10px', color: d.color + 'bb', fontWeight: 500 }}>{d.sublabel}</div>}
        </div>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
        {(d.detail as string[]).map((point, i) => (
          <li key={i} style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.7, marginBottom: 2 }}>{point}</li>
        ))}
      </ul>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes as any)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNode, setSelectedNode] = useState<typeof initialNodes[0] | null>(null)

  function handleNodeClick(_: React.MouseEvent, node: any) {
    const full = initialNodes.find(n => n.id === node.id)
    if (full && (full.data as NodeData).detail) {
      setSelectedNode(selectedNode?.id === node.id ? null : full)
    }
  }

  return (
    <Layout variant="public">
      <div style={{ background: '#0d1117', borderBottom: '1px solid #1e293b', padding: '24px 40px 18px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#e2e8f0', marginBottom: 4, letterSpacing: '-0.3px' }}>
          System Architecture
        </h1>
        <p style={{ color: '#334155', fontSize: '12px', margin: 0 }}>
          How Travel Papaya is built and deployed. Click any node to see details.
        </p>
      </div>

      <div style={{ width: '100%', height: 'calc(100vh - 200px)', position: 'relative' }}>
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
          fitViewOptions={{ padding: 0.12 }}
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

        <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />

        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 10,
          background: '#0f172a', border: '1px solid #1e293b',
          borderRadius: '8px', padding: '8px 14px',
          display: 'flex', gap: 18,
          fontSize: '11px',
        }}>
          {[
            { color: AWS_COLOR, label: 'AWS' },
            { color: EXT_COLOR, label: 'External Services' },
            { color: CD_COLOR,  label: 'CI/CD' },
            { color: USER_COLOR, label: 'User' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}` }} />
              <span style={{ color: '#475569', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
