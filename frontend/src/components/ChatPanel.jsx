import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Globe, 
  Send, 
  Bot, 
  User, 
  Copy, 
  Check, 
  Sparkles, 
  Layers, 
  Trash, 
  ArrowRight,
  Info
} from 'lucide-react';
import { marked } from 'marked';
import { api } from '../services/api';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
});

const SUGGESTIONS = [
  {
    label: "ASML → Microsoft Multi-Hop",
    query: "How does an operational delay at ASML impact Microsoft?",
    mode: "local",
  },
  {
    label: "Systemic Supply Risks",
    query: "What are the primary systemic supply chain vulnerabilities identified across the ecosystem?",
    mode: "global",
  },
  {
    label: "SK Hynix → Nvidia Role",
    query: "What role does SK Hynix play in Nvidia's architecture and AI accelerator supply?",
    mode: "local",
  },
  {
    label: "Strategic Alliances",
    query: "Summarize the key corporate partnerships, investments, and supply agreements in the dataset.",
    mode: "global",
  },
];

export default function ChatPanel({ onNodeSelect }) {
  const [mode, setMode] = useState('local'); // 'local' | 'global'
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `### Welcome to GraphRAG Studio!
I am your **Hybrid Graph Reasoning Assistant**. I can perform:
* **Local Search**: Multi-hop graph neighborhood traversals for high-precision entity answers.
* **Global Search**: Dataset-wide thematic synthesis using hierarchical community summaries.

Ask a question or select a prompt below to explore your knowledge graph.`,
      mode: 'local',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText = query, queryMode = mode) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading) return;

    const userMsgId = 'usr-' + Date.now();
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: trimmed,
      mode: queryMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantMsgId = 'ast-' + Date.now();
    const assistantMsg = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      mode: queryMode,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setQuery('');
    setIsLoading(true);

    try {
      await api.executeQueryStream(
        trimmed,
        queryMode,
        (token) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, text: (msg.text || '') + token }
                : msg
            )
          );
        },
        () => {
          setIsLoading(false);
        },
        (err) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    text: msg.text 
                      ? msg.text + `\n\n*(Stream notice: ${err.message})*` 
                      : `⚠️ **Query Error**: ${err.message}\n\n*Please ensure your Neo4j database and local LLM/Ollama service are running.*`,
                    isError: !msg.text,
                  }
                : msg
            )
          );
          setIsLoading(false);
        }
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: `⚠️ **Query Error**: ${err.message}\n\n*Please ensure your Neo4j database and local LLM/Ollama service are running.*`,
                isError: true,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        sender: 'assistant',
        text: `Conversation cleared. Ready for your next query in **${mode === 'local' ? 'Local' : 'Global'} Search** mode.`,
        mode,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d111a]/80 backdrop-blur-md border-r border-white/10 select-text overflow-hidden">
      {/* Search Mode Toggle Header */}
      <div className="p-4 border-b border-white/10 flex flex-col gap-2.5 shrink-0 bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <div className="flex bg-[#07090e] p-1 rounded-xl border border-white/10 w-full max-w-xs shadow-inner">
            <button
              type="button"
              onClick={() => setMode('local')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'local'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Local Search</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('global')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'global'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Global Search</span>
            </button>
          </div>

          <button
            onClick={handleClearChat}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors text-xs flex items-center gap-1"
            title="Clear Chat History"
          >
            <Trash className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Explanation Banner */}
        <div className="text-[11px] text-slate-400 flex items-start gap-1.5 leading-relaxed bg-white/[0.03] p-2 rounded-lg border border-white/5">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
          <span>
            {mode === 'local'
              ? 'Local Mode: Traverses 1-2 hop neighborhood subgraphs with chunk-level entity precision.'
              : 'Global Mode: Hierarchical Map-Reduce synthesis over community summaries for dataset-wide themes.'}
          </span>
        </div>
      </div>

      {/* Suggested Prompts Shelf */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 bg-white/[0.01]">
        <span className="text-[10px] uppercase font-bold text-slate-500 shrink-0 tracking-wider">
          Suggested:
        </span>
        {SUGGESTIONS.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              setMode(item.mode);
              handleSend(item.query, item.mode);
            }}
            className="shrink-0 text-xs px-2.5 py-1 rounded-full bg-white/5 hover:bg-cyan-500/10 border border-white/10 hover:border-cyan-500/30 text-slate-300 hover:text-cyan-300 transition-all flex items-center gap-1"
          >
            <span>{item.label}</span>
            <ArrowRight className="w-3 h-3 opacity-60" />
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 text-sm animate-fade-in ${
                isUser ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                  isUser
                    ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white'
                    : 'bg-white/10 border border-white/10 text-cyan-300'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Bubble */}
              <div
                className={`group relative max-w-[85%] rounded-2xl p-4 shadow-lg ${
                  isUser
                    ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-50 rounded-tr-none'
                    : 'bg-[#131926]/90 border border-white/10 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Meta header */}
                <div className="flex items-center justify-between gap-4 mb-1.5 pb-1 border-b border-white/5 text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-300">
                      {isUser ? 'You' : 'GraphRAG AI'}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-white/5 font-mono text-[9px]">
                      {msg.mode.toUpperCase()}
                    </span>
                  </div>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Body */}
                <div
                  className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed break-words space-y-2"
                  dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }}
                />

                {/* Bubble action footer */}
                {!isUser && (
                  <div className="mt-2.5 pt-1.5 border-t border-white/5 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="p-1 rounded text-slate-400 hover:text-white transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isLoading && (
          <div className="flex gap-3 text-sm animate-fade-in">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/10 text-cyan-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 animate-spin text-cyan-400" />
            </div>
            <div className="bg-[#131926]/90 border border-white/10 rounded-2xl rounded-tl-none p-4 text-slate-300 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse delay-100" />
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse delay-200" />
              </div>
              <span className="text-xs text-slate-300 font-medium">
                Traversing knowledge graph &amp; synthesizing reasoning...
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer */}
      <div className="p-4 border-t border-white/10 bg-[#07090e]/60 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="relative flex items-center"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask a question in ${mode === 'local' ? 'Local' : 'Global'} mode... (Enter to send)`}
            className="w-full bg-[#131926] text-white placeholder-slate-500 text-sm rounded-xl pl-4 pr-12 py-3 border border-white/10 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none shadow-inner"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="absolute right-2 p-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white disabled:opacity-30 disabled:hover:from-cyan-500 transition-all shadow-md shadow-cyan-500/20"
            title="Send Query"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-2 text-[10px] text-slate-500 flex justify-between items-center px-1">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <span className="font-mono">Model: Llama 3.1 / Neo4j Bolt</span>
        </div>
      </div>
    </div>
  );
}
