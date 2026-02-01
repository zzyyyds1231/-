import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Key, 
  Save, 
  User, 
  Gauge, 
  Loader2, 
  Play, 
  Square, 
  Volume2,
  Settings2,
  Type
} from 'lucide-react';

/**
 * Persona Laboratory - AI Text-to-Speech Experiment
 * 这是一个集成版组件，包含了所有的逻辑、样式和状态管理。
 * 兼容 Vite + React 环境。
 */

const VOICES = [
  { id: 'Kore', name: 'Kore' }, { id: 'Aoede', name: 'Aoede' },
  { id: 'Leda', name: 'Leda' }, { id: 'Zephyr', name: 'Zephyr' },
  { id: 'Puck', name: 'Puck' }, { id: 'Charon', name: 'Charon' },
  { id: 'Orus', name: 'Orus' }, { id: 'Fenrir', name: 'Fenrir' }
];

const PERSONAS = [
  { id: 'default', name: '标准播报', prompt: 'Speak naturally and clearly.' },
  { id: 'storyteller', name: '深情讲书人', prompt: 'Speak like a professional audiobook narrator. Use dramatic pauses.' },
  { id: 'anchor', name: '带货主播', prompt: 'Speak like a high-energy live streamer.' },
  { id: 'professor', name: '老教授', prompt: 'Speak like a wise old professor. Slow pace.' }
];

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [text, setText] = useState('欢迎来到人格实验室。请在上方配置 API Key 后开始。');
  const [voice, setVoice] = useState('Kore');
  const [personaId, setPersonaId] = useState('default');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  // 初始化加载 API Key
  useEffect(() => {
    const savedKey = localStorage.getItem('tts_gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveApiKey = () => {
    localStorage.setItem('tts_gemini_api_key', apiKey);
  };

  const pcmToWav = (pcmData, sampleRate) => {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 32 + pcmData.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); 
    view.setUint16(22, 1, true); 
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, pcmData.length * 2, true);
    for (let i = 0; i < pcmData.length; i++) view.setInt16(44 + i * 2, pcmData[i], true);
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError("请先输入 API Key 并保存");
      return;
    }
    setLoading(true);
    setError(null);

    const currentPersona = PERSONAS.find(p => p.id === personaId).prompt;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Persona: ${currentPersona}. Speed: ${speed}x. Content: "${text}"` }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
          }
        })
      });

      const result = await response.json();
      if (result.error) throw new Error(result.error.message);

      const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!audioPart) throw new Error("API 未返回音频数据，请检查配额或网络。");

      const binary = atob(audioPart.inlineData.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      const wavBlob = pcmToWav(new Int16Array(bytes.buffer), 24000);
      const url = URL.createObjectURL(wavBlob);
      
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4 text-white">
      <div className="w-full max-w-lg bg-[#1e293b] rounded-[2.5rem] shadow-2xl border border-slate-700/50 overflow-hidden">
        {/* Header */}
        <div className="p-8 bg-gradient-to-br from-indigo-600 to-violet-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Sparkles size={24} className="text-yellow-300" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">人格实验室</h1>
              <p className="text-[10px] opacity-70 uppercase tracking-widest">Persona Lab v2.5</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-black/20 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
            <Key size={14} className="text-indigo-300 ml-1" />
            <input 
              type="password" value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              className="bg-transparent text-xs w-24 outline-none placeholder:text-white/30" 
              placeholder="API KEY"
            />
            <button onClick={saveApiKey} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <Save size={14} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Voice Selector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Volume2 size={14} /> <span>选择人格音色</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {VOICES.map(v => (
                <button 
                  key={v.id} onClick={() => setVoice(v.id)}
                  className={`group py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                    voice === v.id ? 'border-indigo-500 bg-indigo-500/10' : 'bg-slate-800/50 border-transparent hover:bg-slate-800'
                  }`}
                >
                  <User size={16} className={voice === v.id ? 'text-indigo-400' : 'text-slate-600 group-hover:text-slate-400'} />
                  <span className={`text-[10px] font-bold ${voice === v.id ? 'text-white' : 'text-slate-500'}`}>{v.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Persona Injection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Settings2 size={14} /> <span>注入预设人格</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map(p => (
                <button 
                  key={p.id} onClick={() => setPersonaId(p.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    personaId === p.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Type size={14} /> <span>文本内容</span>
            </div>
            <div className="relative group">
              <textarea 
                className="w-full h-40 p-5 bg-slate-900/50 rounded-[2rem] text-sm border border-slate-700 outline-none focus:border-indigo-500/50 resize-none transition-all leading-relaxed" 
                value={text} onChange={e => setText(e.target.value)}
                placeholder="在此输入想要合成的文本..."
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-3 bg-[#1e293b] px-3 py-2 rounded-xl border border-slate-700 shadow-2xl">
                <Gauge size={14} className="text-indigo-400" />
                <input 
                  type="range" min="0.5" max="2.0" step="0.1" 
                  value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} 
                  className="w-16 h-1 accent-indigo-500 cursor-pointer" 
                />
                <span className="text-[10px] font-mono text-slate-400 w-8">{speed.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[11px] leading-relaxed">
              <strong>发生错误：</strong> {error}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3">
            <button 
              onClick={handleGenerate} disabled={loading}
              className="flex-[4] bg-indigo-600 hover:bg-indigo-500 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-indigo-600/20"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {loading ? '正在解析人格...' : '立即生成并播放'}
            </button>
            
            {isPlaying && (
              <button 
                onClick={() => { if(audioRef.current) audioRef.current.pause(); setIsPlaying(false); }}
                className="flex-1 bg-rose-600 hover:bg-rose-500 rounded-2xl flex items-center justify-center animate-pulse shadow-xl shadow-rose-600/20"
              >
                <Square size={20} fill="currentColor" />
              </button>
            )}
          </div>
        </div>

        <div className="pb-8 text-center">
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.5em] opacity-50">Powered by Gemini 2.5 Flash</p>
        </div>
      </div>
    </div>
  );
}
