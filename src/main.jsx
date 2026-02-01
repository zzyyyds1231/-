import React, { useState, useRef, useEffect } from 'react';
import * as ReactDOMClient from 'react-dom/client';
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
 * 人格实验室 (Persona Lab) - 核心单文件版本
 * 提示：请直接将此代码覆盖 src/main.jsx
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

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('tts_gemini_api_key') || '');
  const [text, setText] = useState('欢迎来到人格实验室。请在上方输入 API Key 后开始。');
  const [voice, setVoice] = useState('Kore');
  const [personaId, setPersonaId] = useState('default');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const saveApiKey = () => {
    localStorage.setItem('tts_gemini_api_key', apiKey);
    const notice = document.createElement('div');
    notice.className = "fixed top-5 right-5 bg-green-500 text-white px-4 py-2 rounded-xl shadow-2xl z-50";
    notice.innerText = "Key 已保存";
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 2000);
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
      if (!audioPart) throw new Error("未接收到音频，请检查 API Key 是否有效。");

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
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4 text-white font-sans">
      <div className="w-full max-w-xl bg-[#0f172a] rounded-[3rem] shadow-2xl border border-slate-800/50 overflow-hidden">
        
        {/* Header */}
        <div className="p-8 bg-gradient-to-br from-indigo-600/20 to-violet-600/20 flex justify-between items-center border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-2xl">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight">Persona Lab</h1>
              <p className="text-[10px] text-indigo-400 font-bold tracking-widest">GEMINI TTS ENGINE</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-black/40 p-2 rounded-2xl border border-white/5">
            <Key size={14} className="text-indigo-400 ml-2" />
            <input 
              type="password" value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              className="bg-transparent text-[11px] w-32 outline-none" 
              placeholder="API KEY"
            />
            <button 
              onClick={saveApiKey} 
              className="bg-indigo-600 hover:bg-indigo-500 p-2 rounded-xl transition-all"
            >
              <Save size={14} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Voices */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Volume2 size={14} /> 选择角色
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {VOICES.map(v => (
                <button 
                  key={v.id} onClick={() => setVoice(v.id)}
                  className={`py-4 rounded-3xl border transition-all flex flex-col items-center gap-2 ${
                    voice === v.id ? 'border-indigo-500 bg-indigo-500/10' : 'bg-slate-900 border-transparent hover:bg-slate-800'
                  }`}
                >
                  <User size={18} className={voice === v.id ? 'text-indigo-400' : 'text-slate-700'} />
                  <span className="text-[11px] font-bold">{v.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Personas */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Settings2 size={14} /> 注入人格
            </h2>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map(p => (
                <button 
                  key={p.id} onClick={() => setPersonaId(p.id)}
                  className={`px-5 py-2.5 rounded-2xl text-[11px] font-black transition-all ${
                    personaId === p.id ? 'bg-white text-black' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
              <Type size={14} /> 文本内容
            </h2>
            <div className="relative">
              <textarea 
                className="w-full h-44 p-6 bg-black/40 rounded-[2.5rem] text-sm border border-slate-800 outline-none focus:border-indigo-500/50 resize-none leading-relaxed" 
                value={text} 
                onChange={e => setText(e.target.value)}
              />
              <div className="absolute bottom-5 right-6 flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
                <Gauge size={14} className="text-indigo-400" />
                <input 
                  type="range" min="0.5" max="2.0" step="0.1" 
                  value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} 
                  className="w-16 accent-indigo-500" 
                />
                <span className="text-[10px] font-mono text-indigo-400">{speed.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[11px]">
              错误: {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button 
              onClick={handleGenerate} disabled={loading}
              className="flex-[5] bg-white hover:bg-indigo-50 text-black py-6 rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              <span>{loading ? '合成中...' : '开始人格合成'}</span>
            </button>
            
            {isPlaying && (
              <button 
                onClick={() => { if(audioRef.current) audioRef.current.pause(); setIsPlaying(false); }}
                className="flex-1 bg-rose-500 rounded-[2rem] flex items-center justify-center animate-pulse"
              >
                <Square size={20} fill="currentColor" className="text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOMClient.createRoot(document.getElementById('root'));
root.render(<App />);是这个吗，有没有错误
