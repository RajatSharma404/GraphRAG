"""
Streamlit Web UI for GraphRAG
Comprehensive interactive dashboard providing chat reasoning, 3D graph visualization, and Ragas evaluation.
"""

import os
import json
import streamlit as st

st.set_page_config(
    page_title="GraphRAG Studio",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom Styling
st.markdown("""
<style>
    .metric-card {
        background-color: #131927;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 12px;
        text-align: center;
    }
    .metric-val {
        font-size: 1.5rem;
        font-weight: 700;
        color: #38bdf8;
    }
    .metric-lbl {
        font-size: 0.75rem;
        color: #94a3b8;
    }
</style>
""", unsafe_allow_html=True)

# Lazy import pipeline
@st.cache_resource
def get_pipeline():
    from src.pipeline import GraphRAGPipeline
    return GraphRAGPipeline()

pipeline = get_pipeline()

# Sidebar: Telemetry & Controls
st.sidebar.title("🧠 GraphRAG Studio")
st.sidebar.caption("Enterprise Knowledge Graph & Dual-Mode Retrieval")

# Check database
neo_ok = pipeline.neo4j.verify_connectivity()
if neo_ok:
    st.sidebar.success("🟢 Neo4j Database: ONLINE")
    nodes_res = pipeline.neo4j.execute_query("MATCH (e:Entity) RETURN count(e) AS c")
    edges_res = pipeline.neo4j.execute_query("MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS c")
    comms_res = pipeline.neo4j.execute_query("MATCH (cs:CommunitySummary) RETURN count(cs) AS c")
    
    n_count = nodes_res[0]["c"] if nodes_res else 0
    e_count = edges_res[0]["c"] if edges_res else 0
    c_count = comms_res[0]["c"] if comms_res else 0
else:
    st.sidebar.error("🔴 Neo4j Database: OFFLINE")
    n_count, e_count, c_count = 0, 0, 0

# Telemetry columns
col1, col2, col3 = st.sidebar.columns(3)
col1.metric("Entities", n_count)
col2.metric("Relations", e_count)
col3.metric("Clusters", c_count)

st.sidebar.divider()

# Search Mode Selector
search_mode = st.sidebar.radio(
    "Search Mode",
    ["Local Search", "Global Search"],
    help="Local Search: 1-2 hop neighborhood graph traversal for entities.\nGlobal Search: Map-Reduce over hierarchical summaries."
)
mode_key = "local" if "Local" in search_mode else "global"

if mode_key == "local":
    st.sidebar.info("🔍 **Local Search**: Traverses entity graph neighborhoods for high-precision questions.")
else:
    st.sidebar.info("🌐 **Global Search**: Parallel Map-Reduce over community clusters for dataset-wide themes.")

st.sidebar.divider()

# Ingest Document Section
st.sidebar.subheader("📄 Ingest New Document")
uploaded_file = st.sidebar.file_uploader("Upload PDF or TXT", type=["pdf", "txt", "md"])
if uploaded_file and st.sidebar.button("Ingest & Extract"):
    save_path = os.path.join("data", "raw", uploaded_file.name)
    with open(save_path, "wb") as f:
        f.write(uploaded_file.getbuffer())
    
    with st.sidebar.status("Ingesting and extracting graph...", expanded=True) as status:
        pipeline.ingest_document(save_path)
        pipeline.run_community_detection()
        status.update(label="Ingestion complete!", state="complete", expanded=False)
    st.sidebar.success(f"Ingested {uploaded_file.name} successfully!")
    st.rerun()

if st.sidebar.button("🔄 Re-cluster Communities"):
    with st.sidebar.status("Running Louvain clustering..."):
        pipeline.run_community_detection()
    st.sidebar.success("Communities updated!")
    st.rerun()

# Main Area Tabs
tab_chat, tab_graph, tab_benchmarks = st.tabs([
    "💬 AI Reasoning & Chat", 
    "🕸️ Knowledge Graph Explorer", 
    "📊 Ragas Quantitative Benchmarks"
])

# ----------------- TAB 1: Chat -----------------
with tab_chat:
    st.subheader(f"Dual-Mode Reasoning ({search_mode.upper()})")
    
    # Preset chips
    preset_cols = st.columns(3)
    if preset_cols[0].button("ASML ➔ Microsoft Multi-Hop"):
        st.session_state["user_prompt"] = "How does an operational delay at ASML impact Microsoft?"
    if preset_cols[1].button("Systemic Supply Vulnerabilities"):
        st.session_state["user_prompt"] = "What are the primary systemic supply chain vulnerabilities identified across the ecosystem?"
    if preset_cols[2].button("Google TPU & TSMC Connection"):
        st.session_state["user_prompt"] = "How is Google connected to TSMC for custom AI accelerators?"

    # Chat history
    if "messages" not in st.session_state:
        st.session_state.messages = []

    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])

    # Chat Input
    prompt = st.chat_input("Ask a question about the connected enterprise ecosystem...")
    if "user_prompt" in st.session_state and st.session_state["user_prompt"]:
        prompt = st.session_state.pop("user_prompt")

    if prompt:
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner(f"Traversing knowledge graph in {mode_key.upper()} mode..."):
                response = pipeline.ask(prompt, mode=mode_key)
                st.markdown(response)
        st.session_state.messages.append({"role": "assistant", "content": response})

# ----------------- TAB 2: Graph Explorer -----------------
with tab_graph:
    st.subheader("Interactive Graph Entities & Topological Relationships")
    
    # Embed visualizer iframe
    st.markdown("""
        <iframe src="http://localhost:8000/data/visualizer.html" width="100%" height="450px" style="border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;"></iframe>
    """, unsafe_allow_html=True)

    col_e, col_r = st.columns(2)
    with col_e:
        st.write("### Extracted Entities")
        entities_data = pipeline.neo4j.execute_query("""
            MATCH (e:Entity) 
            RETURN e.name AS Name, e.type AS Type, coalesce(e.community_id, 0) AS Community, e.description AS Description
            ORDER BY e.name
        """)
        st.dataframe(entities_data, use_container_width=True)

    with col_r:
        st.write("### Directed Relationships")
        relations_data = pipeline.neo4j.execute_query("""
            MATCH (s:Entity)-[r:RELATED_TO]->(t:Entity)
            RETURN s.name AS Source, r.type AS Relation, t.name AS Target, r.weight AS Weight
            ORDER BY s.name
        """)
        st.dataframe(relations_data, use_container_width=True)

# ----------------- TAB 3: Benchmarks -----------------
with tab_benchmarks:
    st.subheader("Ragas Automated Evaluation & Quantitative Benchmarking")
    st.write("Evaluate **Context Precision**, **Faithfulness (Anti-Hallucination)**, and **Answer Relevancy** across test cases.")
    
    benchmark_file = os.path.join("evaluation", "BENCHMARK_REPORT.md")
    if os.path.exists(benchmark_file):
        with open(benchmark_file, "r", encoding="utf-8") as f:
            st.markdown(f.read())
    else:
        st.info("No benchmark report found. Run the automated evaluation suite below.")

    if st.button("🚀 Run Live Ragas Evaluation Suite"):
        with st.spinner("Executing Ragas test cases and scoring claims..."):
            from evaluation.benchmark import run_benchmark
            run_benchmark()
        st.success("Benchmark completed! Report updated.")
        st.rerun()
