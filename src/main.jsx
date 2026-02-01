import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import * as LucideIcons from 'lucide-react';

/**
 * 人格实验室 (Persona Laboratory) - 集成单文件版
 * 修复了渲染挂载逻辑和图标导入方式
 */

const { 
  Play, Square, Download, Loader2, Gauge, Sparkles, User, Save, Key 
} = LucideIcons;

// 数据配置
const VOICES = [
  { id: 'Kore', name: 'Kore' },
  { id: 'Aoede', name: 'Aoede' },
  { id: 'Leda', name: 'Leda' },
  { id: 'Zephyr', name: 'Zephyr' },
  { id: 'Puck', name: 'Puck' },
  { id: 'Charon', name: 'Charon' },
  { id: 'Orus', name: 'Orus' },
  { id: 'Fenrir', name: 'Fenrir' },
];

const PERSONAS = [
  { id: 'default', name: '标准播报', prompt: 'Speak naturally and clearly.' },
  { id: 'storyteller', name: '深情讲书人', prompt: 'Speak like a professional audiobook narrator.' },
  { id: 'anchor', name: '带货主播', prompt: 'Speak like a high-energy live streamer.' },
  { id: 'professor', name: '老教授', prompt: 'Speak like a wise old professor.' },
];

function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('tts_gemini_api_key') || '');
  const [text, setText] = useState('欢迎来到人格实验室。请在右上角输入 API Key 后开始使用。');
  const [voice, setVoice] = useState('Kore');
  const [personaId, setPersonaId] = useState('default');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  const saveApiKey = () => {
    localStorage.setItem('tts_gemini_api_key', apiKey);
    alert("API Key 已保存");
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

  const generateAndPlay = async () => {
    if (!apiKey) { setError("请配置 API Key"); return; }
    setLoading(true); setError(null);
    if (audioRef.current) audioRef.current.pause();

    const currentPersona = PERSONAS.find(p => p.id === personaId).prompt;
    const finalPrompt = `Persona: ${currentPersona}. Speed: ${speed}x. Text: "${text}"`;
    
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
          }
        })
      });

      const result = await response.json();
      const audioData = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (!audioData) throw new Error("合成失败，请检查 Key 或网络");

      const binary = atob(audioData);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      
      const wavBlob = pcmToWav(new Int16Array(bytes.buffer), 24000);
      setLastAudioBlob(wavBlob);
      const audio = new Audio(URL.createObjectURL(wavBlob));
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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-slate-100 font-sans">
      <div className="max-w-md w-full bg-slate-800 rounded-[2.5rem] shadow-2xl border border-slate-700 overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Sparkles className="text-yellow-300" />
            <span>人格实验室</span>
          </div>
          <div className="flex items-center gap-2 bg-black/20 p-2 rounded-xl border border-white/10">
            <Key size={14} className="text-violet-300" />
            <input 
              type="password" value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              className="bg-transparent text-[10px] w-16 outline-none" 
              placeholder="Key"
            />
            <button onClick={saveApiKey}><Save size={14} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <div className="grid grid-cols-4 gap-2">
              {VOICES.map(v => (
                <button 
                  key={v.id} onClick={() => setVoice(v.id)}
                  className={`py-3 rounded-2xl border transition-all flex flex-col items-center gap-1 ${
                    voice === v.id ? 'border-violet-500 bg-violet-500/10' : 'bg-slate-700/50 border-transparent'
                  }`}
                >
                  <User size={14} className={voice === v.id ? 'text-violet-400' : 'text-slate-500'} />
                  <span className="text-[9px]">{v.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            {PERSONAS.map(p => (
              <button 
                key={p.id} onClick={() => setPersonaId(p.id)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold ${
                  personaId === p.id ? 'bg-violet-600' : 'bg-slate-700 text-slate-400'
                }`}
              >
                {p.name}
              </button>
            ))}
          </section>

          <textarea 
            className="w-full h-32 p-4 bg-slate-900/50 rounded-2xl text-sm border border-slate-700 outline-none focus:border-violet-500/50" 
            value={text} onChange={e => setText(e.target.value)}
          />

          {error && <div className="text-rose-400 text-[10px] text-center">{error}</div>}

          <button 
            onClick={generateAndPlay} disabled={loading}
            className="w-full bg-violet-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {loading ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            {loading ? '正在合成...' : '立即生成并播放'}
          </button>
        </div>
        <div className="pb-6 text-center">
          <p className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.4em]">Powered by Gemini 2.5 Flash</p>
        </div>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (container && !window._rootCreated) {
  const root = ReactDOM.createRoot(container);
  root.render(<App />);
  window._rootCreated = true;
}
