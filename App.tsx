
import { GoogleGenAI, Modality } from '@google/genai';
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { CATEGORIES, COLORS } from './constants';
import { AGENTS } from './data/agents';
import { Agent, Message, SystemMetrics, ConnectorProvider } from './types';
import { checkSemanticCache, updateSemanticCache, setProviderAuthToken, getProviderAuthToken } from './mcp-server';
import { MCPClient } from './mcp-client';

// Audio Utilities for Gemini PCM Stream
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const INITIAL_PROVIDERS: ConnectorProvider[] = [
  { id: 'jira', name: 'Jira Software', icon: '🎫', description: 'Backlog and Sprint management.', status: 'disconnected' },
  { id: 'miro', name: 'Miro Board', icon: '🖼️', description: 'Discovery and flow mapping.', status: 'disconnected' },
  { id: 'seo_perf', name: 'SEO Performance', icon: '⚡', description: 'Lighthouse and Core Web Vitals.', status: 'disconnected' },
  { id: 'google_search', name: 'Google Search', icon: '🔍', description: 'Real-time web search.', status: 'disconnected' },
  { id: 'grafana', name: 'Grafana Labs', icon: '📈', description: 'Real-time SRE observability.', status: 'disconnected' },
  { id: 'github', name: 'GitHub Enterprise', icon: '🐙', description: 'V3 REST Production API.', status: 'disconnected' },
  { id: 'slack', name: 'Slack Ops', icon: '💬', description: 'Internal team communication.', status: 'disconnected' },
  { id: 'figma', name: 'Figma Cloud', icon: '🎨', description: 'Design tokens and assets.', status: 'disconnected' },
  { id: 'aws', name: 'AWS Production', icon: '☁️', description: 'IAM-scoped cloud infrastructure.', status: 'disconnected' },
  { id: 'stripe', name: 'Stripe Finance', icon: '💳', description: 'Financial telemetry and billing.', status: 'disconnected' },
  { id: 'instagram', name: 'Instagram Business', icon: '📸', description: 'Social media management and publishing.', status: 'disconnected' },
];

const FormattedMessage: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        if (line.startsWith('###')) {
          return <h3 key={i} className="text-lg font-black text-[#9d5ce9] mt-6 mb-2 uppercase tracking-tight">{line.replace('###', '').trim()}</h3>;
        }
        if (line.startsWith('---')) {
          return <hr key={i} className="border-white/10 my-4" />;
        }
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <p key={i} className="leading-relaxed text-gray-200">
            {parts.map((part, pi) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <span key={pi} className="font-bold text-white">{part.slice(2, -2)}</span>;
              }
              return part;
            })}
          </p>
        );
      })}
    </div>
  );
};

const App: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showConnectors, setShowConnectors] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isChatVoiceActive, setIsChatVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [isConversing, setIsConversing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [providers, setProviders] = useState<ConnectorProvider[]>(() => 
    INITIAL_PROVIDERS.map(p => ({ 
      ...p, 
      status: getProviderAuthToken(p.id) ? 'connected' : 'disconnected',
      accessToken: getProviderAuthToken(p.id) || undefined
    }))
  );
  
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const globalRecognitionRef = useRef<any>(null);
  const chatRecognitionRef = useRef<any>(null);
  const processingLockRef = useRef<boolean>(false);
  const conversationResetTimeout = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const filteredAgents = useMemo(() => {
    return AGENTS.filter(agent => {
      const matchesCategory = !selectedCategory || agent.category === selectedCategory;
      const matchesSearch = !searchQuery || 
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSimulating]);

  const speakText = async (text: string, voiceName: string = 'Kore') => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    setIsSpeaking(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      // CRITICAL: We MUST prefix the prompt with "Please say: " to ensure the model produces AUDIO and not a text chat response.
      const speechPrompt = `Please say: ${text.length > 500 ? text.substring(0, 500) + "..." : text}`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: speechPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        } as any,
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        console.warn("TTS: No audio data returned from model. Check prompt or modality config.");
        setIsSpeaking(false);
      }
    } catch (e) {
      console.error("TTS Error:", e);
      setIsSpeaking(false);
    }
  };

  const callAgent = async (agent: Agent, prompt: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const client = new MCPClient(agent, (m) => console.debug(m));
    const toolDecls = client.getToolDefinitions();

    const config = {
      systemInstruction: `You are ${agent.name}. Role: ${agent.role}. ${agent.systemPrompt}. Be concise and authoritative.`,
      tools: toolDecls.length > 0 ? [{ functionDeclarations: toolDecls }] : []
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: config as any
    });

    const modelTurn = response.candidates?.[0]?.content;
    
    if (response.functionCalls && response.functionCalls.length > 0 && modelTurn) {
      const functionResponses = [];
      for (const fc of response.functionCalls) {
        if (!fc.name) continue;
        try {
          const resultData = await client.handleToolCall(fc, async (targetId, task) => {
            const target = AGENTS.find(a => a.id === targetId);
            if (!target) return "Error: Agent not found.";
            setMessages(prev => [...prev, { role: 'system', content: `🔄 DELEGATING: ${target.name}`, timestamp: Date.now() }]);
            return await callAgent(target, task);
          });
          functionResponses.push({ functionResponse: { name: fc.name, id: fc.id || '', response: resultData } });
        } catch (toolErr: any) {
          if (toolErr.message.includes('AUTHENTICATION_REQUIRED')) {
            const providerId = agent.mcpTools.find(t => t.name === fc.name)?.provider;
            setMessages(prev => [...prev, { role: 'system', content: `⚠️ AUTH REQUIRED: ${providerId}`, timestamp: Date.now(), error: true, providerId: providerId }]);
            functionResponses.push({ functionResponse: { name: fc.name, id: fc.id || '', response: { error: "AUTH_REQUIRED" } } });
          } else { throw toolErr; }
        }
      }

      const finalResponse = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }, modelTurn, { role: 'tool', parts: functionResponses as any }],
        config: config as any
      });
      return finalResponse.text || "Dispatch processed.";
    }

    return response.text || "";
  };

  const executeAgentTask = useCallback(async (agent: Agent, input: string) => {
    if (processingLockRef.current) return;
    processingLockRef.current = true;

    setSelectedAgent(agent);
    setMessages(prev => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);
    setIsSimulating(true);

    try {
      const finalAnswer = await callAgent(agent, input);
      setMessages(prev => [...prev, { role: 'assistant', content: finalAnswer, agentId: agent.id, timestamp: Date.now() }]);
      await speakText(finalAnswer);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'system', content: `ORCHESTRATION_ERROR: ${err.message}`, timestamp: Date.now(), error: true }]);
    } finally {
      setIsSimulating(false);
      processingLockRef.current = false;
      setIsConversing(false); 
    }
  }, []);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedAgent) return;
    const input = chatInput;
    setChatInput('');
    await executeAgentTask(selectedAgent, input);
  };

  // --- IMPROVED GLOBAL VOICE CONTROL ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase().trim();
      setVoiceTranscript(transcript);

      if (result.isFinal) {
        const wakeWords = ['hey', 'hi', 'system', 'conductor', 'orchestra', 'okay'];
        const isWake = wakeWords.some(w => transcript.startsWith(w));

        if (isWake || isConversing) {
          if (conversationResetTimeout.current) window.clearTimeout(conversationResetTimeout.current);
          conversationResetTimeout.current = window.setTimeout(() => setIsConversing(false), 15000);

          let command = transcript;
          if (!isConversing && isWake) {
            setIsConversing(true);
            const words = transcript.split(/\s+/);
            command = words.slice(1).join(' ').trim();
            if (!command) {
              speakText("Listening. State your command for the orchestra.", "Zephyr");
              return;
            }
          }

          // Advanced Routing: "Switch to [Agent Name]"
          const navigationRegex = /^(i want to use|use|switch to|talk to|open|select|activate|show|call)\s+(.+)/i;
          const navMatch = command.match(navigationRegex);

          if (navMatch) {
            const requestedName = navMatch[2].toLowerCase();
            const target = AGENTS.find(a => a.name.toLowerCase().includes(requestedName));
            if (target) {
              setSelectedAgent(target);
              speakText(`${target.name} module loaded. What is your instruction?`, "Zephyr");
              return;
            }
          }

          // Direct Agent Command Pattern: "[Agent Name], [Task]"
          let agentFound = false;
          for (const agent of AGENTS) {
            const agentNameNormalized = agent.name.toLowerCase().replace('&', 'and');
            const commandNormalized = command.replace('&', 'and');
            if (commandNormalized.startsWith(agentNameNormalized)) {
              const task = commandNormalized.slice(agentNameNormalized.length).replace(/^[,:\s]*/, '').trim();
              if (task.length > 2) {
                executeAgentTask(agent, task);
                agentFound = true;
                break;
              }
            }
          }

          // Fallback Global Instruction
          if (!agentFound && command.length > 3 && !processingLockRef.current) {
            const conductor = selectedAgent || AGENTS.find(a => a.id === 'supervisor-agent') || AGENTS[0];
            executeAgentTask(conductor, command);
          }
        }
      }
    };

    recognition.onend = () => { if (isVoiceActive) recognition.start(); };
    globalRecognitionRef.current = recognition;
  }, [executeAgentTask, isConversing, isVoiceActive, selectedAgent]);

  // --- CHAT MODAL VOICE ---
  const toggleChatVoiceMode = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return alert("Speech recognition not supported in this browser.");

    if (isChatVoiceActive) {
      chatRecognitionRef.current?.stop();
      setIsChatVoiceActive(false);
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const result = event.results[0];
      const transcript = result[0].transcript;
      setChatInput(transcript);
      if (result.isFinal && transcript.trim().length > 1) {
        setIsChatVoiceActive(false);
        recognition.stop();
        setTimeout(() => {
          if (selectedAgent && transcript.trim()) {
            executeAgentTask(selectedAgent, transcript.trim());
            setChatInput('');
          }
        }, 500);
      }
    };

    recognition.onend = () => setIsChatVoiceActive(false);
    recognition.onerror = () => setIsChatVoiceActive(false);

    chatRecognitionRef.current = recognition;
    setIsChatVoiceActive(true);
    recognition.start();
  };

  const toggleGlobalVoiceMode = async () => {
    if (!globalRecognitionRef.current) return alert("Speech recognition initialization failed.");
    if (isVoiceActive) {
      globalRecognitionRef.current.stop();
      setIsVoiceActive(false);
      setIsConversing(false);
    } else {
      if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      setIsVoiceActive(true);
      globalRecognitionRef.current.start();
      speakText("Global control unit initialized. Listening for 'Hey'.", "Zephyr");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-transparent overflow-hidden">
      <div className={`fixed inset-0 pointer-events-none transition-all duration-1000 ${isVoiceActive ? 'opacity-30' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#9d5ce930_0%,transparent_70%)] animate-pulse" />
      </div>

      <header className="sticky top-0 z-[60] px-6 py-4">
        <div className={`max-w-[1400px] mx-auto glass rounded-full px-8 py-3 flex items-center justify-between shadow-2xl transition-all duration-700 ${isConversing ? 'border-[#9d5ce9] ring-8 ring-[#9d5ce9]/10 bg-[#9d5ce9]/10' : 'border-white/10'}`}>
          <div className="flex items-center gap-12">
            <div className="flex flex-col">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${isConversing ? 'bg-white text-[#9d5ce9] scale-110 shadow-[0_0_20px_#fff]' : 'bg-[#9d5ce9] text-white shadow-[0_0_20px_#9d5ce9]'}`}>
                  {isConversing ? '⚡' : '🎻'}
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black kloud-gradient-text uppercase">A2A Orchestra</span>
                  <span className="text-[8px] font-black text-[#9d5ce9] uppercase tracking-[0.3em] opacity-80">Platform Unit Control</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={toggleGlobalVoiceMode}
              className={`flex items-center gap-4 px-6 py-2.5 rounded-full transition-all group relative overflow-hidden ${isVoiceActive ? 'bg-[#9d5ce9]/20 border border-[#9d5ce9]/60' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
            >
              <div className={`w-2.5 h-2.5 rounded-full transition-all ${isVoiceActive ? 'bg-rose-500 animate-pulse shadow-[0_0_15px_#f43f5e]' : 'bg-gray-600'}`} />
              <span className={`text-[11px] font-black uppercase tracking-widest ${isVoiceActive ? 'text-white' : 'text-gray-500'}`}>
                {isVoiceActive ? (isConversing ? 'Listening' : 'System Hot') : 'Initialize Voice'}
              </span>
              <span className="text-xl">{isSpeaking ? '🔊' : isVoiceActive ? '🧠' : '🎤'}</span>
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <input type="text" placeholder="Filter agents..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-white/5 border border-white/10 rounded-full px-10 py-2 text-[11px] font-bold text-white outline-none focus:border-[#9d5ce9]/50 transition-all uppercase w-48" />
            <button onClick={() => setShowConnectors(true)} className="bg-[#9d5ce9] px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg">Connectors</button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex max-w-[1600px] mx-auto w-full px-6 gap-6 mb-12 relative overflow-hidden">
        <aside className="w-72 py-6 overflow-y-auto h-[calc(100vh-120px)] sticky top-24 custom-scrollbar space-y-6">
          <div className="glass rounded-[2rem] p-6">
            <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Clusters</h4>
            <div className="space-y-1">
              <button onClick={() => setSelectedCategory(null)} className={`w-full text-left px-5 py-3 rounded-2xl text-xs font-bold transition-all ${!selectedCategory ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:bg-white/5'}`}>All Units</button>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`w-full flex items-center gap-3 px-5 py-3 rounded-2xl text-xs font-bold transition-all ${selectedCategory === cat.id ? COLORS[cat.id as keyof typeof COLORS] || COLORS.orchestration : 'text-gray-500 hover:bg-white/5'}`}><span>{cat.icon}</span> {cat.title}</button>
              ))}
            </div>
          </div>
          
          <div className={`glass rounded-[2rem] p-8 border-[#9d5ce9]/20 transition-all ${isConversing ? 'shadow-[0_0_30px_rgba(157,92,233,0.1)]' : ''}`}>
             <h4 className="text-[9px] font-black text-gray-500 uppercase tracking-[0.4em] mb-4">Voice Guide</h4>
             <div className="space-y-3 opacity-60">
                <p className="text-[10px] font-bold">1. Say "Hey Orchestra"</p>
                <p className="text-[10px] font-bold">2. Say "Switch to Code Agent"</p>
                <p className="text-[10px] font-bold">3. Give your command.</p>
             </div>
          </div>
        </aside>

        <main className="flex-1 py-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 pb-32">
            {filteredAgents.map(agent => (
              <button key={agent.id} onClick={() => setSelectedAgent(agent)} className={`group text-left glass rounded-[3rem] p-10 transition-all hover:translate-y-[-10px] active:scale-95 relative overflow-hidden ${selectedAgent?.id === agent.id ? 'border-[#9d5ce9] bg-[#9d5ce9]/5 ring-8 ring-[#9d5ce9]/5' : 'hover:border-white/20'}`}>
                <div className="flex items-start justify-between mb-10">
                  <div className="w-20 h-20 rounded-3xl bg-gray-950/90 border border-white/10 flex items-center justify-center text-5xl shadow-2xl group-hover:scale-110 transition-transform">{agent.icon}</div>
                  <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${COLORS[agent.category as keyof typeof COLORS] || COLORS.orchestration}`}>{agent.category}</div>
                </div>
                <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:text-[#9d5ce9] transition-colors">{agent.name}</h3>
                <p className="text-[11px] text-[#9d5ce9] font-black uppercase tracking-widest mb-6">{agent.role}</p>
                <p className="text-[13px] text-gray-400 leading-relaxed line-clamp-3 font-medium">{agent.description}</p>
              </button>
            ))}
          </div>
        </main>
      </div>

      {/* Persistent Voice Feedback HUD */}
      {isVoiceActive && (
        <div className="fixed bottom-0 left-0 right-0 h-32 z-[100] flex items-center justify-center pointer-events-none">
          <div className={`w-full max-w-3xl glass rounded-t-[4rem] h-full border-t border-x border-[#9d5ce9]/50 flex items-center gap-16 px-16 transition-all duration-700 transform ${isConversing ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
            <div className="flex items-center gap-8">
               <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-3xl transition-all duration-500 ${isSpeaking ? 'bg-white text-[#9d5ce9] shadow-[0_0_40px_#fff] scale-110 rotate-3' : 'bg-[#9d5ce9] text-white shadow-[0_0_40px_#9d5ce9]'}`}>
                 {isSpeaking ? '🔊' : '🎙️'}
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] font-black text-[#9d5ce9] uppercase tracking-[0.3em] mb-1">{isSpeaking ? 'Model Response' : 'Listening'}</span>
                 <p className="text-[12px] font-mono text-white truncate max-w-xs">{voiceTranscript || "..."}</p>
               </div>
            </div>
            <div className="flex-1 flex items-end justify-center gap-2 h-16 pb-4">
              {[...Array(24)].map((_, i) => (
                <div key={i} className={`w-1.5 rounded-full bg-[#9d5ce9] transition-all duration-300 ${isSpeaking ? 'animate-pulse' : isConversing ? 'animate-bounce' : 'h-1'}`} style={{ height: isSpeaking ? `${20 + Math.random() * 80}%` : isConversing ? `${10 + Math.random() * 40}%` : '6px', animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedAgent && (
        <>
          <div className="fixed inset-0 bg-black/85 backdrop-blur-3xl z-[70]" onClick={() => setSelectedAgent(null)} />
          <div className="fixed top-8 right-8 bottom-8 w-full max-w-[800px] glass rounded-[4rem] z-[80] shadow-[-60px_0_150px_rgba(0,0,0,1)] animate-in slide-in-from-right duration-700 flex flex-col overflow-hidden border-white/10">
            <div className="p-16 border-b border-white/5 flex items-center justify-between bg-black/50">
              <div className="flex items-center gap-10">
                <div className="w-28 h-28 rounded-[2.5rem] bg-gray-950 border border-white/10 flex items-center justify-center text-7xl shadow-2xl">{selectedAgent.icon}</div>
                <div>
                  <h2 className="text-5xl font-black kloud-gradient-text tracking-tighter mb-2 uppercase">{selectedAgent.name}</h2>
                  <p className="text-sm font-black text-[#9d5ce9] uppercase tracking-[0.4em]">{selectedAgent.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="w-20 h-20 rounded-full glass hover:bg-white/10 flex items-center justify-center text-3xl transition-all hover:rotate-90">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-16 space-y-12 custom-scrollbar bg-black/30">
              {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-8 duration-500`}>
                  <div className={`p-10 rounded-[3.5rem] max-w-[90%] text-[16px] leading-relaxed shadow-2xl transition-all relative ${m.role === 'user' ? 'bg-[#9d5ce9] text-white' : m.role === 'system' ? 'bg-white/5 text-[#9d5ce9]/80 italic text-[13px] font-black uppercase tracking-widest border border-white/10 py-6' : 'glass text-gray-100 border-l-[10px] border-[#9d5ce9]'}`}>
                    {m.role === 'assistant' ? <FormattedMessage content={m.content} /> : <div className="font-bold">{m.content}</div>}
                  </div>
                </div>
              ))}
              {isSimulating && (
                <div className="flex items-center gap-4 px-6 text-[12px] font-black text-[#9d5ce9] uppercase tracking-[0.5em] animate-pulse">
                   <div className="w-3 h-3 rounded-full bg-[#9d5ce9]" />
                   Orchestrating Instruction...
                </div>
              )}
              <div ref={terminalEndRef} />
            </div>

            <div className="p-14 bg-black/90 border-t border-white/10">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 group">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={`Command ${selectedAgent.name}...`} className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] px-12 py-8 text-lg focus:border-[#9d5ce9]/60 outline-none transition-all placeholder:text-gray-800 font-bold group-hover:border-white/20" />
                  <button 
                    onClick={toggleChatVoiceMode}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full flex items-center justify-center transition-all ${isChatVoiceActive ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_30px_#f43f5e]' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'}`}
                    title="Direct Voice Input"
                  >
                    <span className="text-2xl">{isChatVoiceActive ? '🔊' : '🎤'}</span>
                  </button>
                </div>
                <button onClick={handleSendMessage} className="bg-[#9d5ce9] hover:bg-[#8b46d7] px-10 py-8 rounded-[2.5rem] text-[14px] font-black uppercase tracking-widest transition-all shadow-2xl hover:scale-105 active:scale-95">Execute Dispatch ↵</button>
              </div>
            </div>
          </div>
        </>
      )}

      {showConnectors && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/98 backdrop-blur-3xl" onClick={() => setShowConnectors(false)}>
          <div className="glass w-full max-w-4xl rounded-[5rem] overflow-hidden shadow-2xl border-white/10" onClick={e => e.stopPropagation()}>
            <div className="p-20 border-b border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-6xl font-black kloud-gradient-text tracking-tighter uppercase mb-4">Protocols</h2>
                <p className="text-gray-500 text-sm font-bold tracking-[0.4em] uppercase">Identity-Auth-Mesh</p>
              </div>
              <button onClick={() => setShowConnectors(false)} className="w-24 h-24 rounded-full glass hover:bg-white/10 flex items-center justify-center text-3xl transition-transform hover:rotate-90">✕</button>
            </div>
            <div className="p-20 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {providers.map(p => (
                <div key={p.id} className="p-10 glass rounded-[3.5rem] flex items-center justify-between group hover:border-[#9d5ce9]/80 transition-all duration-500">
                  <div className="flex items-center gap-12">
                    <div className="w-24 h-24 rounded-[2rem] bg-gray-950 flex items-center justify-center text-6xl shadow-inner group-hover:scale-110 transition-transform">{p.icon}</div>
                    <div>
                      <h4 className="font-black text-2xl text-white tracking-tight uppercase mb-2">{p.name}</h4>
                      <div className="flex items-center gap-4"><span className={`w-3 h-3 rounded-full ${p.status === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-800'}`} /><span className="text-[12px] font-black text-gray-500 uppercase tracking-widest">{p.status}</span></div>
                    </div>
                  </div>
                  {p.status !== 'connected' && (
                    <button onClick={() => { setProviderAuthToken(p.id, 'SECURE_NODE_ACCESS_GRANTED'); setProviders(prev => prev.map(pr => pr.id === p.id ? {...pr, status: 'connected'} : pr)); }} className="bg-[#9d5ce9] px-12 py-4 rounded-2xl text-[12px] font-black uppercase tracking-widest shadow-2xl hover:scale-110 transition-all">Establish Link</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
