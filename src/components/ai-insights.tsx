"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock3, RefreshCw, Sparkles, Target, TrendingUp, Trophy, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AIAssistantChat from "@/components/ai-assistant-chat";

type Lead = { id:string; first_name:string; last_name:string|null; score:number|null; status:string; estimated_value:number|null; created_at:string; email:string|null };
type Deal = { id:string; title:string; stage:string; amount:number|null; updated_at:string|null; created_at:string };
type Task = { id:string; title:string; status:string; due_at:string|null };
type Insight = { kind:"priority"|"opportunity"|"risk"|"win"; title:string; detail:string; action:string; icon:"alert"|"target"|"clock"|"trophy" };

const money = (value:number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(value);
const daysSince = (value:string) => Math.floor((Date.now()-new Date(value).getTime())/86400000);

export default function AIInsights({ organizationId, onNavigate }:{organizationId:string|null;onNavigate:(section:string)=>void}) {
  const [leads,setLeads]=useState<Lead[]>([]);
  const [deals,setDeals]=useState<Deal[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [updatedAt,setUpdatedAt]=useState<Date|null>(null);
  const [refreshKey,setRefreshKey]=useState(0);

  const load = useCallback(async () => {
    if(!organizationId){setLoading(false);return;}
    setLoading(true);setError("");
    try {
      const supabase=createClient();
      const [leadResult,dealResult,taskResult]=await Promise.all([
        supabase.from("leads").select("id,first_name,last_name,score,status,estimated_value,created_at,email").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(1000),
        supabase.from("deals").select("id,title,stage,amount,updated_at,created_at").eq("organization_id",organizationId).order("updated_at",{ascending:false}).limit(1000),
        supabase.from("tasks").select("id,title,status,due_at").eq("organization_id",organizationId).in("status",["open","in_progress"]).order("due_at",{ascending:true}).limit(500)
      ]);
      if(leadResult.error)throw leadResult.error;if(dealResult.error)throw dealResult.error;if(taskResult.error)throw taskResult.error;
      setLeads((leadResult.data||[]) as Lead[]);setDeals((dealResult.data||[]) as Deal[]);setTasks((taskResult.data||[]) as Task[]);setUpdatedAt(new Date());
    } catch(e){setError(e instanceof Error?e.message:"Could not load sales data.");}
    finally{setLoading(false);}
  },[organizationId]);
  useEffect(()=>{void load();},[load,refreshKey]);

  const analysis=useMemo(()=>{
    const activeLeads=leads.filter(l=>!["converted","lost"].includes((l.status||"").toLowerCase()));
    const hot=activeLeads.filter(l=>Number(l.score||0)>=70).sort((a,b)=>Number(b.score||0)-Number(a.score||0));
    const stale=activeLeads.filter(l=>daysSince(l.created_at)>=14).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
    const openDeals=deals.filter(d=>!["won","lost"].includes((d.stage||"").toLowerCase()));
    const stalled=openDeals.filter(d=>daysSince(d.updated_at||d.created_at)>=21).sort((a,b)=>daysSince(b.updated_at||b.created_at)-daysSince(a.updated_at||a.created_at));
    const overdue=tasks.filter(t=>t.due_at&&new Date(t.due_at).getTime()<Date.now()).sort((a,b)=>new Date(a.due_at!).getTime()-new Date(b.due_at!).getTime());
    const won=deals.filter(d=>(d.stage||"").toLowerCase()==="won");
    const pipeline=openDeals.reduce((s,d)=>s+Number(d.amount||0),0);
    const wonValue=won.reduce((s,d)=>s+Number(d.amount||0),0);
    const stageWeights:Record<string,number>={discovery:.1,qualification:.25,proposal:.5,negotiation:.75};
    const weighted=openDeals.reduce((s,d)=>s+Number(d.amount||0)*(stageWeights[(d.stage||"").toLowerCase()]??.2),0);
    const insights:Insight[]=[];
    if(overdue.length)insights.push({kind:"priority",title:`${overdue.length} overdue task${overdue.length===1?"":"s"} need attention`,detail:`The oldest overdue item is “${overdue[0].title}”. Clearing overdue work protects active opportunities.`,action:"Review tasks",icon:"clock"});
    if(hot.length)insights.push({kind:"opportunity",title:`${hot.length} high-scoring lead${hot.length===1?"":"s"} are worth contacting`,detail:`${hot.slice(0,3).map(l=>[l.first_name,l.last_name].filter(Boolean).join(" ")).join(", ")} ${hot.length===1?"has":"have"} a lead score of 70 or higher.`,action:"Open leads",icon:"target"});
    if(stalled.length)insights.push({kind:"risk",title:`${stalled.length} deal${stalled.length===1?"":"s"} may be stalled`,detail:`${stalled[0].title} has not been updated for ${daysSince(stalled[0].updated_at||stalled[0].created_at)} days. Check the next step and decision owner.`,action:"Review deals",icon:"alert"});
    if(stale.length)insights.push({kind:"risk",title:`${stale.length} lead${stale.length===1?"":"s"} have gone quiet`,detail:`${stale.slice(0,3).map(l=>[l.first_name,l.last_name].filter(Boolean).join(" ")).join(", ")} ${stale.length===1?"has":"have"} been in the active lead pool for at least 14 days.`,action:"Re-engage leads",icon:"alert"});
    if(won.length)insights.push({kind:"win",title:`${won.length} deals won so far`,detail:`Recorded won-deal value is ${money(wonValue)}. Use these wins to identify repeatable sales patterns.`,action:"View won deals",icon:"trophy"});
    if(!insights.length)insights.push({kind:"opportunity",title:"Your sales workspace is clear",detail:"No overdue tasks, high-score leads, or stalled deals were detected in the records currently loaded.",action:"Refresh insights",icon:"target"});
    return {activeLeads:activeLeads.length,hot:hot.length,stalled:stalled.length,overdue:overdue.length,pipeline,weighted,wonValue,insights};
  },[leads,deals,tasks]);

  const iconFor=(name:Insight["icon"])=>name==="clock"?<Clock3 size={17}/>:name==="target"?<Target size={17}/>:name==="trophy"?<Trophy size={17}/>:<AlertTriangle size={17}/>;
  const openSection=(item:Insight)=>onNavigate(item.kind==="priority"?"Tasks":item.kind==="win"?"Deals":item.title.toLowerCase().includes("deal")?"Deals":"Overview");
  return <div className="ai-insights">
    <div className="ai-hero"><div className="ai-hero-icon"><Sparkles size={22}/></div><div><div className="eyebrow"><span className="live-dot"/> SALES INTELLIGENCE</div><h1>Your sales, decoded.</h1><p>Practical signals calculated from your live CRM records—not invented forecasts.</p></div><button className="date-btn" onClick={()=>setRefreshKey(v=>v+1)} disabled={loading}><RefreshCw size={14} className={loading?"spin":""}/> Refresh analysis</button></div>
    <AIAssistantChat />
    {error&&<div className="entity-error">{error}</div>}
    <div className="ai-metric-grid">
      <div className="ai-metric"><span>Active leads</span><b>{loading?"—":analysis.activeLeads}</b><small>Not converted or lost</small></div>
      <div className="ai-metric"><span>High-priority leads</span><b>{loading?"—":analysis.hot}</b><small>Lead score 70+</small></div>
      <div className="ai-metric"><span>At-risk deals</span><b>{loading?"—":analysis.stalled}</b><small>No update in 21+ days</small></div>
      <div className="ai-metric"><span>Overdue tasks</span><b>{loading?"—":analysis.overdue}</b><small>Past due date, still open</small></div>
    </div>
    <div className="ai-insight-layout">
      <section className="panel ai-recommendations"><div className="panel-head"><div><h3><Sparkles size={15}/> Recommended next moves</h3><p>Prioritized from your current pipeline activity</p></div><span className="ai-live-tag"><Activity size={12}/> LIVE DATA</span></div>
        {loading?<div className="empty">Analyzing your workspace…</div>:<div className="ai-insight-list">{analysis.insights.map((item,index)=><article className={"ai-insight-card "+item.kind} key={item.title}><div className="ai-insight-icon">{iconFor(item.icon)}</div><div className="ai-insight-body"><span className="ai-priority">{item.kind==="priority"?"DO FIRST":item.kind==="risk"?"RISK TO REVIEW":item.kind==="win"?"MOMENTUM":"OPPORTUNITY"}</span><h4>{item.title}</h4><p>{item.detail}</p><button onClick={()=>openSection(item)}>{item.action} <ArrowRight size={13}/></button></div><span className="ai-rank">0{index+1}</span></article>)}</div>}
      </section>
      <aside className="panel ai-pipeline-card"><div className="panel-head"><div><h3>Pipeline snapshot</h3><p>Current open-deal value</p></div><TrendingUp size={17}/></div><div className="ai-pipeline-value">{loading?"—":money(analysis.pipeline)}</div><div className="ai-pipeline-row"><span>Weighted estimate*</span><b>{loading?"—":money(analysis.weighted)}</b></div><div className="ai-pipeline-row"><span>Won deal value</span><b>{loading?"—":money(analysis.wonValue)}</b></div><div className="ai-pipeline-note">*Stage-weighted estimate using indicative probabilities (Discovery 10%, Qualification 25%, Proposal 50%, Negotiation 75%). This is a planning aid, not a prediction.</div><div className="ai-pipeline-footer"><Zap size={14}/> {deals.length} deals analyzed</div></aside>
    </div>
    <div className="ai-footnote"><CalendarClock size={14}/> {updatedAt? "Last analyzed "+updatedAt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}):"Waiting for workspace data"} · Based on up to 1,000 leads, 1,000 deals and 500 open tasks. <CheckCircle2 size={14}/></div>
  </div>;
}
