// GraphRAG Studio Client Logic

let currentMode = "local";
let graphData = { nodes: [], links: [] };
let GraphInstance = null;

// DOM Elements
const chatStream = document.getElementById("chat-stream");
const chatForm = document.getElementById("chat-form");
const queryInput = document.getElementById("query-input");
const btnSend = document.getElementById("btn-send");
const modeLocalBtn = document.getElementById("mode-local");
const modeGlobalBtn = document.getElementById("mode-global");
const modeExplanation = document.getElementById("mode-explanation");

// Telemetry
const statEntities = document.getElementById("stat-entities");
const statRelations = document.getElementById("stat-relations");
const statCommunities = document.getElementById("stat-communities");
const badgeStatus = document.getElementById("badge-status");

// Inspector
const nodeInspector = document.getElementById("node-inspector");
const insName = document.getElementById("ins-name");
const insType = document.getElementById("ins-type");
const insComm = document.getElementById("ins-comm");
const insDesc = document.getElementById("ins-desc");
const insNeighbors = document.getElementById("ins-neighbors");
const insRelCount = document.getElementById("ins-rel-count");
const btnCloseInspector = document.getElementById("btn-close-inspector");

// Modal Elements
const modalIngest = document.getElementById("modal-ingest");
const btnOpenIngest = document.getElementById("btn-open-ingest");
const btnCloseModal = document.getElementById("btn-close-modal");
const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");
const fileNameDisplay = document.getElementById("file-name-display");
const btnSubmitFile = document.getElementById("btn-submit-file");
const pasteTitle = document.getElementById("paste-title");
const pasteContent = document.getElementById("paste-content");
const btnSubmitText = document.getElementById("btn-submit-text");
const btnCluster = document.getElementById("btn-cluster");
const btnResetCam = document.getElementById("btn-reset-cam");
const graphSearch = document.getElementById("graph-search");

// Community Palette
const COMMUNITY_COLORS = [
  "#38bdf8", // Light Blue
  "#818cf8", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#a855f7", // Purple
  "#06b6d4"  // Cyan
];

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initGraph();
  fetchHealth();
  fetchGraph();
  setupEventListeners();
});

// Setup Events
function setupEventListeners() {
  // Mode selection
  modeLocalBtn.addEventListener("click", () => setMode("local"));
  modeGlobalBtn.addEventListener("click", () => setMode("global"));

  // Suggestions
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      queryInput.value = chip.dataset.query;
      chatForm.dispatchEvent(new Event("submit"));
    });
  });

  // Chat Submit
  chatForm.addEventListener("submit", handleChatSubmit);

  // Inspector close
  btnCloseInspector.addEventListener("click", () => {
    nodeInspector.style.display = "none";
  });

  // Modal open/close
  btnOpenIngest.addEventListener("click", () => modalIngest.style.display = "flex");
  btnCloseModal.addEventListener("click", () => modalIngest.style.display = "none");
  modalIngest.addEventListener("click", (e) => {
    if (e.target === modalIngest) modalIngest.style.display = "none";
  });

  // Modal Tabs
  document.querySelectorAll(".modal-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".modal-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // File Upload
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelected();
    }
  });
  fileInput.addEventListener("change", handleFileSelected);
  btnSubmitFile.addEventListener("click", handleFileSubmit);
  btnSubmitText.addEventListener("click", handleTextSubmit);

  // Re-cluster
  btnCluster.addEventListener("click", handleRecluster);

  // Reset Camera
  btnResetCam.addEventListener("click", () => {
    if (GraphInstance) {
      GraphInstance.cameraPosition({ x: 0, y: 0, z: 240 }, { x: 0, y: 0, z: 0 }, 1000);
    }
  });

  // Filter search
  graphSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (!GraphInstance) return;
    if (!term) {
      GraphInstance.nodeColor(node => COMMUNITY_COLORS[node.group % COMMUNITY_COLORS.length]);
      return;
    }
    GraphInstance.nodeColor(node => {
      return node.id.toLowerCase().includes(term) ? "#38bdf8" : "rgba(255,255,255,0.1)";
    });
  });
}

function setMode(mode) {
  currentMode = mode;
  if (mode === "local") {
    modeLocalBtn.classList.add("active");
    modeGlobalBtn.classList.remove("active");
    modeExplanation.innerText = "1-2 hop neighborhood graph traversal for high-precision entity questions.";
  } else {
    modeGlobalBtn.classList.add("active");
    modeLocalBtn.classList.remove("active");
    modeExplanation.innerText = "Hierarchical Map-Reduce synthesis over community summaries for dataset-wide themes.";
  }
}

// 3D Graph Initialization
function initGraph() {
  const container = document.getElementById("graph-container");
  GraphInstance = ForceGraph3D()(container)
    .backgroundColor("#07090e")
    .nodeAutoColorBy("group")
    .nodeLabel(node => `${node.id} (${node.type || 'Entity'})`)
    .nodeColor(node => COMMUNITY_COLORS[node.group % COMMUNITY_COLORS.length])
    .nodeRelSize(5)
    .linkLabel(link => link.label || 'RELATED_TO')
    .linkDirectionalParticles(2)
    .linkDirectionalParticleWidth(1.2)
    .linkDirectionalParticleSpeed(0.005)
    .linkColor(() => "rgba(255,255,255,0.2)")
    .onNodeClick(node => inspectNode(node));

  window.addEventListener("resize", () => {
    if (GraphInstance) {
      GraphInstance.width(container.clientWidth);
      GraphInstance.height(container.clientHeight);
    }
  });
}

// Fetch Health and Metrics
async function fetchHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    statEntities.innerText = data.node_count;
    statRelations.innerText = data.edge_count;
    statCommunities.innerText = data.community_count;
  } catch (err) {
    console.error("Health check error:", err);
  }
}

// Fetch and Populate Graph
async function fetchGraph() {
  try {
    const res = await fetch("/api/graph");
    graphData = await res.json();
    if (GraphInstance) {
      GraphInstance.graphData(graphData);
      renderLegend();
    }
  } catch (err) {
    console.error("Graph fetch error:", err);
  }
}

function renderLegend() {
  const legend = document.getElementById("hud-legend");
  legend.innerHTML = "";
  const groups = Array.from(new Set(graphData.nodes.map(n => n.group))).sort((a, b) => a - b);
  groups.forEach(g => {
    const pill = document.createElement("span");
    pill.className = "chip";
    pill.style.borderColor = COMMUNITY_COLORS[g % COMMUNITY_COLORS.length];
    pill.style.color = COMMUNITY_COLORS[g % COMMUNITY_COLORS.length];
    pill.innerText = `Comm ${g}`;
    legend.appendChild(pill);
  });
}

// Node Inspector
function inspectNode(node) {
  insName.innerText = node.id;
  insType.innerText = node.type || "ENTITY";
  insComm.innerText = `Community ${node.group}`;
  insComm.style.borderColor = COMMUNITY_COLORS[node.group % COMMUNITY_COLORS.length];
  insDesc.innerText = node.desc || "No extended narrative description.";

  // Find neighbors
  const connected = graphData.links.filter(l => 
    (l.source.id || l.source) === node.id || (l.target.id || l.target) === node.id
  );
  insRelCount.innerText = connected.length;
  insNeighbors.innerHTML = "";

  connected.forEach(link => {
    const isSource = (link.source.id || link.source) === node.id;
    const otherId = isSource ? (link.target.id || link.target) : (link.source.id || link.source);
    const item = document.createElement("div");
    item.className = "neighbor-item";
    item.innerHTML = `
      <span>${otherId}</span>
      <span class="neighbor-rel">${isSource ? '&rarr;' : '&larr;'} ${link.label}</span>
    `;
    insNeighbors.appendChild(item);
  });

  nodeInspector.style.display = "flex";

  // Fly camera
  const distance = 40;
  const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
  GraphInstance.cameraPosition(
    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
    node,
    1000
  );
}

// Chat Flow
async function handleChatSubmit(e) {
  e.preventDefault();
  const query = queryInput.value.trim();
  if (!query) return;

  // Append user bubble
  appendMessage("user", query);
  queryInput.value = "";

  // Append loading assistant bubble
  const loadingId = appendMessage("assistant", "Thinking & traversing knowledge graph...");

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode: currentMode })
    });
    const data = await res.json();
    updateMessage(loadingId, data.answer);
  } catch (err) {
    updateMessage(loadingId, "⚠️ Error executing query. Please ensure local Ollama and Neo4j are online.");
  }
}

function appendMessage(sender, text) {
  const msgId = "msg-" + Date.now();
  const div = document.createElement("div");
  div.className = `message ${sender}-message`;
  div.id = msgId;

  const avatar = sender === "user" 
    ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`
    : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>`;

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">${marked.parse(text)}</div>
  `;

  chatStream.appendChild(div);
  chatStream.scrollTop = chatStream.scrollHeight;
  return msgId;
}

function updateMessage(msgId, markdownText) {
  const el = document.getElementById(msgId);
  if (el) {
    el.querySelector(".msg-content").innerHTML = marked.parse(markdownText);
    chatStream.scrollTop = chatStream.scrollHeight;
  }
}

// Ingestion Handlers
function handleFileSelected() {
  if (fileInput.files.length) {
    fileNameDisplay.innerText = fileInput.files[0].name;
    btnSubmitFile.disabled = false;
  }
}

async function handleFileSubmit() {
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);

  btnSubmitFile.innerText = "Extracting & Ingesting...";
  btnSubmitFile.disabled = true;

  try {
    const res = await fetch("/api/ingest-file", { method: "POST", body: formData });
    const data = await res.json();
    alert(`Successfully ingested: ${data.filename}!`);
    modalIngest.style.display = "none";
    await fetchHealth();
    await fetchGraph();
  } catch (err) {
    alert("Ingestion failed: " + err.message);
  } finally {
    btnSubmitFile.innerText = "Ingest & Extract Graph";
    btnSubmitFile.disabled = false;
  }
}

async function handleTextSubmit() {
  const title = pasteTitle.value.trim() || "Untitled Note";
  const content = pasteContent.value.trim();
  if (!content) return alert("Please enter text content.");

  btnSubmitText.innerText = "Extracting & Ingesting...";
  btnSubmitText.disabled = true;

  try {
    const res = await fetch("/api/ingest-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content })
    });
    alert(`Successfully ingested: ${title}!`);
    modalIngest.style.display = "none";
    pasteTitle.value = "";
    pasteContent.value = "";
    await fetchHealth();
    await fetchGraph();
  } catch (err) {
    alert("Ingestion failed: " + err.message);
  } finally {
    btnSubmitText.innerText = "Ingest & Extract Graph";
    btnSubmitText.disabled = false;
  }
}

async function handleRecluster() {
  btnCluster.disabled = true;
  btnCluster.querySelector("span").innerText = "Clustering...";
  try {
    await fetch("/api/cluster", { method: "POST" });
    await fetchHealth();
    await fetchGraph();
    alert("Louvain clustering and summaries updated!");
  } catch (err) {
    alert("Re-clustering failed: " + err.message);
  } finally {
    btnCluster.disabled = false;
    btnCluster.querySelector("span").innerText = "Re-Cluster";
  }
}
