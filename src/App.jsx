import React, { useState, useRef } from 'react';
import { Play, Square, Download, Loader2, Gauge, Sparkles, User, Save, Key } from 'lucide-react';

/**
 * 人格实验室 (Persona Laboratory) - 基于 Gemini 的 TTS 应用
 * 功能：将文字转为具有特定性格的语音
 */

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

export default function App() {
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
    alert('API Key 已保存');
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
    for (let i = 0; i < pcmData.length; i++) {
      view.setInt16(44 + i * 2, pcmData[i], true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const generateAndPlay = async () => {
    if (!apiKey) {
      setError("请先配置 API Key");
      return;
    }
    setLoading(true);
    setError(null);
    stopAudio();

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
            speechConfig: { 
              voiceConfig: { 
                prebuiltVoiceConfig: { voiceName: voice } 
              } 
            }
          }
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "请求失败");
      }

      const result = await response.json();
      const audioData = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      
      if (!audioData) throw new Error("未获取到音频数据");

      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      
      const wavBlob = pcmToWav(new Int16Array(bytes.buffer), 24000); 
      setLastAudioBlob(wavBlob);
      
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      await audio.play();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 flex justify-center items-center font-sans text-slate-100">
      <div className="max-w-md w-full bg-slate-800 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-700">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Sparkles className="text-yellow-400" /> 
            <span>人格实验室</span>
          </div>
          <div className="flex items-center gap-1 bg-black/20 p-1.5 rounded-xl">
            <Key size={12} className="text-indigo-300" />
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="Key" 
              className="bg-transparent text-[10px] w-16 outline-none" 
            />
            <button onClick={saveApiKey} className="p-1"><Save size={14} /></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <div className="grid grid-cols-4 gap-2">
              {VOICES.map(v => (
                <button 
                  key={v.id} 
                  onClick={() => setVoice(v.id)} 
                  className={`py-2 rounded-xl border text-[10px] transition-all ${voice === v.id ? 'border-indigo-500 bg-indigo-500/20' : 'border-transparent bg-slate-700'}`}
                >
                  <User size={12} className="mx-auto mb-1" />
                  {v.name}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            {PERSONAS.map(p => (
              <button 
                key={p.id} 
                onClick={() => setPersonaId(p.id)} 
                className={`px-3 py-1.5 rounded-lg text-[10px] ${personaId === p.id ? 'bg-indigo-600' : 'bg-slate-700'}`}
              >
                {p.name}
              </button>
            ))}
          </section>

          <section className="relative">
            <textarea 
              className="w-full h-32 p-4 bg-slate-900 rounded-xl text-xs outline-none border border-slate-700 focus:border-indigo-500 resize-none" 
              value={text} 
              onChange={e => setText(e.target.value)}
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-600">
              <Gauge size={12} />
              <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={e => setSpeed(parseFloat(e.target.value))} className="w-12 h-1" />
              <span className="text-[8px]">{speed}x</span>
            </div>
          </section>

          {error && <div className="text-red-400 text-[10px] text-center">{error}</div>}

          <div className="flex gap-2">
            <button 
              onClick={generateAndPlay} 
              disabled={loading} 
              className="flex-1 bg-indigo-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              {loading ? '正在合成...' : '开启播放'}
            </button>
            {isPlaying && (
              <button onClick={stopAudio} className="w-12 bg-red-500 rounded-xl flex items-center justify-center">
                <Square size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
