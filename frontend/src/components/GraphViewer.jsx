import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Search, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  Maximize2, 
  Sparkles,
  Info,
  Filter
} from 'lucide-react';
import { COMMUNITY_COLORS, getCommunityColor } from '../utils/colors';

export default function GraphViewer({
  graphData,
  selectedNode,
  onNodeClick,
  is3D = false,
  onOpenIngest,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const graph3DInstanceRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCommunityFilter, setActiveCommunityFilter] = useState(null); // null means all
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  // Unique communities sorted
  const communities = useMemo(() => {
    const set = new Set();
    nodes.forEach((n) => {
      if (n.group !== undefined && n.group !== null) set.add(n.group);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [nodes]);

  // Filtered nodes based on search and active community
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchSearch =
        !searchTerm ||
        n.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (n.type && n.type.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchComm =
        activeCommunityFilter === null || n.group === activeCommunityFilter;
      return matchSearch && matchComm;
    });
  }, [nodes, searchTerm, activeCommunityFilter]);

  // ----------------------------------------------------------------------
  // 3D GRAPH MODE (ForceGraph3D)
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!is3D || !containerRef.current) return;

    if (typeof window.ForceGraph3D !== 'function') {
      console.warn('3D Force Graph library not loaded, falling back to 2D view.');
      return;
    }

    // Clean up container
    containerRef.current.innerHTML = '';

    const fg = window.ForceGraph3D()(containerRef.current)
      .backgroundColor('#07090e')
      .graphData({ nodes: [...nodes], links: [...links] })
      .nodeLabel((n) => `${n.id} (${n.type || 'Entity'})\nCommunity: ${n.group}`)
      .nodeColor((n) => {
        if (selectedNode && selectedNode.id === n.id) return '#ffffff';
        if (searchTerm && !n.id.toLowerCase().includes(searchTerm.toLowerCase())) {
          return 'rgba(255,255,255,0.08)';
        }
        if (activeCommunityFilter !== null && n.group !== activeCommunityFilter) {
          return 'rgba(255,255,255,0.08)';
        }
        return getCommunityColor(n.group);
      })
      .nodeRelSize(5)
      .linkLabel((l) => l.label || 'RELATED_TO')
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.2)
      .linkDirectionalParticleSpeed(0.006)
      .linkColor(() => 'rgba(255,255,255,0.18)')
      .onNodeClick((node) => {
        onNodeClick(node);
        // Camera fly to node
        const distance = 50;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        fg.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          1200
        );
      });

    graph3DInstanceRef.current = fg;

    const handleResize = () => {
      if (fg && containerRef.current) {
        fg.width(containerRef.current.clientWidth);
        fg.height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (containerRef.current) containerRef.current.innerHTML = '';
      graph3DInstanceRef.current = null;
    };
  }, [is3D, nodes, links]);

  // Update 3D colors when filters change
  useEffect(() => {
    if (is3D && graph3DInstanceRef.current) {
      graph3DInstanceRef.current.nodeColor((n) => {
        if (selectedNode && selectedNode.id === n.id) return '#ffffff';
        if (searchTerm && !n.id.toLowerCase().includes(searchTerm.toLowerCase())) {
          return 'rgba(255,255,255,0.08)';
        }
        if (activeCommunityFilter !== null && n.group !== activeCommunityFilter) {
          return 'rgba(255,255,255,0.08)';
        }
        return getCommunityColor(n.group);
      });
    }
  }, [is3D, searchTerm, activeCommunityFilter, selectedNode]);

  // ----------------------------------------------------------------------
  // 2D CANVAS FORCE-DIRECTED GRAPH ENGINE
  // ----------------------------------------------------------------------
  const simulationRef = useRef({
    positions: new Map(),
    velocities: new Map(),
    pan: { x: 0, y: 0 },
    zoom: 1,
    isDragging: false,
    dragNode: null,
    lastMouse: { x: 0, y: 0 },
  });

  // Initialize or update 2D layout positions
  useEffect(() => {
    if (is3D || nodes.length === 0) return;

    const sim = simulationRef.current;
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Center pan initially if not moved
    if (sim.pan.x === 0 && sim.pan.y === 0) {
      sim.pan = { x: width / 2, y: height / 2 };
    }

    nodes.forEach((n, idx) => {
      if (!sim.positions.has(n.id)) {
        // Place around center with slight spread based on group
        const angle = (idx / nodes.length) * Math.PI * 2;
        const radius = 120 + Math.random() * 180;
        sim.positions.set(n.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
        });
        sim.velocities.set(n.id, { vx: 0, vy: 0 });
      }
    });

    let animationFrameId;

    // Simple physical step: repulsion + attraction + damping
    const stepPhysics = () => {
      const pos = sim.positions;
      const vel = sim.velocities;
      const kRepulse = 3800;
      const kSpring = 0.04;
      const centerGravity = 0.003;
      const damping = 0.82;

      // Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        const id1 = nodes[i].id;
        const p1 = pos.get(id1);
        const v1 = vel.get(id1);
        if (!p1 || !v1) continue;

        // Center gravity
        v1.vx -= p1.x * centerGravity;
        v1.vy -= p1.y * centerGravity;

        for (let j = i + 1; j < nodes.length; j++) {
          const id2 = nodes[j].id;
          const p2 = pos.get(id2);
          const v2 = vel.get(id2);
          if (!p2 || !v2) continue;

          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distSq = dx * dx + dy * dy + 150;
          const dist = Math.sqrt(distSq);
          const force = kRepulse / distSq;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          v1.vx += fx;
          v1.vy += fy;
          v2.vx -= fx;
          v2.vy -= fy;
        }
      }

      // Spring attraction along links
      links.forEach((link) => {
        const sId = typeof link.source === 'object' ? link.source.id : link.source;
        const tId = typeof link.target === 'object' ? link.target.id : link.target;
        const p1 = pos.get(sId);
        const p2 = pos.get(tId);
        const v1 = vel.get(sId);
        const v2 = vel.get(tId);

        if (p1 && p2 && v1 && v2) {
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 90;
          const displacement = dist - targetDist;
          const force = displacement * kSpring;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          v1.vx += fx;
          v1.vy += fy;
          v2.vx -= fx;
          v2.vy -= fy;
        }
      });

      // Update positions
      nodes.forEach((n) => {
        if (sim.dragNode === n.id) return; // don't move dragged node
        const p = pos.get(n.id);
        const v = vel.get(n.id);
        if (p && v) {
          v.vx *= damping;
          v.vy *= damping;
          p.x += v.vx;
          p.y += v.vy;
        }
      });
    };

    // Render loop
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      stepPhysics();

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);

      // Deep space grid background
      ctx.save();
      ctx.translate(sim.pan.x, sim.pan.y);
      ctx.scale(sim.zoom, sim.zoom);

      // Draw Edges
      links.forEach((link) => {
        const sId = typeof link.source === 'object' ? link.source.id : link.source;
        const tId = typeof link.target === 'object' ? link.target.id : link.target;
        const p1 = sim.positions.get(sId);
        const p2 = sim.positions.get(tId);

        if (p1 && p2) {
          const isHighlighted =
            selectedNode && (selectedNode.id === sId || selectedNode.id === tId);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isHighlighted
            ? 'rgba(56, 189, 248, 0.7)'
            : 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = isHighlighted ? 2 : 1;
          ctx.stroke();

          // Link label if zoomed in
          if (sim.zoom > 0.85 && link.label) {
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            ctx.font = '9px JetBrains Mono, monospace';
            ctx.fillStyle = isHighlighted ? '#38bdf8' : 'rgba(255, 255, 255, 0.4)';
            ctx.textAlign = 'center';
            ctx.fillText(link.label, midX, midY - 4);
          }
        }
      });

      // Draw Nodes
      nodes.forEach((node) => {
        const p = sim.positions.get(node.id);
        if (!p) return;

        const isSelected = selectedNode && selectedNode.id === node.id;
        const isHovered = hoveredNode && hoveredNode.id === node.id;
        const color = getCommunityColor(node.group);

        const isFiltered =
          (searchTerm &&
            !node.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (activeCommunityFilter !== null && node.group !== activeCommunityFilter);

        const alpha = isFiltered ? 0.15 : 1;
        const radius = isSelected ? 12 : isHovered ? 10 : 7;

        // Glow ring
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = isSelected
          ? 'rgba(56, 189, 248, 0.4)'
          : `${color}${Math.round(alpha * 40).toString(16).padStart(2, '0')}`;
        ctx.fill();

        // Main node circle
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? '#ffffff' : color;
        ctx.globalAlpha = alpha;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#38bdf8' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Node Label
        if (sim.zoom > 0.6 || isSelected || isHovered) {
          ctx.font = `${isSelected ? 'bold 12px' : '11px'} Inter, sans-serif`;
          ctx.fillStyle = isSelected
            ? '#ffffff'
            : isFiltered
            ? 'rgba(255, 255, 255, 0.25)'
            : '#e2e8f0';
          ctx.textAlign = 'center';
          ctx.fillText(node.id, p.x, p.y + radius + 14);
        }
      });

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [is3D, nodes, links, selectedNode, hoveredNode, searchTerm, activeCommunityFilter]);

  // Handle Canvas Mouse Interactivity
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const sim = simulationRef.current;

    // Convert mouse coords to world coords
    const worldX = (clientX - sim.pan.x) / sim.zoom;
    const worldY = (clientY - sim.pan.y) / sim.zoom;

    // Check if clicked a node
    let clicked = null;
    for (const node of nodes) {
      const p = sim.positions.get(node.id);
      if (p) {
        const dist = Math.hypot(p.x - worldX, p.y - worldY);
        if (dist <= 14) {
          clicked = node;
          break;
        }
      }
    }

    if (clicked) {
      sim.dragNode = clicked.id;
      onNodeClick(clicked);
    } else {
      sim.isDragging = true;
    }

    sim.lastMouse = { x: clientX, y: clientY };
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const sim = simulationRef.current;

    const dx = clientX - sim.lastMouse.x;
    const dy = clientY - sim.lastMouse.y;
    sim.lastMouse = { x: clientX, y: clientY };

    if (sim.dragNode) {
      const p = sim.positions.get(sim.dragNode);
      if (p) {
        p.x += dx / sim.zoom;
        p.y += dy / sim.zoom;
      }
    } else if (sim.isDragging) {
      sim.pan.x += dx;
      sim.pan.y += dy;
    } else {
      // Hover check
      const worldX = (clientX - sim.pan.x) / sim.zoom;
      const worldY = (clientY - sim.pan.y) / sim.zoom;
      let hovered = null;
      for (const node of nodes) {
        const p = sim.positions.get(node.id);
        if (p) {
          const dist = Math.hypot(p.x - worldX, p.y - worldY);
          if (dist <= 14) {
            hovered = node;
            break;
          }
        }
      }
      setHoveredNode(hovered);
    }
  };

  const handleMouseUp = () => {
    const sim = simulationRef.current;
    sim.isDragging = false;
    sim.dragNode = null;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const sim = simulationRef.current;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.max(0.2, Math.min(3.5, sim.zoom * zoomFactor));
    sim.zoom = newZoom;
    setZoomLevel(newZoom);
  };

  const resetCamera = () => {
    const sim = simulationRef.current;
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    sim.pan = { x: width / 2, y: height / 2 };
    sim.zoom = 1;
    setZoomLevel(1);

    if (is3D && graph3DInstanceRef.current) {
      graph3DInstanceRef.current.cameraPosition(
        { x: 0, y: 0, z: 260 },
        { x: 0, y: 0, z: 0 },
        1000
      );
    }
  };

  const handleZoom = (direction) => {
    const sim = simulationRef.current;
    const factor = direction === 'in' ? 1.25 : 0.8;
    const newZoom = Math.max(0.2, Math.min(3.5, sim.zoom * factor));
    sim.zoom = newZoom;
    setZoomLevel(newZoom);
  };

  return (
    <div className="relative flex-1 h-full bg-[#07090e] overflow-hidden select-none">
      {/* Top HUD Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left HUD: Search & Community Filter */}
        <div className="flex items-center gap-2 pointer-events-auto flex-wrap max-w-2xl">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter entities..."
              className="bg-[#0d111a]/90 backdrop-blur-md text-xs text-white placeholder-slate-400 rounded-xl pl-9 pr-3 py-2 border border-white/10 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-xl w-48 transition-all"
            />
          </div>

          {/* Community Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-md py-1 no-scrollbar">
            <button
              onClick={() => setActiveCommunityFilter(null)}
              className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-all ${
                activeCommunityFilter === null
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-[#0d111a]/80 text-slate-400 border-white/5 hover:text-white'
              }`}
            >
              All ({nodes.length})
            </button>

            {communities.map((comm) => {
              const color = getCommunityColor(comm);
              const isActive = activeCommunityFilter === comm;
              return (
                <button
                  key={comm}
                  onClick={() =>
                    setActiveCommunityFilter(isActive ? null : comm)
                  }
                  className={`text-[11px] px-2 py-1 rounded-lg font-medium border transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'shadow-md scale-105'
                      : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isActive ? `${color}30` : 'rgba(13, 17, 26, 0.8)',
                    borderColor: `${color}${isActive ? '80' : '40'}`,
                    color: color,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>Comm {comm}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right HUD: Camera & View Controls */}
        <div className="flex items-center gap-1.5 pointer-events-auto bg-[#0d111a]/90 backdrop-blur-md p-1 rounded-xl border border-white/10 shadow-xl">
          <button
            onClick={() => handleZoom('in')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom('out')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            onClick={resetCamera}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Reset Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Canvas / 3D Container */}
      <div ref={containerRef} className="w-full h-full">
        {!is3D && (
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />
        )}
      </div>

      {/* Empty State Banner if graph has 0 nodes */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-none">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md max-w-md shadow-2xl pointer-events-auto animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-2 font-['Outfit']">
              Knowledge Graph is Empty
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-5">
              Upload unstructured enterprise documents (PDF, TXT, MD) or paste text to extract entities, relationships, and Louvain community clusters.
            </p>
            <button
              onClick={onOpenIngest}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/20 transition-all hover:scale-105"
            >
              Ingest First Document
            </button>
          </div>
        </div>
      )}

      {/* Bottom Telemetry Overlay */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0d111a]/80 backdrop-blur-md border border-white/5 text-[11px] text-slate-400 font-mono">
          <span>Displaying:</span>
          <span className="text-cyan-400 font-bold">{filteredNodes.length}</span>
          <span>/</span>
          <span>{nodes.length} entities</span>
          <span className="text-slate-600">•</span>
          <span className="text-indigo-400 font-bold">{links.length}</span>
          <span>relations</span>
        </div>
      </div>
    </div>
  );
}
