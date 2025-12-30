
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import {
  Code2,
  Play,
  Copy,
  Check,
  MessageCircle,
  Download,
  BookOpen,
  Loader2,
  AlertCircle,
  Hash,
  Type,
  ExternalLink,
  Library,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ToggleButton from './ToggleButton';
import { GoogleGenAI } from '@google/genai';
import JSZip from 'jszip';

interface CodePreviewProps {
  output: { id: number; code: string };
  onCodeChange: (id: number, code: string) => void;
  fullResponse: string;
}

const P5_DOCS_MAP: Record<string, string> = {
  setup: 'https://p5js.org/reference/#/p5/setup',
  draw: 'https://p5js.org/reference/#/p5/draw',
  createCanvas: 'https://p5js.org/reference/#/p5/createCanvas',
  background: 'https://p5js.org/reference/#/p5/background',
  fill: 'https://p5js.org/reference/#/p5/fill',
  stroke: 'https://p5js.org/reference/#/p5/stroke',
  rect: 'https://p5js.org/reference/#/p5/rect',
  ellipse: 'https://p5js.org/reference/#/p5/ellipse',
};

const LIBRARIES = [
  { id: 'p5.sound', name: 'Sound', url: 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/addons/p5.sound.min.js' },
  { id: 'p5.play', name: 'Play v3', url: 'https://cdn.jsdelivr.net/npm/p5.play@3.1.0/dist/p5.play.js' },
  { id: 'p5.ascii', name: 'ASCII', url: 'https://cdn.jsdelivr.net/npm/p5.ascii@0.1.0/dist/p5.ascii.min.js' },
];

const CodePreview: React.FC<CodePreviewProps> = ({ output, onCodeChange, fullResponse }) => {
  const [view, setView] = useState<'preview' | 'code' | 'reasoning' | 'explain'>('preview');
  const [isCopied, setIsCopied] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [selectedLibs, setSelectedLibs] = useState<string[]>([]);
  const [sketchStatus, setSketchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [sketchError, setSketchError] = useState('');

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'SKETCH_STATUS' && e.data.id === output.id) {
        setSketchStatus(e.data.status);
        if (e.data.status === 'error') setSketchError(e.data.message);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [output.id]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output.code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleExplain = async () => {
    if (explanation) { setView('explain'); return; }
    setIsExplaining(true);
    setView('explain');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain this p5.js code clearly for a developer:\n\n${output.code}`
      });
      setExplanation(res.text || 'Explanation failed.');
    } catch {
      setExplanation('Error generating explanation.');
    } finally {
      setIsExplaining(false);
    }
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    zip.file('sketch.js', output.code);
    zip.file('style.css', `body{margin:0;padding:0;overflow:hidden;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;}canvas{display:block;box-shadow:0 0 50px rgba(0,0,0,0.5);border-radius:12px;}`);
    
    const libScripts = selectedLibs.map(id => `<script src="${LIBRARIES.find(l => l.id === id)?.url}"></script>`).join('\n');
    zip.file('index.html', `<!DOCTYPE html><html><head><script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>${libScripts}<link rel="stylesheet" href="style.css"></head><body><script src="sketch.js"></script></body></html>`);
    
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sketch-${output.id}.zip`;
    a.click();
  };

  const libScripts = selectedLibs.map(id => `<script src="${LIBRARIES.find(l => l.id === id)?.url}"></script>`).join('\n');
  const srcDoc = `
    <!DOCTYPE html><html><head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
    ${libScripts}
    <style>body{margin:0;padding:0;display:flex;justify-content:center;align-items:center;min-height:100vh;overflow:hidden;background:#f8fafc;}canvas{max-width:100%!important;height:auto!important;}</style>
    </head><body><script>
    const post = (s, m = '') => window.parent.postMessage({ type: 'SKETCH_STATUS', status: s, message: m, id: ${output.id} }, '*');
    window.onerror = (m) => post('error', m);
    try {
      post('loading');
      ${output.code.includes('setup') ? output.code : `function setup(){createCanvas(500,500);${output.code}}`}
      new p5();
      setTimeout(() => post('success'), 100);
    } catch(e) { post('error', e.message); }
    </script></body></html>
  `;

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[700px]">
      <div className="flex-1 overflow-hidden relative">
        {view === 'preview' && <iframe srcDoc={srcDoc} className="w-full h-full border-none" title="Sketch" />}
        {view === 'code' && (
          <Editor height="100%" defaultLanguage="javascript" value={output.code} onChange={v => onCodeChange(output.id, v || '')} theme="light" options={{ minimap: { enabled: false }, fontSize: 13, padding: { top: 20 } }} />
        )}
        {view === 'reasoning' && (
          <div className="p-8 h-full overflow-y-auto prose prose-slate prose-sm max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{fullResponse}</ReactMarkdown></div>
        )}
        {view === 'explain' && (
          <div className="p-8 h-full overflow-y-auto relative">
            {isExplaining ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80"><Loader2 className="animate-spin" /></div>
            ) : (
              /* Added a wrapper div to fix the missing className property error on ReactMarkdown component in TypeScript */
              <div className="text-sm font-medium leading-relaxed">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{explanation}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-3">
          <Library size={14} className="text-slate-400" />
          <div className="flex flex-wrap gap-2">
            {LIBRARIES.map(lib => (
              <button key={lib.id} onClick={() => setSelectedLibs(p => p.includes(lib.id) ? p.filter(i => i !== lib.id) : [...p, lib.id])} className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${selectedLibs.includes(lib.id) ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 border border-slate-200'}`}>{lib.name}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex bg-slate-200 p-1 rounded-full">
            <ToggleButton icon={Play} label="Run" isSelected={view === 'preview'} onClick={() => setView('preview')} />
            <ToggleButton icon={MessageCircle} label="Process" isSelected={view === 'reasoning'} onClick={() => setView('reasoning')} />
            <ToggleButton icon={Code2} label="Source" isSelected={view === 'code'} onClick={() => setView('code')} />
            <ToggleButton icon={BookOpen} label="Guide" isSelected={view === 'explain'} onClick={handleExplain} />
          </div>

          <div className="flex gap-2">
            <button onClick={handleCopy} className={`h-11 px-6 rounded-2xl text-xs font-bold transition-all border ${isCopied ? 'bg-black text-white' : 'bg-white text-slate-700'}`}>{isCopied ? <Check size={16} /> : <Copy size={16} />}</button>
            <button onClick={handleDownload} className="h-11 px-6 bg-white border border-slate-200 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"><Download size={16} /> Export</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodePreview;
