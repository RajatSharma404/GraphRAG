import React from 'react';
import { X, Network, ExternalLink, ArrowRight, ArrowLeft, Tag, Layers, MessageSquare } from 'lucide-react';
import { getCommunityColor } from '../utils/colors';

export default function NodeInspector({ node, graphData, onClose, onSelectNode, onAskEntity }) {
  if (!node) return null;

  // Find relationships connected to this node
  const links = graphData?.links || [];
  const nodeId = node.id;
  
  const connectedLinks = links.filter((link) => {
    const sId = typeof link.source === 'object' ? link.source.id : link.source;
    const tId = typeof link.target === 'object' ? link.target.id : link.target;
    return sId === nodeId || tId === nodeId;
  });

  const commColor = getCommunityColor(node.group);

  return (
    <aside className="absolute top-4 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] rounded-2xl glass-dropdown border border-white/10 shadow-2xl flex flex-col z-30 animate-slide-left overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-white/[0.03] flex items-start justify-between gap-3 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              {node.type || 'ENTITY'}
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                borderColor: `${commColor}60`,
                backgroundColor: `${commColor}20`,
                color: commColor,
              }}
            >
              Community {node.group ?? 0}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight break-words font-['Outfit']">
            {node.id}
          </h2>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          title="Close Inspector"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Quick Action: Ask Assistant */}
        <button
          onClick={() => onAskEntity(node.id)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all font-medium shadow-sm hover:scale-[1.01]"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Ask GraphRAG about {node.id}</span>
        </button>

        {/* Narrative Description */}
        <div className="space-y-1.5 bg-white/[0.02] p-3 rounded-xl border border-white/5">
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Summary &amp; Narrative
          </label>
          <p className="text-slate-300 leading-relaxed text-xs">
            {node.desc || node.description || 'No extended narrative extracted for this entity.'}
          </p>
        </div>

        {/* Relationships List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Connected Relationships ({connectedLinks.length})
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              Click neighbor to inspect
            </span>
          </div>

          {connectedLinks.length === 0 ? (
            <div className="text-slate-500 text-xs italic py-2 text-center">
              No direct relationships found.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {connectedLinks.map((link, idx) => {
                const sId = typeof link.source === 'object' ? link.source.id : link.source;
                const tId = typeof link.target === 'object' ? link.target.id : link.target;
                const isSource = sId === nodeId;
                const targetNeighborId = isSource ? tId : sId;

                return (
                  <button
                    key={idx}
                    onClick={() => onSelectNode(targetNeighborId)}
                    className="w-full text-left p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/30 transition-all group flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isSource ? (
                        <ArrowRight className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      ) : (
                        <ArrowLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      )}
                      <span className="font-medium text-slate-200 group-hover:text-cyan-300 truncate">
                        {targetNeighborId}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 group-hover:text-slate-300 shrink-0">
                      {link.label || 'RELATED_TO'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Node Metadata Footer */}
        {node.chunk_count !== undefined && (
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
            <span>Mentioned in Chunks:</span>
            <span className="font-mono font-bold text-slate-200">
              {node.chunk_count}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
