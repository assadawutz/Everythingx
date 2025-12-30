
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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

const P5_DOCS_MAP = {
  setup: 'https://p5js.org/reference/#/p5/setup',
  draw: 'https://p5js.org/reference/#/p5/draw',
  createCanvas: 'https://p5js.org/reference/#/p5/createCanvas',
  background: 'https://p5js.org/reference/#/p5/background',
  fill: 'https://p5js.org/reference/#/p5/fill',
  stroke: 'https://p5js.org/reference/#/p5/stroke',
  noStroke: 'https://p5js.org/reference/#/p5/noStroke',
  noFill: 'https://p5js.org/reference/#/p5/noFill',
  rect: 'https://p5js.org/reference/#/p5/rect',
  ellipse: 'https://p5js.org/reference/#/p5/ellipse',
  line: 'https://p5js.org/reference/#/p5/line',
  triangle: 'https://p5js.org/reference/#/p5/triangle',
  random: 'https://p5js.org/reference/#/p5/random',
  noise: 'https://p5js.org/reference/#/p5/noise',
  translate: 'https://p5js.org/reference/#/p5/translate',
  rotate: 'https://p5js.org/reference/#/p5/rotate',
  scale: 'https://p5js.org/reference/#/p5/scale',
  push: 'https://p5js.org/reference/#/p5/push',
  pop: 'https://p5js.org/reference/#/p5/pop',
  map: 'https://p5js.org/reference/#/p5/map',
  dist: 'https://p5js.org/reference/#/p5/dist',
  lerp: 'https://p5js.org/reference/#/p5/lerp',
  colorMode: 'https://p5js.org/reference/#/p5/colorMode',
  beginShape: 'https://p5js.org/reference/#/p5/beginShape',
  endShape: 'https://p5js.org/reference/#/p5/endShape',
  vertex: 'https://p5js.org/reference/#/p5/vertex',
  filter: 'https://p5js.org/reference/#/p5/filter',
  image: 'https://p5js.org/reference/#/p5/image',
};

const AVAILABLE_LIBRARIES = [
  { id: 'p5.sound', name: 'p5.sound', url: 'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/addons/p5.sound.min.js' },
  { id: 'p5.play', name: 'p5.play (v3)', url: 'https://cdn.jsdelivr.net/npm/p5.play@3.1.0/dist/p5.play.js' },
  { id: 'p5.ascii', name: 'p5.ascii', url: 'https://cdn.jsdelivr.net/npm/p5.ascii@0.1.0/dist/p5.ascii.min.js' },
];

const CodePreview = (props) => {
  const { output, onCodeChange, fullResponse } = props;
  const [showCode, setShowCode] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [detectedDocs, setDetectedDocs] = useState([]);
  const [selectedLibraries, setSelectedLibraries] = useState([]);

  // Editor Settings State
  const [editorSettings, setEditorSettings] = useState({
    lineNumbers: false,
    fontSize: 12,
  });

  // Sketch status state
  const [sketchStatus, setSketchStatus] = useState('idle'); // idle, loading, success, error
  const [sketchError, setSketchError] = useState('');

  // Listen for messages from the iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data?.type === 'SKETCH_STATUS') {
        const { status, message, id } = event.data;
        // Ensure the message is from the correct output instance
        if (id === output.id) {
          setSketchStatus(status);
          if (status === 'error') {
            setSketchError(message || 'Unknown execution error');
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [output.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output.code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const extractDocLinks = (text) => {
    const found = [];
    Object.keys(P5_DOCS_MAP).forEach((key) => {
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${key}\\b`, 'i');
      if (regex.test(text) || regex.test(output.code)) {
        found.push({ name: key, url: P5_DOCS_MAP[key] });
      }
    });
    return found;
  };

  const handleExplain = async () => {
    if (explanation) {
      setShowExplanation(true);
      setShowCode(false);
      setShowReasoning(false);
      return;
    }

    setIsExplaining(true);
    setShowExplanation(true);
    setShowCode(false);
    setShowReasoning(false);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          {
            parts: [
              {
                text: `You are a friendly coding teacher. Explain the following p5.js code in a simple and educational way. 
            Break down the key concepts, algorithms, and how the interactivity works.
            
            CODE:
            ${output.code}`,
              },
            ],
          },
        ],
      });
      const text = response.text || 'Could not generate explanation.';
      setExplanation(text);
      setDetectedDocs(extractDocLinks(text));
    } catch (error) {
      console.error('Explanation error:', error);
      setExplanation('Failed to generate explanation. Please try again.');
    } finally {
      setIsExplaining(false);
    }
  };

  const toggleLibrary = (libId) => {
    setSelectedLibraries(prev => 
      prev.includes(libId) ? prev.filter(id => id !== libId) : [...prev, libId]
    );
  };

  const handleDownload = async () => {
    const zip = new JSZip();
    const codeString = output?.code || '';

    // sketch.js
    zip.file('sketch.js', codeString);

    // style.css
    zip.file(
      'style.css',
      `
body {
  padding: 0;
  margin: 0;
  background: #f8fafc;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}
canvas {
  display: block;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border-radius: 12px;
}
    `,
    );

    const libScripts = selectedLibraries
      .map(id => AVAILABLE_LIBRARIES.find(l => l.id === id))
      .filter(Boolean)
      .map(lib => `<script src="${lib.url}"></script>`)
      .join('\n  ');

    // index.html
    zip.file(
      'index.html',
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>p5.js Sketch</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
  ${libScripts}
  <link rel="stylesheet" type="text/css" href="style.css">
</head>
<body>
  <script src="sketch.js"></script>
</body>
</html>`,
    );

    try {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `p5-sketch-${output.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Zip generation failed:', error);
    }
  };

  const renderSketch = (code) => {
    const codeString = typeof code === 'string' ? code : code.toString();
    const wrappedCode = codeString.includes('function setup()')
      ? codeString
      : `
      function setup() {
        createCanvas(500, 500);
        ${codeString}
      }

      function draw() {
        if (typeof window.draw !== 'function') {
          window.draw = function() {};
        }
      }
    `;

    const libScripts = selectedLibraries
      .map(id => AVAILABLE_LIBRARIES.find(l => l.id === id))
      .filter(Boolean)
      .map(lib => `<script src="${lib.url}"></script>`)
      .join('\n        ');

    const formattedCodeResponse = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.js"></script>
        ${libScripts}
        <title>p5.js Sketch</title>
        <style>
          body {
            padding: 0;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            overflow: hidden;
          }
          canvas {
            max-width: 100% !important;
            height: auto !important;
          }
        </style>
      </head>
      <body>
        <script>
          const postStatus = (status, message = '') => {
            window.parent.postMessage({ type: 'SKETCH_STATUS', status, message, id: ${output.id} }, '*');
          };

          window.onerror = function(message, source, lineno, colno, error) {
            postStatus('error', message);
            document.body.innerHTML = '<div style="color: red; padding: 20px;"><h3>🔴 Error:</h3><pre>' + message + '</pre></div>';
          };

          try {
            postStatus('loading');
            ${wrappedCode}
            if (typeof window.setup === 'function') {
              new p5();
              // Small delay to ensure setup completes
              setTimeout(() => postStatus('success'), 100);
            } else {
               postStatus('error', 'No setup() function found.');
            }
          } catch (error) {
            console.error('Sketch error:', error);
            postStatus('error', error.message);
            document.body.innerHTML = '<div style="color: red; padding: 20px;"><h3>🔴 Error:</h3><pre>' + error.message + '</pre></div>';
          }
        </script>
      </body>
      </html>
    `;

    return (
      <div className="relative w-full h-[500px] bg-gray-50 rounded-lg overflow-hidden">
        <iframe
          srcDoc={formattedCodeResponse}
          title="p5.js Sketch"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
          className="absolute inset-0"
        />
      </div>
    );
  };

  const sketchCode = output?.code || '';

  const renderStatusIndicator = () => {
    switch (sketchStatus) {
      case 'loading':
        return (
          <div className="flex items-center gap-1.5 ml-1 animate-pulse text-blue-600">
            <Loader2 className="animate-spin" size={12} />
            <span className="text-[10px] font-bold uppercase tracking-tight">Running...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center ml-1 text-green-600" title="Sketch loaded successfully">
            <Check size={14} strokeWidth={3} />
          </div>
        );
      case 'error':
        return (
          <div
            className="flex items-center ml-1 text-red-600 group relative cursor-help"
            title={sketchError}
          >
            <AlertCircle size={14} strokeWidth={3} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-red-900 text-white text-[10px] rounded shadow-xl whitespace-pre-wrap max-w-[200px] z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-red-800">
              <div className="font-bold mb-1 border-b border-red-700 pb-1">Sketch Runtime Error</div>
              {sketchError}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mb-4 p-6 rounded-3xl bg-gray-100 shadow-sm border border-gray-200/50">
      <div className="mb-4">
        {showCode ? (
          <div className="w-full h-[500px] rounded-lg overflow-hidden border flex flex-col">
            {/* Editor Controls Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 size={10} /> Monaco Editor Settings
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    setEditorSettings((s) => ({ ...s, lineNumbers: !s.lineNumbers }))
                  }
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-all ${
                    editorSettings.lineNumbers
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
                  }`}
                  title="Toggle Line Numbers"
                >
                  <Hash size={10} />
                  Lines: {editorSettings.lineNumbers ? 'On' : 'Off'}
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                    <Type size={10} /> Size
                  </span>
                  <select
                    value={editorSettings.fontSize}
                    onChange={(e) =>
                      setEditorSettings((s) => ({ ...s, fontSize: parseInt(e.target.value) }))
                    }
                    className="text-[10px] p-0.5 border rounded bg-white outline-none cursor-pointer border-gray-200"
                  >
                    {[10, 12, 14, 16, 18, 20, 24].map((s) => (
                      <option key={s} value={s}>
                        {s}px
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                defaultLanguage="javascript"
                value={sketchCode}
                onChange={(value) => {
                  onCodeChange(output.id, value);
                  setSketchStatus('idle'); // Reset status when code is edited
                }}
                theme="light"
                options={{
                  minimap: { enabled: false },
                  fontSize: editorSettings.fontSize,
                  lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  padding: { top: 8, bottom: 8 },
                }}
              />
            </div>
          </div>
        ) : showReasoning ? (
          <div className="w-full h-[500px] rounded-lg overflow-y-auto border p-4 prose prose-xs max-w-none bg-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]} className="text-xs text-gray-700">
              {fullResponse}
            </ReactMarkdown>
          </div>
        ) : showExplanation ? (
          <div className="w-full h-[500px] rounded-lg overflow-y-auto border p-6 prose prose-sm max-w-none bg-white relative flex flex-col">
            {isExplaining ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-3 z-10">
                <Loader2 className="animate-spin text-blue-500" size={32} />
                <p className="text-sm font-medium text-gray-500">Generating teacher explanation...</p>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} className="text-sm text-gray-700">
                    {explanation}
                  </ReactMarkdown>
                </div>
                {detectedDocs.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <BookOpen size={10} /> Relevant p5.js Reference
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {detectedDocs.map((doc, idx) => (
                        <a
                          key={idx}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[11px] font-semibold hover:bg-blue-100 transition-colors border border-blue-100/50"
                        >
                          {doc.name}()
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          renderSketch(sketchCode)
        )}
      </div>

      {/* Library Selection Bar */}
      <div className="mb-4 px-1">
        <div className="flex items-center gap-3 bg-white/50 p-2 rounded-2xl border border-gray-200">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5 px-2 border-r pr-3">
            <Library size={12} /> Addons
          </div>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_LIBRARIES.map(lib => (
              <button
                key={lib.id}
                onClick={() => toggleLibrary(lib.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all border ${
                  selectedLibraries.includes(lib.id)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {lib.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-2">
        <div className="inline-flex rounded-full bg-gray-200 p-1 w-full sm:w-auto justify-center overflow-x-auto no-scrollbar">
          <ToggleButton
            icon={Play}
            label={
              <div className="flex items-center">
                Preview
                {renderStatusIndicator()}
              </div>
            }
            isSelected={!showCode && !showReasoning && !showExplanation}
            onClick={() => {
              setShowCode(false);
              setShowReasoning(false);
              setShowExplanation(false);
            }}
          />
          <ToggleButton
            icon={MessageCircle}
            label="Reasoning"
            isSelected={showReasoning}
            onClick={() => {
              setShowCode(false);
              setShowReasoning(true);
              setShowExplanation(false);
            }}
          />
          <ToggleButton
            icon={Code2}
            label="Code"
            isSelected={showCode}
            onClick={() => {
              setShowCode(true);
              setShowReasoning(false);
              setShowExplanation(false);
            }}
          />
          <ToggleButton
            icon={BookOpen}
            label="Explain"
            isSelected={showExplanation}
            onClick={handleExplain}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-full transition-colors inline-flex text-sm border border-gray-300
              items-center gap-1 justify-center ${
                isCopied
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
          >
            {isCopied ? (
              <>
                <Check size={14} />
                Copied!
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-full bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 transition-colors inline-flex text-sm items-center gap-1 justify-center"
          >
            <Download size={14} />
            Download ZIP
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodePreview;
