import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Volume2, Mic, Settings, Download, Trash2, Loader2, Gauge, Sparkles, User, Headphones, Wand2, Key, Save } from 'lucide-react';

const VOICES = [
  { id: 'Kore', name: 'Kore', desc: '清亮女声 (推荐)', gender: 'Female', preview: '你好，我是 Kore，很高兴为你播报。' },
  { id: 'Aoede', name: 'Aoede', desc: '温柔女声', gender: 'Female', preview: '你好，我是 Aoede，希望我的声音能带给你温暖。' },
  { id: 'Leda', name: 'Leda', desc: '成熟女声', gender: 'Female', preview: '你好，我是 Leda，让我们开始今天的播报吧。' },
  { id: 'Zephyr', name: 'Zephyr', desc: '阳光男声', gender: 'Male', preview: '嘿！我是 Zephyr，准备好迎接充满活力的一天了吗？' },
  { id: 'Puck', name: 'Puck', desc: '活力男声', gender: 'Male', preview: '你好！我是 Puck，很高兴能为你服务。' },
  { id: 'Charon', name: 'Charon', desc: '深沉男声', gender: 'Male', preview: '你好，我是 Charon，我会为你提供稳重的播报。' },
  { id: 'Orus', name: 'Orus', desc: '稳重男声', gender: 'Male', preview: '你好，我是 Orus，请听我为你朗读。' },
  { id: 'Fenrir', name: 'Fenrir', desc: '磁性男声', gender: 'Male', preview: '你好，我是 Fenrir，希望能通过我的声音传递力量。' },
];

const PERSONAS = [
  { id: 'default', name: '标准播报', prompt: 'Speak naturally and clearly.' },
  { id: 'storyteller', name: '深情讲书人', prompt: 'Speak like a professional audiobook narrator. Use dramatic pauses, whisper-like softness for secrets, and emotional depth.' },
  { id: 'anchor', name: '带货主播', prompt: 'Speak like a high-energy live streamer. Be extremely enthusiastic, fast-paced, and use exaggerated tones to grab attention.' },
  { id: 'professor', name: '老教授', prompt: 'Speak like a wise old professor. Slow pace, clear articulation, and thoughtful pauses between academic concepts.' },
  { id: 'custom', name: '自定义人设', prompt: '' },
];

const App = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem('tts_gemini_api_key') || '');
  const [text, setText] = useState('欢迎来到人格实验室。API Key 已支持本地加密存储，下次打开无需重复输入。');
  const [voice, setVoice] = useState('Kore');
  const [personaId, setPersonaId] = useState('default');
  const [customPersona, setCustomPersona] = useState('');
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [previewingId, setPreviewingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  
  const sourceNodeRef = useRef(null);

  const saveApiKey = () => {
    localStorage.setItem('tts_gemini_api_key', apiKey);
    alert('API Key 已保存在当前浏览器！');
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
    if (sourceNodeRef.current) {
      sourceNodeRef.current.pause();
      sourceNodeRef.current.currentTime = 0;
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
    setPreviewingId(null);
  };

  const downloadAudio = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TTS_${voice}_${new Date().getTime()}.wav`;
    a.click();
  };

  const generateAndPlay = async (targetText, targetVoice, isPreview = false) => {
    if (!apiKey) {
      setError("请先在顶部输入您的 Gemini API Key");
      return;
    }
    if (!targetText.trim()) return;
    if (isPreview) setPreviewingId(targetVoice);
    else setLoading(true);
    
    setError(null);
    stopAudio();

    const currentPersona = personaId === 'custom' ? customPersona : PERSONAS.find(p => p.id === personaId).prompt;
    const finalPrompt = `Voice Persona Instruction: ${currentPersona}. Target Voice Model: ${targetVoice}. Speed: ${speed}x. Speak: "${targetText}"`;
    
    try {
      let response;
      let retries = 0;
      const maxRetries = 3;
      
      const callApi = async () => {
        return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: finalPrompt }] }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: targetVoice } } }
            }
          })
        });
      };

      while (retries <= maxRetries) {
        response = await callApi();
        if (response.ok) break;
        const delay = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }

      const result = await response.json();
      const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!audioPart) throw new Error("合成失败：API Key 可能有误或额度不足。");

      const base64Data = audioPart.inlineData.data;
      const sampleRate = parseInt(audioPart.inlineData.mimeType.match(/rate=(\d+)/)?.[1] || "24000");
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const pcm16Data = new Int16Array(bytes.buffer);
      const wavBlob = pcmToWav(pcm16Data, sampleRate);
      setLastAudioBlob(wavBlob);
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      sourceNodeRef.current = audio;
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => { setIsPlaying(false); setPreviewingId(null); };
      audio.play();
    } catch (err) {
      setError(err.message);
    } finally {
      if (!isPreview) setLoading(false);
      else if (!sourceNodeRef.current) setPreviewingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex justify-center items-center font-sans">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Sparkles />
            <h1 className="text-xl font-bold">人格实验室</h1>
          </div>
          <div className="flex items-center gap-2 bg-white/20 p-1 rounded-lg">
            <Key size={14} className="ml-1" />
            <input 
              type="password" 
              placeholder="API Key" 
              className="bg-transparent border-none outline-none text-xs w-24 placeholder:text-white/50"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <button onClick={saveApiKey} className="p-1 hover:bg-white/20 rounded"><Save size={14}/></button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">01 选个声音</label>
            <div className="grid grid-cols-4 gap-2">
              {VOICES.map(v => (
                <button 
                  key={v.id}
                  onClick={() => setVoice(v.id)}
                  className={`p-2 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${voice === v.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-50 bg-slate-50'}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${voice === v.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    <User size={16} />
                  </div>
                  <span className="text-[10px] font-bold">{v.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">02 赋予人格</label>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map(p => (
                <button 
                  key={p.id}
                  onClick={() => setPersonaId(p.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${personaId === p.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between mb-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">03 输入文本</label>
              <div className="flex items-center gap-2">
                <Gauge size={12} className="text-slate-400" />
                <input type="range" min="0.5" max="2.0" step="0.1" value={speed} onChange={(e)=>setSpeed(parseFloat(e.target.value))} className="w-12 h-1 accent-indigo-600" />
                <span className="text-[10px] text-slate-400 font-mono">{speed}x</span>
              </div>
            </div>
            <textarea 
              className="w-full h-32 p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-100 text-sm resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </section>

          {error && <div className="text-red-500 text-xs bg-red-50 p-3 rounded-xl border border-red-100">{error}</div>}

          <div className="flex gap-3">
            <button 
              onClick={() => generateAndPlay(text, voice)}
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
              {loading ? '正在合成...' : '开始朗读'}
            </button>
            {lastAudioBlob && (
              <button onClick={downloadAudio} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all">
                <Download size={20} />
              </button>
            )}
            {isPlaying && (
              <button onClick={stopAudio} className="p-4 bg-red-100 text-red-600 rounded-2xl animate-pulse">
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
