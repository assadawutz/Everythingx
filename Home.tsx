
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality, GenerateContentResponse } from '@google/genai';
import {
  Upload,
  MessageSquare,
  Code,
  Image as ImageIcon,
  Video,
  Mic,
  BrainCircuit,
  Settings,
  Plus,
  Camera,
  X,
  ChevronDown,
  ChevronUp,
  Globe,
  MapPin,
  Zap,
  Sparkles,
  Edit3,
  ExternalLink,
  Send,
  Loader2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import CodePreview from './components/CodePreview';
import ErrorModal from './components/ErrorModal';
import Header from './components/Header';

// Model Constants
const MODEL_PRO = 'gemini-3-pro-preview';
const MODEL_LITE = 'gemini-2.5-flash-lite-latest';
const MODEL_IMAGE_PRO = 'gemini-3-pro-image-preview';
const MODEL_IMAGE_EDIT = 'gemini-2.5-flash-image';
const MODEL_VEO = 'veo-3.1-fast-generate-preview';
const MODEL_LIVE = 'gemini-2.5-flash-native-audio-preview-09-2025';

type Tab = 'sketch' | 'chat' | 'media' | 'live';
type PerformanceMode = 'lite' | 'pro';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  grounding?: any[];
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('sketch');
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('pro');
  const [imageBase64, setImageBase64] = useState<string>('');
  const [outputs, setOutputs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [concurrentRequests, setConcurrentRequests] = useState(3);
  const [prompt, setPrompt] = useState('');
  const [errorInfo, setErrorInfo] = useState<any>(null);
  const [userInput, setUserInput] = useState('');
  const [thinkingMode, setThinkingMode] = useState(true);

  // Advanced Config
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(1);
  const [topK, setTopK] = useState(64);
  const [topP, setTopP] = useState(0.95);

  // Grounding
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);

  // Camera
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Media Lab
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'edit'>('image');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('1K');
  const [generatedMedia, setGeneratedMedia] = useState<any[]>([]);

  // Live API
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const defaultPrompt = `You are a world-class p5.js educator. Create high-quality, interactive, and aesthetically pleasing code sketches based on images. Ensure the code is clean, documented, and utilizes modern JavaScript.`;
    const savedPrompt = localStorage.getItem('savedPrompt');
    setPrompt(savedPrompt || defaultPrompt);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
        setImageBase64(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOpen(true);
      }
    } catch (err) {
      setErrorInfo({ message: "Camera access denied. Please check permissions." });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setImageBase64(canvas.toDataURL('image/jpeg'));
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setIsCameraOpen(false);
    }
  };

  const getModel = () => (performanceMode === 'pro' ? MODEL_PRO : MODEL_LITE);

  const generateCode = async () => {
    if (!imageBase64) return;
    setLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const reqs = Array(concurrentRequests).fill(null).map(async () => {
        const config: any = { temperature, topK, topP };
        if (performanceMode === 'pro' && thinkingMode) {
          config.thinkingConfig = { thinkingBudget: 32768 };
        }

        const res = await ai.models.generateContent({
          model: getModel(),
          contents: {
            parts: [
              { text: `${prompt}\n\nInstructions: ${userInput}` },
              { inlineData: { data: imageBase64.split(',')[1], mimeType: 'image/jpeg' } }
            ]
          },
          config
        });
        
        const text = res.text || '';
        const match = /```(?:javascript|js)?\s*([\s\S]*?)```/g.exec(text);
        return { code: match ? match[1].trim() : text, fullResponse: text };
      });

      const results = await Promise.all(reqs);
      setOutputs(results.map((r, i) => ({ id: Date.now() + i, ...r })));
    } catch (e) {
      setErrorInfo(e);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async () => {
    if (!userInput.trim()) return;
    const msg = userInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setUserInput('');
    setLoading(true);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const tools: any[] = [];
      if (useSearch) tools.push({ googleSearch: {} });
      if (useMaps) tools.push({ googleMaps: {} });

      const config: any = { 
        temperature, topK, topP, tools: tools.length > 0 ? tools : undefined 
      };
      
      if (performanceMode === 'pro' && thinkingMode && !useMaps) {
        config.thinkingConfig = { thinkingBudget: 32768 };
      }

      const res = await ai.models.generateContent({
        model: useMaps ? 'gemini-2.5-flash' : getModel(),
        contents: msg,
        config
      });

      const grounding = res.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web || c.maps).filter(Boolean);
      setChatMessages(prev => [...prev, { role: 'assistant', content: res.text || '', grounding }]);
    } catch (e) {
      setErrorInfo(e);
    } finally {
      setLoading(false);
    }
  };

  const generateMedia = async () => {
    setLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      if (mediaType === 'image') {
        const res = await ai.models.generateContent({
          model: MODEL_IMAGE_PRO,
          contents: {
            parts: [
              { text: userInput },
              ...(imageBase64 ? [{ inlineData: { data: imageBase64.split(',')[1], mimeType: 'image/jpeg' } }] : [])
            ]
          },
          config: { imageConfig: { aspectRatio: aspectRatio as any, imageSize: imageSize as any } }
        });
        const part = res.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) setGeneratedMedia(prev => [{ type: 'image', url: `data:image/png;base64,${part.inlineData?.data}` }, ...prev]);
      } else if (mediaType === 'edit') {
        const res = await ai.models.generateContent({
          model: MODEL_IMAGE_EDIT,
          contents: {
            parts: [
              { inlineData: { data: imageBase64.split(',')[1], mimeType: 'image/jpeg' } },
              { text: userInput }
            ]
          }
        });
        const part = res.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) setGeneratedMedia(prev => [{ type: 'image', url: `data:image/png;base64,${part.inlineData?.data}` }, ...prev]);
      } else {
        const op = await ai.models.generateVideos({
          model: MODEL_VEO,
          prompt: userInput,
          config: { aspectRatio: aspectRatio as any, resolution: '720p' }
        });
        let res = op;
        while (!res.done) {
          await new Promise(r => setTimeout(r, 5000));
          res = await ai.operations.getVideosOperation({ operation: res });
        }
        const uri = res.response?.generatedVideos?.[0]?.video?.uri;
        const vid = await fetch(`${uri}&key=${process.env.API_KEY}`);
        const blob = await vid.blob();
        setGeneratedMedia(prev => [{ type: 'video', url: URL.createObjectURL(blob) }, ...prev]);
      }
    } catch (e) {
      setErrorInfo(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleLive = async () => {
    if (isLiveActive) {
      liveSessionRef.current?.close();
      setIsLiveActive(false);
      return;
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const session = await ai.live.connect({
        model: MODEL_LIVE,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        },
        callbacks: {
          onopen: () => setIsLiveActive(true),
          onmessage: async (m) => {
            const data = m.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (data && audioContextRef.current) {
              const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
              const int16 = new Int16Array(bytes.buffer);
              const buffer = audioContextRef.current.createBuffer(1, int16.length, 24000);
              const channel = buffer.getChannelData(0);
              for (let i = 0; i < int16.length; i++) channel[i] = int16[i] / 32768.0;
              const source = audioContextRef.current.createBufferSource();
              source.buffer = buffer;
              source.connect(audioContextRef.current.destination);
              source.start();
            }
          },
          onclose: () => setIsLiveActive(false),
          onerror: (e) => setErrorInfo(e)
        }
      });
      liveSessionRef.current = session;
    } catch (e) {
      setErrorInfo(e);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <ErrorModal isOpen={!!errorInfo} onClose={() => setErrorInfo(null)} errorInfo={errorInfo} />

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-20 md:w-64 border-r bg-white flex flex-col p-4 gap-4 shadow-sm z-10">
          <div className="space-y-1">
            {[
              { id: 'sketch', icon: Code, label: 'Generator' },
              { id: 'chat', icon: MessageSquare, label: 'Intelligence' },
              { id: 'media', icon: ImageIcon, label: 'Studio' },
              { id: 'live', icon: Mic, label: 'Voice' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as Tab)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all duration-200 ${
                  activeTab === t.id ? 'bg-black text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <t.icon size={22} strokeWidth={2.5} />
                <span className="hidden md:block font-bold text-sm">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-auto space-y-6 pt-6 border-t">
            <div className="bg-slate-50 p-2 rounded-2xl flex">
              <button 
                onClick={() => setPerformanceMode('lite')}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all ${performanceMode === 'lite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                <Zap size={14} />
                <span className="text-[10px] font-black uppercase">Lite</span>
              </button>
              <button 
                onClick={() => setPerformanceMode('pro')}
                className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all ${performanceMode === 'pro' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-400'}`}
              >
                <Sparkles size={14} />
                <span className="text-[10px] font-black uppercase">Pro</span>
              </button>
            </div>

            <button
              onClick={() => setThinkingMode(!thinkingMode)}
              disabled={performanceMode === 'lite'}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                thinkingMode && performanceMode === 'pro' ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-transparent text-slate-400 opacity-50'
              }`}
            >
              <BrainCircuit size={20} className={thinkingMode ? 'animate-pulse' : ''} />
              <div className="hidden md:block text-left">
                <p className="text-[10px] font-black uppercase leading-none mb-1 tracking-wider">Thinking</p>
                <p className="text-[9px] font-bold opacity-70 leading-none">{thinkingMode ? 'High Precision' : 'Standard'}</p>
              </div>
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 bg-slate-50 overflow-y-auto p-4 md:p-10 relative">
          <div className="max-w-6xl mx-auto w-full">
            {activeTab === 'sketch' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <section className="space-y-8">
                  <div className="group relative">
                    <div 
                      {...getRootProps()}
                      className={`h-[400px] border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center bg-white transition-all duration-500 overflow-hidden ${
                        isDragActive ? 'border-blue-500 bg-blue-50 scale-105' : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <input {...getInputProps()} />
                      {isCameraOpen ? (
                        <div className="relative w-full h-full flex flex-col items-center bg-black">
                          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                          <div className="absolute bottom-8 flex gap-6">
                            <button onClick={e => { e.stopPropagation(); capturePhoto(); }} className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110"><Camera size={30} /></button>
                            <button onClick={e => { e.stopPropagation(); setIsCameraOpen(false); }} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-transform hover:scale-110"><X size={30} /></button>
                          </div>
                        </div>
                      ) : imageBase64 ? (
                        <img src={imageBase64} className="w-full h-full object-contain p-4" alt="Input" />
                      ) : (
                        <div className="text-center px-10">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6"><Upload className="text-slate-300" size={32} /></div>
                          <h2 className="text-xl font-black mb-2 tracking-tight">Drop your vision here</h2>
                          <p className="text-slate-400 text-sm mb-8 font-medium">Upload an image to transform it into a p5.js sketch</p>
                          <button onClick={e => { e.stopPropagation(); startCamera(); }} className="px-8 py-3 bg-black text-white rounded-full font-bold text-sm transition-all hover:scale-105 shadow-xl">Use Camera</button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <textarea 
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      placeholder="Add specific directives (e.g., 'Make it reactive to sound')"
                      className="w-full p-6 bg-white border border-slate-100 rounded-[32px] shadow-sm focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all outline-none min-h-[140px] text-sm font-medium"
                    />
                    
                    <button
                      onClick={generateCode}
                      disabled={loading || !imageBase64}
                      className="w-full h-16 bg-black text-white rounded-[24px] font-black text-lg transition-all hover:bg-slate-800 disabled:opacity-20 shadow-2xl shadow-black/10 flex items-center justify-center gap-3"
                    >
                      {loading ? <Loader2 className="animate-spin" /> : <Plus size={24} />}
                      {loading ? 'Thinking...' : 'Generate Code Sketch'}
                    </button>
                  </div>
                </section>

                <section className="space-y-8">
                  {outputs.length > 0 ? outputs.map(out => (
                    <CodePreview key={out.id} output={out} onCodeChange={(id, code) => setOutputs(o => o.map(x => x.id === id ? {...x, code} : x))} fullResponse={out.fullResponse} />
                  )) : (
                    <div className="h-full min-h-[600px] border-4 border-dashed border-slate-100 rounded-[40px] flex flex-col items-center justify-center text-slate-200">
                      <Code size={64} className="mb-6 opacity-20" />
                      <p className="font-black uppercase tracking-[0.3em] text-[10px]">Preview Workspace</p>
                    </div>
                  )}
                </section>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-[calc(100vh-200px)] bg-white rounded-[40px] shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-500">
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-200">
                      <MessageSquare size={64} className="mb-4 opacity-10" />
                      <p className="font-bold uppercase tracking-widest text-xs">Awaiting input</p>
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[85%] p-5 rounded-[28px] ${m.role === 'user' ? 'bg-black text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                        <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                        {m.grounding && m.grounding.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-200/50 flex flex-wrap gap-2">
                            {m.grounding.map((g, idx) => (
                              <a key={idx} href={g.uri} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-100 text-[10px] font-black uppercase text-blue-600 hover:shadow-sm transition-all">
                                <Globe size={10} /> {g.title || 'Source'}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-6 border-t border-slate-50 bg-white">
                  <div className="flex items-center gap-3 mb-4 bg-slate-50 p-2 rounded-2xl w-fit">
                    <button onClick={() => setUseSearch(!useSearch)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${useSearch ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Search</button>
                    <button onClick={() => setUseMaps(!useMaps)} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${useMaps ? 'bg-green-600 text-white' : 'text-slate-400'}`}>Maps</button>
                  </div>
                  <div className="flex gap-4">
                    <textarea 
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => { 
                        // Submit on Enter, Shift+Enter for new line
                        if (e.key === 'Enter' && !e.shiftKey) { 
                          e.preventDefault(); 
                          handleChat(); 
                        } 
                      }}
                      placeholder="Consult Gemini..."
                      rows={1}
                      className="flex-1 p-5 bg-slate-50 rounded-[24px] outline-none focus:bg-white focus:ring-2 focus:ring-black/5 transition-all text-sm font-medium resize-none min-h-[64px] max-h-40"
                    />
                    <button onClick={handleChat} disabled={loading || !userInput.trim()} className="w-14 h-14 bg-black text-white rounded-2xl flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all">
                      {loading ? <Loader2 className="animate-spin" /> : <Send size={20} />}
                    </button>
                  </div>
                  <div className="flex justify-end px-2 mt-2">
                    <span className="text-[9px] font-black uppercase text-slate-300 tracking-[0.2em]">{userInput.length} Characters</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-10 animate-in fade-in duration-700">
                <div className="bg-white p-10 rounded-[48px] shadow-2xl border border-slate-50 flex flex-col lg:flex-row gap-12">
                  <div className="flex-1 space-y-8">
                    <div className="flex p-1.5 bg-slate-100 rounded-[28px]">
                      {['image', 'edit', 'video'].map(t => (
                        <button key={t} onClick={() => setMediaType(t as any)} className={`flex-1 py-4 rounded-[22px] text-xs font-black uppercase transition-all ${mediaType === t ? 'bg-white text-black shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                      ))}
                    </div>
                    <textarea value={userInput} onChange={e => setUserInput(e.target.value)} placeholder="Describe your creation..." className="w-full p-6 bg-slate-50 rounded-[32px] outline-none min-h-[140px] text-sm font-medium" />
                    <button onClick={generateMedia} disabled={loading} className="w-full h-16 bg-black text-white rounded-[24px] font-black text-lg transition-all hover:scale-[1.01] shadow-xl">{loading ? 'Synthesizing...' : 'Generate Asset'}</button>
                  </div>
                  <div className="w-full lg:w-72 space-y-4">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-center">Reference Frame</p>
                    <div {...getRootProps()} className="aspect-square rounded-[40px] border-4 border-dashed border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer">
                      <input {...getInputProps()} />
                      {imageBase64 ? <img src={imageBase64} className="w-full h-full object-cover" /> : <ImageIcon size={40} className="text-slate-200" />}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {generatedMedia.map((m, i) => (
                    <div key={i} className="bg-white p-4 rounded-[40px] shadow-lg border border-slate-50 animate-in zoom-in-95">
                      {m.type === 'image' ? <img src={m.url} className="w-full h-[400px] object-cover rounded-[32px]" /> : <video src={m.url} controls className="w-full h-[400px] object-cover rounded-[32px]" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'live' && (
              <div className="flex flex-col items-center justify-center min-h-[600px] space-y-12 animate-in fade-in duration-1000">
                <div className={`w-80 h-80 rounded-[100px] flex items-center justify-center transition-all duration-700 shadow-2xl relative ${isLiveActive ? 'bg-blue-600 scale-110 shadow-blue-500/40' : 'bg-white'}`}>
                  <Mic size={100} className={`z-10 transition-colors ${isLiveActive ? 'text-white' : 'text-slate-100'}`} />
                  {isLiveActive && <div className="absolute inset-0 rounded-[100px] border-4 border-blue-400 animate-ping opacity-20" />}
                </div>
                <div className="text-center">
                  <h2 className="text-4xl font-black mb-4 tracking-tighter">{isLiveActive ? 'Listening...' : 'Native Audio'}</h2>
                  <p className="text-slate-400 max-w-sm mx-auto mb-10 font-medium">Real-time voice synthesis and comprehension for an immersive AI dialogue.</p>
                  <button onClick={toggleLive} className={`px-20 py-5 rounded-[24px] font-black text-xl transition-all ${isLiveActive ? 'bg-red-500 text-white' : 'bg-black text-white shadow-2xl hover:scale-105'}`}>{isLiveActive ? 'End Session' : 'Start Dialogue'}</button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
