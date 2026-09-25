import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import GraphViewer from './components/GraphViewer';
import NodeInspector from './components/NodeInspector';
import IngestModal from './components/IngestModal';
import ConfirmModal from './components/ConfirmModal';
import Toast from './components/Toast';
import { api } from './services/api';

export default function App() {
  const [health, setHealth] = useState({
    neo4j: false,
    node_count: 0,
    edge_count: 0,
    community_count: 0,
  });

  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isGraph3D, setIsGraph3D] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Fetch telemetry / health
  const loadHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Health check unreachable:', err);
      setHealth((prev) => ({ ...prev, neo4j: false }));
    }
  }, []);

  // Fetch Graph topology
  const loadGraph = useCallback(async () => {
    try {
      const data = await api.getGraph();
      setGraphData({
        nodes: data.nodes || [],
        links: data.links || [],
      });
    } catch (err) {
      console.warn('Graph data unreachable:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadHealth();
    loadGraph();

    // Periodic telemetry ping every 20 seconds
    const interval = setInterval(() => {
      loadHealth();
    }, 20000);

    return () => clearInterval(interval);
  }, [loadHealth, loadGraph]);

  // Handle Louvain Re-clustering
  const handleRecluster = async () => {
    setIsClustering(true);
    try {
      await api.triggerClustering();
      await loadHealth();
      await loadGraph();
      showToast('Louvain community clustering & summaries synthesized!', 'success');
    } catch (err) {
      showToast(`Clustering failed: ${err.message}`, 'error');
    } finally {
      setIsClustering(false);
    }
  };

  // Handle Purge Knowledge Graph
  const handleClearGraph = async () => {
    setIsClearing(true);
    try {
      await api.clearGraph();
      setSelectedNode(null);
      await loadHealth();
      await loadGraph();
      setIsConfirmClearOpen(false);
      showToast('Knowledge graph has been completely purged.', 'info');
    } catch (err) {
      showToast(`Clear graph failed: ${err.message}`, 'error');
    } finally {
      setIsClearing(false);
    }
  };

  // Ingestion success callback
  const handleIngestSuccess = async (msg) => {
    showToast(msg, 'success');
    await loadHealth();
    await loadGraph();
  };

  // Handle Node selection from graph or inspector
  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleSelectNeighbor = (neighborId) => {
    const found = graphData.nodes.find((n) => n.id === neighborId);
    if (found) {
      setSelectedNode(found);
    } else {
      setSelectedNode({ id: neighborId, group: 0 });
    }
  };

  const handleAskEntity = (entityName) => {
    // Select node and could also interact with chat
    showToast(`Focused on entity: ${entityName}`, 'info');
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#07090e] text-slate-100 font-sans">
      {/* Top Navigation & Telemetry Bar */}
      <Header
        health={health}
        onOpenIngest={() => setIsIngestOpen(true)}
        onRecluster={handleRecluster}
        isClustering={isClustering}
        onClearGraph={() => setIsConfirmClearOpen(true)}
        onRefreshHealth={loadHealth}
        isGraph3D={isGraph3D}
        setIsGraph3D={setIsGraph3D}
      />

      {/* Main Split-Screen Workspace */}
      <main className="flex-1 flex flex-col md:flex-row h-[calc(100vh-4rem)] overflow-hidden relative">
        {/* Left Side: Dual-Mode AI Reasoning & Interactive Chat */}
        <section className="w-full md:w-[450px] lg:w-[480px] xl:w-[520px] h-full shrink-0 z-10">
          <ChatPanel onNodeSelect={handleNodeClick} />
        </section>

        {/* Right Side: Interactive Knowledge Graph Visualizer */}
        <section className="flex-1 h-full relative overflow-hidden bg-[#07090e]">
          <GraphViewer
            graphData={graphData}
            selectedNode={selectedNode}
            onNodeClick={handleNodeClick}
            is3D={isGraph3D}
            onOpenIngest={() => setIsIngestOpen(true)}
          />

          {/* Slide-in Node Inspector Drawer */}
          {selectedNode && (
            <NodeInspector
              node={selectedNode}
              graphData={graphData}
              onClose={() => setSelectedNode(null)}
              onSelectNode={handleSelectNeighbor}
              onAskEntity={handleAskEntity}
            />
          )}
        </section>
      </main>

      {/* Ingest Document / Raw Text Modal */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onIngestSuccess={handleIngestSuccess}
      />

      {/* Confirm Clear Database Modal */}
      <ConfirmModal
        isOpen={isConfirmClearOpen}
        title="Purge Knowledge Graph?"
        message="Are you sure you want to permanently erase all entities, relationships, text chunks, and community summaries from Neo4j? This action cannot be undone."
        confirmText="Yes, Purge Database"
        isDanger={true}
        isLoading={isClearing}
        onConfirm={handleClearGraph}
        onCancel={() => setIsConfirmClearOpen(false)}
      />

      {/* Toast Feedback */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
