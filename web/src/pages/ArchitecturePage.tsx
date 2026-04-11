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
import Layout from '../components/Layout'

// ─── Node types ──────────────────────────────────────────────────────────────

interface NodeData {
  label: string
  sublabel?: string
  icon: string
  color: string
  detail?: string[]
  [key: string]: unknown
}

function ServiceNode({ data, selected }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      background: selected ? '#1a2744' : '#111827',
      border: `1.5px solid ${selected ? d.color : d.color + '55'}`,
      borderRadius: '12px',
      padding: '14px 18px',
      minWidth: 160,
      boxShadow: selected
        ? `0 0 16px ${d.color}44, 0 0 0 1px ${d.color}33`
        : `0 2px 12px rgba(0,0,0,0.4)`,
      transition: 'all 0.15s',
      cursor: 'pointer',
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: d.color, border: 'none', width: 7, height: 7 }} />
      <Handle type="target" position={Position.Top} style={{ background: d.color, border: 'none', width: 7, height: 7 }} />
      <div style={{
        width: 38, height: 38, borderRadius: '9px',
        background: `${d.color}22`,
        border: `1px solid ${d.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '18px', margin: '0 auto 10px',
      }}>
        {d.icon}
      </div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{d.label}</div>
      {d.sublabel && (
        <div style={{ fontSize: '10px', color: d.color + 'cc', marginTop: 3, fontWeight: 600 }}>{d.sublabel}</div>
      )}
      <Handle type="source" position={Position.Right} style={{ background: d.color, border: 'none', width: 7, height: 7 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: d.color, border: 'none', width: 7, height: 7 }} />
    </div>
  )
}

function GroupNode({ data }: NodeProps) {
  const d = data as NodeData
  return (
    <div style={{
      border: `1px solid ${d.color}33`,
      borderRadius: '16px',
      background: `${d.color}08`,
      width: '100%',
      height: '100%',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: -13, left: 16,
        background: '#0d1117',
        border: `1px solid ${d.color}44`,
        color: d.color,
        fontSize: '10px', fontWeight: 800,
        padding: '2px 10px',
        borderRadius: '100px',
        letterSpacing: '1px',
        textTransform: 'uppercase',
      }}>
        {d.label}
      </div>
    </div>
  )
}

const nodeTypes = { service: ServiceNode, group: GroupNode }

// ─── Initial nodes ────────────────────────────────────────────────────────────

const AWS_COLOR = '#f07332'
const EXT_COLOR = '#6366f1'
const CD_COLOR = '#10b981'
const USER_COLOR = '#2d4a5a'

const initialNodes = [
  // Groups
  {
    id: 'grp-aws',
    type: 'group',
    position: { x: 320, y: 60 },
    style: { width: 740, height: 500 },
    data: { label: 'AWS — us-east-1', color: AWS_COLOR, icon: '' },
  },
  {
    id: 'grp-cd',
    type: 'group',
    position: { x: 320, y: 600 },
    style: { width: 480, height: 160 },
    data: { label: 'CI / CD Pipeline', color: CD_COLOR, icon: '' },
  },
  {
    id: 'grp-ext',
    type: 'group',
    position: { x: 1110, y: 60 },
    style: { width: 220, height: 500 },
    data: { label: 'External Services', color: EXT_COLOR, icon: '' },
  },

  // User
  {
    id: 'user',
    type: 'service',
    position: { x: 60, y: 260 },
    data: {
      label: 'Browser',
      sublabel: 'Client / Admin',
      icon: '🌐',
      color: USER_COLOR,
      detail: ['Accesses travel-papaya.com', 'HTTPS only'],
    },
  },

  // DNS
  {
    id: 'dns',
    type: 'service',
    position: { x: 360, y: 100 },
    data: {
      label: 'DNS',
      sublabel: 'GoDaddy',
      icon: '🌍',
      color: AWS_COLOR,
      detail: ['www → ALB via CNAME', 'Root domain forwarding'],
    },
  },

  // ALB
  {
    id: 'alb',
    type: 'service',
    position: { x: 560, y: 100 },
    data: {
      label: 'Load Balancer',
      sublabel: 'ALB + ACM (HTTPS)',
      icon: '⚖️',
      color: AWS_COLOR,
      detail: ['Port 443 — HTTPS', 'HTTP → HTTPS redirect', 'Free SSL via ACM', 'Routes by path prefix'],
    },
  },

  // ECS Web
  {
    id: 'ecs-web',
    type: 'service',
    position: { x: 780, y: 100 },
    data: {
      label: 'Web Container',
      sublabel: 'React + Nginx · ECS Fargate',
      icon: '🖥️',
      color: AWS_COLOR,
      detail: ['React 18 + TypeScript', 'Vite build, served by Nginx', 'Port 80 inside container', 'Lazy-loaded routes'],
    },
  },

  // ECS API
  {
    id: 'ecs-api',
    type: 'service',
    position: { x: 780, y: 310 },
    data: {
      label: 'API Container',
      sublabel: 'FastAPI · ECS Fargate',
      icon: '⚡',
      color: AWS_COLOR,
      detail: ['Python + FastAPI', 'SQLAlchemy ORM', 'Alembic migrations on startup', 'JWT auth (client + admin)', 'Port 8000 inside container'],
    },
  },

  // RDS
  {
    id: 'rds',
    type: 'service',
    position: { x: 560, y: 380 },
    data: {
      label: 'PostgreSQL',
      sublabel: 'RDS',
      icon: '🗄️',
      color: AWS_COLOR,
      detail: ['Managed RDS instance', 'Private VPC — not public', 'Trips, clients, itineraries, messages'],
    },
  },

  // S3
  {
    id: 's3',
    type: 'service',
    position: { x: 780, y: 480 },
    data: {
      label: 'Document Storage',
      sublabel: 'S3',
      icon: '📦',
      color: AWS_COLOR,
      detail: ['Private bucket', 'Trip documents (PDFs, images)', 'Presigned URLs for secure download'],
    },
  },

  // CloudWatch
  {
    id: 'cloudwatch',
    type: 'service',
    position: { x: 560, y: 240 },
    data: {
      label: 'CloudWatch',
      sublabel: 'Logs + Monitoring',
      icon: '📊',
      color: AWS_COLOR,
      detail: ['Container logs from ECS tasks', 'Request counts + error rates', 'ECS CPU / memory metrics', 'RDS performance metrics'],
    },
  },

  // ECR
  {
    id: 'ecr',
    type: 'service',
    position: { x: 360, y: 310 },
    data: {
      label: 'Container Registry',
      sublabel: 'ECR',
      icon: '📋',
      color: AWS_COLOR,
      detail: ['Stores API + Web Docker images', 'linux/amd64 platform', 'ECS pulls latest on deploy'],
    },
  },

  // CD nodes
  {
    id: 'github',
    type: 'service',
    position: { x: 360, y: 650 },
    data: {
      label: 'GitHub',
      sublabel: 'Source control',
      icon: '🐙',
      color: CD_COLOR,
      detail: ['Push to main triggers deploy', 'Pre-commit hook blocks secrets'],
    },
  },
  {
    id: 'gha',
    type: 'service',
    position: { x: 580, y: 650 },
    data: {
      label: 'GitHub Actions',
      sublabel: 'CD pipeline',
      icon: '⚙️',
      color: CD_COLOR,
      detail: ['Builds linux/amd64 images', 'Pushes to ECR', 'Forces new ECS deployment', 'Waits for service stability'],
    },
  },

  // External services
  {
    id: 'openai',
    type: 'service',
    position: { x: 1150, y: 100 },
    data: {
      label: 'OpenAI',
      sublabel: 'GPT-4o · Fallback',
      icon: '🤖',
      color: EXT_COLOR,
      detail: ['Reads uploaded booking screenshots', 'Extracts flight & hotel details automatically', 'Retained as AI fallback if needed'],
    },
  },
  {
    id: 'anthropic',
    type: 'service',
    position: { x: 1150, y: 270 },
    data: {
      label: 'Anthropic',
      sublabel: 'Claude Sonnet 4.6',
      icon: '✨',
      color: EXT_COLOR,
      detail: ['Itinerary generation', 'Ask Maya — client refinement chat', 'Intake conversational chat', 'Accommodation & flight suggestions'],
    },
  },
  {
    id: 'gmail',
    type: 'service',
    position: { x: 1150, y: 430 },
    data: {
      label: 'Gmail SMTP',
      sublabel: 'Transactional email',
      icon: '📧',
      color: EXT_COLOR,
      detail: ['Welcome + magic login emails', 'Itinerary review notifications', 'Confirmation emails', 'Message thread notifications'],
    },
  },
]

// ─── Initial edges ────────────────────────────────────────────────────────────

const edgeStyle = (color: string) => ({
  stroke: color,
  strokeWidth: 2,
})

const initialEdges = [
  // User → DNS → ALB → services
  { id: 'e-user-dns', source: 'user', target: 'dns', animated: true, style: edgeStyle(USER_COLOR), label: 'HTTPS' },
  { id: 'e-dns-alb', source: 'dns', target: 'alb', style: edgeStyle(AWS_COLOR) },
  { id: 'e-alb-web', source: 'alb', target: 'ecs-web', style: edgeStyle(AWS_COLOR), label: '/*' },
  { id: 'e-alb-api', source: 'alb', target: 'ecs-api', style: edgeStyle(AWS_COLOR), label: '/api/*' },

  // API → data
  { id: 'e-api-rds', source: 'ecs-api', target: 'rds', style: edgeStyle(AWS_COLOR) },
  { id: 'e-api-s3', source: 'ecs-api', target: 's3', style: edgeStyle(AWS_COLOR) },
  { id: 'e-api-ecr', source: 'ecr', target: 'ecs-api', style: edgeStyle(AWS_COLOR), label: 'pulls image' },

  // Logs
  { id: 'e-web-cw', source: 'ecs-web', target: 'cloudwatch', style: edgeStyle('#94a3b8'), label: 'logs', type: 'smoothstep' },
  { id: 'e-api-cw', source: 'ecs-api', target: 'cloudwatch', style: edgeStyle('#94a3b8'), label: 'logs', type: 'smoothstep' },

  // CD pipeline
  { id: 'e-gh-gha', source: 'github', target: 'gha', animated: true, style: edgeStyle(CD_COLOR), label: 'push to main' },
  { id: 'e-gha-ecr', source: 'gha', target: 'ecr', style: edgeStyle(CD_COLOR), label: 'push image' },
  { id: 'e-gha-ecs', source: 'gha', target: 'ecs-api', style: edgeStyle(CD_COLOR), label: 'force deploy' },

  // External services
  { id: 'e-api-openai', source: 'ecs-api', target: 'openai', animated: true, style: edgeStyle(EXT_COLOR) },
  { id: 'e-api-anthropic', source: 'ecs-api', target: 'anthropic', animated: true, style: edgeStyle(EXT_COLOR) },
  { id: 'e-api-gmail', source: 'ecs-api', target: 'gmail', animated: true, style: edgeStyle(EXT_COLOR) },
]

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: typeof initialNodes[0] | null; onClose: () => void }) {
  if (!node) return null
  const d = node.data as NodeData
  if (!d.detail) return null
  return (
    <div style={{
      position: 'absolute', top: 80, right: 24, zIndex: 10,
      background: '#111827',
      border: `1.5px solid ${d.color}55`,
      borderRadius: '16px',
      padding: '20px 24px',
      width: 260,
      boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 20px ${d.color}22`,
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#4a6072', fontSize: '18px', lineHeight: 1, padding: '0 4px',
        }}
      >×</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '9px',
          background: `${d.color}22`, border: `1px solid ${d.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px',
        }}>
          {d.icon}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{d.label}</div>
          {d.sublabel && <div style={{ fontSize: '10px', color: d.color + 'cc', fontWeight: 600 }}>{d.sublabel}</div>}
        </div>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }}>
        {(d.detail as string[]).map((point, i) => (
          <li key={i} style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.7, marginBottom: 3 }}>
            {point}
          </li>
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
      <div style={{ background: '#0d1117', borderBottom: '1px solid #1e2d3d', padding: '28px 40px 20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#e2e8f0', marginBottom: 6, letterSpacing: '-0.3px' }}>
          System Architecture
        </h1>
        <p style={{ color: '#4a6072', fontSize: '13px', margin: 0 }}>
          How Travel Papaya is built and deployed. Click any node to see details.
        </p>
      </div>

      <div style={{ width: '100%', height: 'calc(100vh - 210px)', position: 'relative' }}>
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
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          style={{ background: '#0d1117' }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background color="#1e2d3d" gap={28} size={1} />
          <Controls
            showInteractive={false}
            style={{
              boxShadow: 'none', borderRadius: '10px',
              border: '1px solid #1e2d3d', background: '#111827',
            }}
          />
          <MiniMap
            nodeColor={(n) => {
              const d = n.data as NodeData
              return d?.color || '#1e2d3d'
            }}
            maskColor="rgba(13,17,23,0.75)"
            style={{ borderRadius: '10px', border: '1px solid #1e2d3d', background: '#111827' }}
          />
        </ReactFlow>

        <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 24, zIndex: 10,
          background: '#111827', border: '1px solid #1e2d3d',
          borderRadius: '12px', padding: '10px 16px',
          display: 'flex', gap: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          fontSize: '11px',
        }}>
          {[
            { color: AWS_COLOR, label: 'AWS Infrastructure' },
            { color: EXT_COLOR, label: 'External Services' },
            { color: CD_COLOR, label: 'CI/CD Pipeline' },
            { color: USER_COLOR, label: 'Client / User' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ color: '#64748b', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
