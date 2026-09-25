import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  AlignLeft, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function IngestModal({ isOpen, onClose, onIngestSuccess }) {
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'text'
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f) => {
    const ext = f.name.slice(((f.name.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
    if (!['pdf', 'txt', 'md'].includes(ext)) {
      setErrorMessage('Only .pdf, .txt, and .md files are supported.');
      return;
    }
    setErrorMessage('');
    setFile(f);
  };

  const handleFileSubmit = async () => {
    if (!file || isLoading) return;
    setIsLoading(true);
    setStatusMessage('Uploading document and extracting entity-relationship graph...');
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/ingest-file', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Ingestion failed' }));
        throw new Error(errData.detail || `Server error (${res.status})`);
      }

      const data = await res.json();
      
      // Fire confetti burst
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      onIngestSuccess(`Successfully ingested "${data.filename}" and re-clustered graph!`);
      handleClose();
    } catch (err) {
      setErrorMessage(err.message || 'Document ingestion failed.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleTextSubmit = async () => {
    const title = pasteTitle.trim() || 'Untitled Note';
    const content = pasteContent.trim();
    if (!content || isLoading) return;

    setIsLoading(true);
    setStatusMessage('Extracting knowledge graph entities and computing communities...');
    setErrorMessage('');

    try {
      const res = await fetch('/api/ingest-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: 'Ingestion failed' }));
        throw new Error(errData.detail || `Server error (${res.status})`);
      }

      // Fire confetti burst
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {
        // ignore
      }

      onIngestSuccess(`Successfully ingested "${title}" and updated graph!`);
      handleClose();
    } catch (err) {
      setErrorMessage(err.message || 'Text ingestion failed.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setFile(null);
    setPasteTitle('');
    setPasteContent('');
    setErrorMessage('');
    setStatusMessage('');
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl glass-dropdown border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-white/[0.02] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">
                Ingest into Knowledge Graph
              </h3>
              <p className="text-xs text-slate-400">
                Extract entities, relationships, &amp; community summaries
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-[#07090e]/50 px-5 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('file')}
            disabled={isLoading}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'file'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Upload Document</span>
          </button>
          <button
            onClick={() => setActiveTab('text')}
            disabled={isLoading}
            className={`flex items-center gap-2 pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'text'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Paste Raw Text</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: File Upload */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isLoading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-cyan-400 bg-cyan-500/10 scale-[1.01]'
                    : file
                    ? 'border-cyan-500/40 bg-white/[0.02]'
                    : 'border-white/10 hover:border-cyan-500/30 bg-white/[0.01]'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400">
                  <UploadCloud className="w-6 h-6" />
                </div>

                {file ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white break-all">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatFileSize(file.size)}
                    </p>
                    <span className="inline-block mt-2 text-[10px] uppercase font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                      Ready to Ingest
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-200">
                      Drag &amp; drop your document here, or{' '}
                      <span className="text-cyan-400 underline">browse</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Supports .PDF, .TXT, and .MD files
                    </p>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <button
                type="button"
                onClick={handleFileSubmit}
                disabled={!file || isLoading}
                className="w-full py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Extracting &amp; Ingesting...</span>
                  </>
                ) : (
                  <>
                    <span>Ingest &amp; Extract Graph</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: Paste Raw Text */}
          {activeTab === 'text' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Document / Section Title
                </label>
                <input
                  type="text"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="e.g. Semiconductor Ecosystem Roadmap 2026"
                  disabled={isLoading}
                  className="w-full bg-[#131926] text-white text-xs placeholder-slate-500 rounded-xl px-3.5 py-2.5 border border-white/10 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between">
                  <span>Unstructured Content</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {pasteContent.length} chars
                  </span>
                </label>
                <textarea
                  rows={8}
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste unstructured enterprise text, articles, memos, or interview transcripts here..."
                  disabled={isLoading}
                  className="w-full bg-[#131926] text-white text-xs placeholder-slate-500 rounded-xl p-3.5 border border-white/10 focus:border-cyan-500 focus:outline-none resize-none leading-relaxed"
                />
              </div>

              <button
                type="button"
                onClick={handleTextSubmit}
                disabled={!pasteContent.trim() || isLoading}
                className="w-full py-3 rounded-xl font-semibold text-xs text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Extracting &amp; Ingesting...</span>
                  </>
                ) : (
                  <>
                    <span>Ingest &amp; Extract Graph</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading status text */}
          {isLoading && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs animate-pulse">
              <Sparkles className="w-4 h-4 shrink-0 animate-spin text-cyan-400" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
