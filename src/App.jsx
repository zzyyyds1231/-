import React, { useState, useRef } from 'react';
import { Play, Square, Download, Loader2, Gauge, Sparkles, User, Save, Key } from 'lucide-react';

const VOICES = [
  { id: 'Kore', name: 'Kore', desc: '清亮女声' },
  { id: 'Aoede', name: 'Aoede', desc: '温柔女声' },
  { id: 'Leda', name: 'Leda', desc: '成熟女声' },
  { id: 'Zephyr', name: 'Zephyr', desc: '阳光男声' },
  { id: 'Puck', name: 'Puck', desc: '活力男声' },
  { id: 'Charon', name: 'Charon', desc: '深沉男声' },
  { id: 'Orus', name: 'Orus', desc: '稳重男声' },
  { id: 'Fenrir', name: 'Fenrir', desc: '磁性男声' },
];

const PERSONAS = [
  { id: 'default', name: '标准播报', prompt: 'Speak naturally and clearly.' },
  { id: 'storyteller', name: '深情讲书人', prompt: 'Speak like a professional audiobook narrator. Use dramatic pauses and emotional depth.' },
  { id: 'anchor', name: '带货主播', prompt: 'Speak like a high-energy live streamer. Be extremely enthusiastic.' },
  { id: 'professor', name: '老教授', prompt: 'Speak like a wise old professor. Slow pace and clear articulation.' },
];

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('tts_gemini_api_key') || '');
  const [text, setText] = useState('欢迎来到人格实验室。请在右上角输入 API Key 后开始使用。');
  const [voice, setVoice] = useState('Kore');
  const [personaId, setPersonaId] = useState('default');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  const sourceNodeRef = useRef(null);

  const saveApiKey = () => {
    localStorage.setItem('tts_gemini_api_key', apiKey);
    alert('API Key 已保存在本地浏览器');
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

  const stopAudio = () => {
    if (sourceNodeRef.current) { sourceNodeRef.current.pause(); sourceNodeRef.current = null; }
    setIsPlaying(false);
  };

  const downloadAudio = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TTS_${new Date().getTime()}.wav`;
    a.click();
  };

  const generateAndPlay = async () => {
    if (!apiKey) { setError("请输入 API Key"); return; }
    setLoading(true); setError(null); stopAudio();

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
      const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!audioPart) throw new Error("合成失败，请检查 API Key");

      const binaryString = atob(audioPart.inlineData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const pcm16Data = new Int16Array(bytes.buffer);
      const wavBlob = pcmToWav(pcm16Data, 24000);
      setLastAudioBlob(wavBlob);
      
      const audio = new Audio(URL.createObjectURL(wavBlob));
      sourceNodeRef.current = audio;
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
    <div className="min-h-screen bg-slate-900 p-4 flex justify-center items-center font-sans">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-slate-700">
        <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
          <div className="flex items-center gap-2 font-bold text-lg"><Sparkles /> 人格实验室</div>
          <div className="flex items-center gap-2 bg-black/20 p-2 rounded-xl">
            <input 
              type="password" 
              value={apiKey} 
              onChange={e=>setApiKey(e.target.value)} 
              placeholder="API Key" 
              className="bg-transparent text-xs w-20 outline-none text-white placeholder:text-white/50" 
            />
            <button onClick={saveApiKey} title="保存 Key"><Save size={16}/></button>
          </div>
        </div>

        <div className="p-6 space-y-6 text-slate-200">
          <div className="grid grid-cols-4 gap-2">
            {VOICES.map(v => (
              <button 
                key={v.id} 
                onClick={()=>setVoice(v.id)} 
                className={`p-2 rounded-xl border-2 transition-all ${voice === v.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-transparent bg-slate-700 hover:bg-slate-600'}`}
              >
                <div className="text-[10px] text-center font-medium">{v.name}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {PERSONAS.map(p => (
              <button 
                key={p.id} 
                onClick={()=>setPersonaId(p.id)} 
                className={`px-3 py-1.5 rounded-full text-xs transition-colors ${personaId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="relative">
            <textarea 
              className="w-full h-40 p-4 bg-slate-700 rounded-2xl text-white text-sm outline-none resize-none focus:ring-2 focus:ring-indigo-500/50 transition-shadow" 
              value={text} 
              onChange={e=>setText(e.target.value)}
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-600">
              <Gauge size={12} className="text-slate-400" />
              <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={e=>setSpeed(parseFloat(e.target.value))} className="w-12 h-1 accent-indigo-500 cursor-pointer" />
              <span className="text-[10px] text-slate-400 font-mono">{speed}x</span>
            </div>
          </div>

          {error && <div className="text-red-400 text-xs text-center font-medium bg-red-400/10 py-2 rounded-lg">{error}</div>}

          <div className="flex gap-2">
            <button 
              onClick={generateAndPlay} 
              disabled={loading} 
              className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Play size={20} />}
              {loading ? '正在炼金...' : '开始合成'}
            </button>
            {lastAudioBlob && (
              <button onClick={downloadAudio} className="p-4 bg-slate-700 text-white rounded-2xl hover:bg-slate-600 active:scale-95 transition-all">
                <Download size={20} />
              </button>
            )}
            {isPlaying && (
              <button onClick={stopAudio} className="p-4 bg-red-500 text-white rounded-2xl animate-pulse">
                <Square size={20} fill="currentColor" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
