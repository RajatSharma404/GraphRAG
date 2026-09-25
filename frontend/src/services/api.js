/**
 * GraphRAG API Service Client
 * Handles communication with the FastAPI backend endpoints.
 */

const rawEnvUrl = import.meta.env?.VITE_API_URL;
const API_BASE = rawEnvUrl
  ? (rawEnvUrl.endsWith('/api') ? rawEnvUrl : `${rawEnvUrl.replace(/\/$/, '')}/api`)
  : '/api';

export const api = {
  /**
   * Fetch system health and graph metrics
   */
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed (${res.status})`);
    return await res.json();
  },

  /**
   * Fetch knowledge graph topology (nodes & relationships)
   */
  async getGraph() {
    const res = await fetch(`${API_BASE}/graph`);
    if (!res.ok) throw new Error(`Graph fetch failed (${res.status})`);
    return await res.json();
  },

  /**
   * Execute Local or Global Graph Search
   * @param {string} query
   * @param {'local' | 'global'} mode
   */
  async executeQuery(query, mode = 'local') {
    const res = await fetch(`${API_BASE}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Query execution failed' }));
      throw new Error(err.detail || `Query failed (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Execute Local or Global Graph Search with live token streaming
   * @param {string} query
   * @param {'local' | 'global'} mode
   * @param {(token: string) => void} onToken
   * @param {() => void} [onDone]
   * @param {(error: Error) => void} [onError]
   */
  async executeQueryStream(query, mode = 'local', onToken, onDone, onError) {
    try {
      const res = await fetch(`${API_BASE}/query-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Query failed' }));
        throw new Error(err.detail || `Query failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk && onToken) onToken(chunk);
      }
      if (onDone) onDone();
    } catch (err) {
      if (onError) onError(err);
      else throw err;
    }
  },

  /**
   * Upload file (.pdf, .txt, .md) for knowledge graph extraction
   * @param {File} file
   */
  async ingestFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/ingest-file`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'File upload failed' }));
      throw new Error(err.detail || `Ingestion failed (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Ingest unstructured raw text directly
   * @param {string} title
   * @param {string} content
   */
  async ingestText(title, content) {
    const res = await fetch(`${API_BASE}/ingest-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Text ingestion failed' }));
      throw new Error(err.detail || `Ingestion failed (${res.status})`);
    }
    return await res.json();
  },

  /**
   * Trigger Louvain community re-clustering and summary synthesis
   */
  async triggerClustering() {
    const res = await fetch(`${API_BASE}/cluster`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Clustering failed (${res.status})`);
    return await res.json();
  },

  /**
   * Purge the entire knowledge graph
   */
  async clearGraph() {
    const res = await fetch(`${API_BASE}/clear`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Clear graph failed (${res.status})`);
    return await res.json();
  },
};
