import { useState, useRef, useEffect } from 'react';
import { Zap, Send, User, Bot, Loader, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import AppLayout from './AppLayout';

const SUGGESTIONS = [
  'I need a 12m span flat roof with 2.5kN/m² design load using C24 timber',
  'What strut section should I use for an 18m warehouse with 5kN/m² load?',
  'Compare C24 vs GL24h for a 24m industrial truss',
  'How do I calculate slenderness ratio for a 3.6m timber post?',
  'What timber grade for a coastal building near Mombasa?',
  'Explain Eurocode 5 buckling checks for struts',
];

const SYSTEM_PROMPT = `You are TimberStruct AI — an expert structural engineering assistant specialising in timber design for East Africa.

Your expertise covers:
- Timber structural engineering (Eurocode 5, BS 5268)
- Member sizing: struts, rafters, beams, posts, ceiling ties, ridge beams
- Timber grades: C16, C24, GL24h, GL28h and their properties
- Buckling, deflection, slenderness ratio calculations
- Procurement and supplier network in East Africa (Kenya, Uganda, Tanzania)
- AWS cloud architecture for the TimberStruct platform

When answering:
- Be precise and technical when discussing calculations
- Show formulas where relevant using plain text notation
- Recommend specific sections (e.g. 97×97mm C24) when asked
- Flag risks clearly
- Keep responses concise but complete
- Use bullet points for lists of features or steps`;

function MessageBubble({ msg }) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContent = (text) => {
    // Simple markdown-like rendering
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('### '))
        return <h4 key={i} className="font-barlow font-bold text-heading text-[15px] mt-3 mb-1">{line.slice(4)}</h4>;
      if (line.startsWith('## '))
        return <h3 key={i} className="font-barlow font-bold text-heading text-[17px] mt-4 mb-1">{line.slice(3)}</h3>;
      if (line.startsWith('**') && line.endsWith('**'))
        return <p key={i} className="font-barlow font-bold text-heading">{line.slice(2,-2)}</p>;
      if (line.startsWith('- '))
        return <li key={i} className="ml-4 font-barlow text-[14px] text-body list-disc">{line.slice(2)}</li>;
      if (line.match(/^`[^`]+`$/))
        return <code key={i} className="block font-mono text-[13px] bg-gray-100 text-amber px-2 py-1 rounded my-1">{line.slice(1,-1)}</code>;
      if (line === '')
        return <br key={i} />;
      return <p key={i} className="font-barlow text-[14px] text-body leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${
        isUser ? 'bg-amber/10 border border-amber/20' : 'bg-heading border border-gray-700'}`}>
        {isUser
          ? <User size={15} className="text-amber" />
          : <Bot size={15} className="text-amber" />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] group ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className={`rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-amber text-white rounded-tr-sm'
            : 'bg-white border border-border rounded-tl-sm'}`}>
          {isUser
            ? <p className="font-barlow text-[14px] text-white">{msg.content}</p>
            : <div className="space-y-1">{renderContent(msg.content)}</div>}
        </div>
        {/* Copy button (assistant only) */}
        {!isUser && (
          <button onClick={copy}
            className="mt-1 opacity-0 group-hover:opacity-100 transition-opacity
                       flex items-center gap-1 text-[11px] font-barlow text-gray-400 hover:text-amber">
            {copied ? <><CheckCircle size={11} className="text-green-500"/>Copied</> : <><Copy size={11}/>Copy</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: "Hello! I'm TimberStruct AI, powered by Amazon Bedrock.\n\nI specialise in timber structural engineering, Eurocode 5 compliance, member sizing and East African procurement. Ask me anything about your project — or try one of the suggestions below.",
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const textareaRef           = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newHistory.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data  = await response.json();
      const reply = data.content?.map(b => b.text).join('') || 'Sorry, I could not process that request.';
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please check your network and try again.' }]);
    }
    setLoading(false);
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const reset = () => {
    setMessages([{
      role: 'assistant',
      content: "Conversation cleared. How can I help with your timber engineering project?",
    }]);
    setInput('');
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-64px)]">

        {/* Header */}
        <div className="px-6 md:px-8 py-5 border-b border-border bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <Zap size={20} className="text-green-600" />
            </div>
            <div>
              <p className="section-label">Service & AI Intelligence</p>
              <h1 className="font-condensed font-extrabold text-heading uppercase"
                style={{ fontSize: 'clamp(20px,2vw,28px)' }}>AI Design Assistant</h1>
            </div>
          </div>
          <button onClick={reset}
            className="flex items-center gap-1.5 font-barlow text-[12px] text-gray-400 hover:text-amber transition-colors uppercase tracking-widest">
            <RefreshCw size={13} /> Clear
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-5 bg-page">

          {/* Suggestions (show when only 1 message) */}
          {messages.length === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
              {SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => setInput(s)}
                  className="text-left bg-white border border-border rounded-lg p-3 text-[13px]
                             font-barlow text-body hover:border-amber hover:text-heading
                             transition-all duration-150">
                  <Zap size={12} className="text-amber inline mr-1.5 mb-0.5" />
                  {s}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-heading flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-amber" />
              </div>
              <div className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-2">
                <Loader size={14} className="text-amber animate-spin" />
                <span className="font-barlow text-[13px] text-gray-400">Analysing your project…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 border-t border-border bg-white px-6 md:px-8 py-4">
          <div className="max-w-4xl mx-auto flex gap-3 items-end">
            <div className="flex-1 bg-page border border-border rounded-xl px-4 py-3 focus-within:border-amber transition-colors">
              <textarea
                ref={textareaRef}
                rows={2}
                className="w-full bg-transparent font-barlow text-[14px] text-heading resize-none
                           outline-none placeholder:text-gray-400 leading-relaxed"
                placeholder="Describe your project or ask a structural engineering question… (Enter to send, Shift+Enter for new line)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
              />
            </div>
            <button onClick={send} disabled={loading || !input.trim()}
              className="btn-amber !px-4 !py-3 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed">
              {loading ? <Loader size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          </div>
          <p className="text-center font-barlow text-[11px] text-gray-400 mt-2">
            Powered by Amazon Bedrock · Timber engineering specialist · Eurocode 5
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
