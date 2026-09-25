import React from 'react';
import { 
  Network, 
  UploadCloud, 
  RefreshCw, 
  Database, 
  Trash2, 
  Share2, 
  Box, 
  Activity, 
  Sparkles 
} from 'lucide-react';

export default function Header({
  health,
  onOpenIngest,
  onRecluster,
  isClustering,
  onClearGraph,
  onRefreshHealth,
  isGraph3D,
  setIsGraph3D,
}) {
  const isOnline = health?.neo4j === true;

  return (
    <header className="h-16 border-b border-white/10 glass-panel px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center gap-3.5">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 shadow-lg shadow-cyan-500/20 text-white">
          <Network className="w-5 h-5 text-cyan-100" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-cyan-400 rounded-full ring-2 ring-[#07090e] animate-ping" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white font-['Outfit']">
              GraphRAG <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">STUDIO</span>
            </h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Hybrid Knowledge Graph &amp; Dual-Mode Search Engine
          </p>
        </div>
      </div>

      {/* Live Telemetry Status Badges */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Neo4j Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-300 font-medium">
            {isOnline ? 'Neo4j Connected' : 'Neo4j Offline'}
          </span>
        </div>

        {/* Entities count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
          <span className="text-slate-400">Entities:</span>
          <span className="font-semibold text-cyan-400 font-mono">
            {health?.node_count ?? 0}
          </span>
        </div>

        {/* Relations count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
          <span className="text-slate-400">Relations:</span>
          <span className="font-semibold text-indigo-400 font-mono">
            {health?.edge_count ?? 0}
          </span>
        </div>

        {/* Communities count */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs">
          <span className="text-slate-400">Communities:</span>
          <span className="font-semibold text-amber-400 font-mono">
            {health?.community_count ?? 0}
          </span>
        </div>

        {/* Refresh telemetry */}
        <button
          onClick={onRefreshHealth}
          title="Refresh metrics"
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Toggle 2D / 3D */}
        <button
          onClick={() => setIsGraph3D(!isGraph3D)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            isGraph3D
              ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
              : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
          }`}
          title="Switch Graph Display Mode"
        >
          <Box className="w-3.5 h-3.5" />
          <span>{isGraph3D ? '3D View' : '2D View'}</span>
        </button>

        {/* Ingest Document */}
        <button
          onClick={onOpenIngest}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-md shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Ingest Data</span>
        </button>

        {/* Re-Cluster Button */}
        <button
          onClick={onRecluster}
          disabled={isClustering}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
          title="Run Louvain Community Detection"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isClustering ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">
            {isClustering ? 'Clustering...' : 'Re-Cluster'}
          </span>
        </button>

        {/* Clear Database */}
        <button
          onClick={onClearGraph}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 transition-colors"
          title="Clear Entire Knowledge Graph"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
