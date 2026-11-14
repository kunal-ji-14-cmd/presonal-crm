"use client";

import { FormEvent, useRef, useState } from "react";
import { Bot, Send, Sparkles, User, LoaderCircle } from "lucide-react";

type Message = { role: "user" | "assistant"; content: string };
const starters = [
  "Which leads should I contact first?",
  "What are the biggest risks in my pipeline?",
  "Write a follow-up for my highest-scoring lead.",
  "Summarize my sales performance."
];

export default function AIAssistantChat() {
  const [messages,setMessages]=useState<Message[]>([]);
  const [draft,setDraft]=useState("");
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");
  const scrollRef=useRef<HTMLDivElement>(null);

  async function send(text=draft) {
    const content=text.trim();
    if(!content||sending)return;
    const next=[...messages,{role:"user" as const,content}];
    setMessages(next);setDraft("");setError("");setSending(true);
    try {
      const response=await fetch("/api/ai/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:content,history:messages.slice(-10)})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"The AI assistant could not respond.");
      setMessages([...next,{role:"assistant",content:data.answer}]);
      requestAnimationFrame(()=>scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:"smooth"}));
    } catch(e) {
      setError(e instanceof Error?e.message:"Unable to reach the AI assistant.");
    } finally {setSending(false);}
  }

  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void send();}
  return <section className="panel ai-chat-panel">
    <div className="panel-head"><div><h3><Sparkles size={15}/> Ask Nexus AI</h3><p>Ask questions about your CRM and get actionable sales advice.</p></div><span className="ai-live-tag"><Bot size={12}/> AI ASSISTANT</span></div>
    <div className="ai-chat-body" ref={scrollRef}>
      {messages.length===0?<div className="ai-chat-welcome"><div className="ai-chat-orb"><Sparkles size={23}/></div><h3>Your sales copilot is ready.</h3><p>Ask about leads, deals, follow-ups, tasks, or your pipeline. Answers use your workspace data.</p><div className="ai-prompt-grid">{starters.map(prompt=><button key={prompt} onClick={()=>void send(prompt)} disabled={sending}>{prompt}<span>↗</span></button>)}</div></div>:<div className="ai-chat-messages">{messages.map((message,index)=><div className={"ai-chat-message "+message.role} key={index}><div className="ai-chat-avatar">{message.role==="assistant"?<Bot size={16}/>:<User size={15}/>}</div><div className="ai-chat-bubble"><span>{message.role==="assistant"?"Nexus AI":"You"}</span><p>{message.content}</p></div></div>)}{sending&&<div className="ai-chat-message assistant"><div className="ai-chat-avatar"><Bot size={16}/></div><div className="ai-chat-bubble"><span>Nexus AI</span><p className="ai-thinking"><LoaderCircle size={14}/> Thinking with your CRM data…</p></div></div>}</div>}
    </div>
    {error&&<div className="ai-chat-error">{error}</div>}
    <form className="ai-chat-form" onSubmit={submit}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ask about your sales pipeline…" maxLength={4000} disabled={sending}/><button type="submit" disabled={sending||!draft.trim()} aria-label="Send message"><Send size={16}/></button></form>
    <div className="ai-chat-disclaimer">AI can make mistakes. Review suggestions before acting. It cannot modify or contact CRM records.</div>
  </section>;
}
