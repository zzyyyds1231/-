import React, { useState, useRef } from 'react';
import { Play, Square, Download, Loader2, Gauge, Sparkles, User, Save, Key } from 'lucide-react';

/**
 * 人格实验室 (Persona Laboratory) - 基于 Gemini 的 TTS 应用
 * 所有的逻辑、状态管理和 UI 都集成在此单一组件文件中以确保预览稳定性。
 */

// Gemini TTS 引擎可用的预设音色
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

// 引导 AI 说话风格的人设提示词
const PERSONAS = [
  { id: 'default', name: '标准播报', prompt: 'Speak naturally and clearly.' },
  { id: 'storyteller', name: '深情讲书人', prompt: 'Speak like a professional audiobook narrator. Use dramatic pauses and emotional depth.' },
  { id: 'anchor', name: '带货主播', prompt: 'Speak like a high-energy live streamer. Be extremely enthusiastic.' },
  { id: 'professor', name: '老教授', prompt: 'Speak like a wise old professor. Slow pace and clear articulation.' },
];

export default function App() {
  // 基础状态：API Key、文本内容及语音偏好
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('tts_gemini_api_key') || '');
  const [text, setText] = useState('欢迎来到人格实验室。请在右上角输入 API Key 后开始使用。');
  const [voice, setVoice] = useState('Kore');
  const [personaId, setPersonaId] = useState('default');
  const [speed, setSpeed] = useState(1.0);
  
  // 运行状态：加载中、播放中、音频数据及错误捕获
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [lastAudioBlob, setLastAudioBlob] = useState(null);
  const [error, setError] = useState(null);
  
  const audioRef = useRef(null);

  // 持久化保存 API Key
  const saveApiKey = () => {
    localStorage.setItem('tts_gemini_api_key', apiKey);
    // 使用非阻塞的自定义 UI 提示（此处简便起见用 alert，但在复杂应用中建议用 Toast）
    alert('API Key 已安全保存至本地存储');
  };

  /**
   * 将 Gemini 返回的原始 PCM 16-bit 数据封装进 WAV 容器
   * @param {Int16Array} pcmData 原始音频采样数据
   * @param {number} sampleRate 采样率 (Gemini 通常为 24000)
   */
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
    view.setUint16(20, 1, true); // Linear PCM
    view.setUint16(22, 1, true); // Mono channel
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

  const downloadAudio = () => {
    if (!lastAudioBlob) return;
    const url = URL.createObjectURL(lastAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laboratory_Voice_${voice}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateAndPlay = async () => {
    if (!apiKey) {
      setError("请先在右上角配置 API Key");
      return;
    }
    setLoading(true);
    setError(null);
    stopAudio();

    const currentPersona = PERSONAS.find(p => p.id === personaId).prompt;
    // 将人设指令和文本结合发送给 Gemini
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
        throw new Error(errData.error?.message || "API 请求失败");
      }

      const result = await response.json();
      const audioPart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      
      if (!audioPart) throw new Error("模型未返回音频数据，请检查 API 权限");

      // 解码 Base64 PCM 数据
      const binaryString = atob(audioPart.inlineData.data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const pcm16Data = new Int16Array(bytes.buffer);
      const wavBlob = pcmToWav(pcm16Data, 24000); 
      setLastAudioBlob(wavBlob);
      
      const audioUrl = URL.createObjectURL(wavBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 flex justify-center items-center font-sans text-slate-100">
      <div className="max-w-md w-full bg-slate-800 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden border border-slate-700/50">
        
        {/* 标题栏与 API 配置 */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Sparkles className="text-amber-300" /> 
            <span>人格实验室</span>
          </div>
          <div className="flex items-center gap-2 bg-black/30 p-2 rounded-2xl border border-white/10 backdrop-blur-md">
            <Key size={14} className="text-indigo-300" />
            <input 
              type="password" 
              value={apiKey} 
              onChange={e => setApiKey(e.target.value)} 
              placeholder="API Key" 
              className="bg-transparent text-xs w-20 outline-none text-white placeholder:text-white/30 font-mono" 
            />
            <button 
              onClick={saveApiKey} 
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              title="保存配置"
            >
              <Save size={16} className="text-indigo-200" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 声线选择区 */}
          <section>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 block">音色库</label>
            <div className="grid grid-cols-4 gap-2">
              {VOICES.map(v => (
                <button 
                  key={v.id} 
                  onClick={() => setVoice(v.id)} 
                  className={`py-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                    voice === v.id 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_20px_rgba(99,102,241,0.15)]' 
                    : 'border-transparent bg-slate-700/50 hover:bg-slate-700'
                  }`}
                >
                  <User size={14} className={voice === v.id ? 'text-indigo-400' : 'text-slate-500'} />
                  <span className="text-[10px] font-semibold">{v.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 人格注入区 */}
          <section>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 block">人格预设</label>
            <div className="flex flex-wrap gap-2">
              {PERSONAS.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => setPersonaId(p.id)} 
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    personaId === p.id 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          {/* 文本输入与语速控制 */}
          <section className="relative group">
            <textarea 
              className="w-full h-44 p-5 bg-slate-900/50 rounded-[1.5rem] text-white text-sm outline-none resize-none border border-slate-700 focus:border-indigo-500 transition-all placeholder:text-slate-600 leading-relaxed" 
              value={text} 
              onChange={e => setText(e.target.value)}
              placeholder="在这里输入文字，让 AI 为其注入灵魂..."
            />
            <div className="absolute bottom-4 right-4 flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-2xl border border-slate-600 shadow-2xl">
              <Gauge size={14} className="text-indigo-400" />
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={speed} 
                onChange={e => setSpeed(parseFloat(e.target.value))} 
                className="w-16 h-1 accent-indigo-500 cursor-pointer" 
              />
              <span className="text-[10px] text-slate-400 font-mono w-6">{speed.toFixed(1)}x</span>
            </div>
          </section>

          {/* 错误反馈 */}
          {error && (
            <div className="text-rose-400 text-xs text-center py-3 px-4 bg-rose-400/10 rounded-xl border border-rose-400/20 animate-in fade-in slide-in-from-top-1">
              {error}
            </div>
          )}

          {/* 核心交互按钮 */}
          <div className="flex gap-3 pt-2">
            <button 
              onClick={generateAndPlay} 
              disabled={loading} 
              className="flex-[3] bg-indigo-600 text-white py-4.5 rounded-[1.25rem] font-bold flex items-center justify-center gap-3 hover:bg-indigo-500 active:scale-[0.97] transition-all disabled:opacity-50 shadow-xl shadow-indigo-600/20"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
              {loading ? '正在合成音频...' : '注入并开启播放'}
            </button>
            
            {lastAudioBlob && (
              <button 
                onClick={downloadAudio} 
                className="flex-1 bg-slate-700 text-slate-200 rounded-[1.25rem] flex items-center justify-center hover:bg-slate-600 active:scale-95 transition-all border border-slate-600"
                title="导出为音频文件"
              >
                <Download size={20} />
              </button>
            )}

            {isPlaying && (
              <button 
                onClick={stopAudio} 
                className="flex-1 bg-rose-500 text-white rounded-[1.25rem] flex items-center justify-center animate-pulse hover:bg-rose-400 active:scale-95 transition-all shadow-lg shadow-rose-500/20"
                title="立即停止"
              >
                <Square size={20} fill="currentColor" />
              </button>
            )}
          </div>
        </div>

        <div className="pb-6 text-center">
          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.2em]">
            Powered by Gemini 2.5 Flash Engine
          </p>
        </div>
      </div>
    </div>
  );
}
