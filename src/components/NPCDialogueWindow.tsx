import { useState, useEffect, useRef } from 'react';
import {
  ActiveNPCDialogue, NPCDialogueChoice, RelationshipStatus,
} from '../types/game';
import {
  statusColor, statusLabel, NPC_TYPE_LABELS, NPC_TYPE_COLORS, PERSONALITY_LABELS,
} from '../services/npcService';
import {
  X, TrendingUp, Star, ChevronRight,
  MessageCircle, Shield, Brain, Users, AlertTriangle, CheckCircle2, Lock,
} from 'lucide-react';

// ─── Trust bar ────────────────────────────────────────────────────────────────

function TrustBar({ trust, status, color }: { trust: number; status: RelationshipStatus; color: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">Trust</span>
        <div className="flex items-center gap-1.5">
          <span className="font-black" style={{ color }}>{trust}</span>
          <span className="px-1.5 py-0.5 rounded font-bold text-[10px]"
            style={{ color, backgroundColor: color + '20', border: `1px solid ${color}40` }}>
            {statusLabel[status]}
          </span>
        </div>
      </div>
      <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 relative overflow-hidden"
          style={{
            width: mounted ? `${trust}%` : '0%',
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}60`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
            style={{ backgroundSize: '200% 100%' }} />
        </div>
      </div>
      {/* Threshold markers */}
      {[30, 50, 70, 90].map(t => (
        <div key={t} className="absolute top-0 bottom-0 w-px bg-slate-900/60" style={{ left: `${t}%` }} />
      ))}
    </div>
  );
}

// ─── NPC avatar ───────────────────────────────────────────────────────────────

function NPCAvatar({
  initials, color, type, size = 'lg',
}: {
  initials: string; color: string; type: string; size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  const typeColor = NPC_TYPE_COLORS[type] ?? color;

  return (
    <div className={`relative ${sizeClass} rounded-2xl flex-shrink-0`}>
      {/* Outer ring */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background: `conic-gradient(${color}, ${typeColor}, ${color})`,
          padding: '2px',
          animation: 'spin-slow 12s linear infinite',
        }}
      />
      {/* Inner */}
      <div
        className={`absolute inset-[2px] rounded-[14px] flex items-center justify-center font-black`}
        style={{ background: `linear-gradient(135deg, ${color}30, ${color}15)`, border: `1px solid ${color}40` }}
      >
        <span style={{ color }}>{initials}</span>
      </div>
    </div>
  );
}

// ─── Personality tag ──────────────────────────────────────────────────────────

function PersonalityTag({ personality, negotiation }: { personality: string; negotiation: string }) {
  const personalityIcons: Record<string, React.ElementType> = {
    analytical: Brain, aggressive: AlertTriangle, charming: Star,
    cautious: Shield, visionary: TrendingUp, pragmatic: Users,
  };
  const Icon = personalityIcons[personality] ?? Star;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/50">
        <Icon className="w-2.5 h-2.5" />
        {PERSONALITY_LABELS[personality as keyof typeof PERSONALITY_LABELS] ?? personality}
      </span>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-500 border border-slate-700/50">
        {negotiation.replace('_', ' ')}
      </span>
    </div>
  );
}

// ─── Choice delta pills ───────────────────────────────────────────────────────

function DeltaPills({ choice }: { choice: NPCDialogueChoice }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {choice.trust_delta !== 0 && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
          choice.trust_delta > 0 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/40' : 'bg-red-950/60 text-red-400 border border-red-900/40'
        }`}>
          {choice.trust_delta > 0 ? '+' : ''}{choice.trust_delta} trust
        </span>
      )}
      {choice.rep_delta !== 0 && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
          choice.rep_delta > 0 ? 'bg-blue-950/60 text-blue-400 border border-blue-900/40' : 'bg-red-950/60 text-red-400 border border-red-900/40'
        }`}>
          {choice.rep_delta > 0 ? '+' : ''}{choice.rep_delta} rep
        </span>
      )}
      {choice.money_delta > 0 && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-900/40">
          +€{choice.money_delta.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ─── Memory notes ─────────────────────────────────────────────────────────────

function MemoryNotes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Memory</p>
      <div className="space-y-1">
        {notes.slice(-3).map((note, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-500 bg-slate-900/40 rounded-lg px-2 py-1.5 border border-slate-800/50">
            <MessageCircle className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 text-slate-600" />
            <span className="leading-relaxed">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface NPCDialogueWindowProps {
  dialogue: ActiveNPCDialogue;
  playerNegotiation: number;
  playerNetworking: number;
  onChoice: (choice: NPCDialogueChoice) => void;
  onClose: () => void;
}

export const NPCDialogueWindow = ({
  dialogue, playerNegotiation, playerNetworking, onChoice, onClose,
}: NPCDialogueWindowProps) => {
  const [phase, setPhase] = useState<'enter' | 'show' | 'typing' | 'choices' | 'outcome' | 'exit'>('enter');
  const [typedText, setTypedText] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<NPCDialogueChoice | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const typeRef = useRef<ReturnType<typeof setInterval>>();
  const { npc, relationship, dialogue: dlg } = dialogue;

  const color = npc.accent_color;
  const typeColor = NPC_TYPE_COLORS[npc.type] ?? color;
  const sColor = statusColor[relationship.relationship_status];

  // Entrance
  useEffect(() => {
    const t = setTimeout(() => setPhase('typing'), 80);
    return () => clearTimeout(t);
  }, []);

  // Typewriter effect for greeting
  useEffect(() => {
    if (phase !== 'typing') return;
    const text = dlg.greeting.replace(/^"|"$/g, '');
    let i = 0;
    typeRef.current = setInterval(() => {
      i++;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(typeRef.current);
        setTimeout(() => setPhase('choices'), 400);
      }
    }, 28);
    return () => clearInterval(typeRef.current);
  }, [phase, dlg.greeting]);

  const handleChoiceClick = (choice: NPCDialogueChoice) => {
    if (choice.requiresNegotiation && playerNegotiation < choice.requiresNegotiation) return;
    if (choice.requiresNetworking && playerNetworking < choice.requiresNetworking) return;
    if (choice.requiresTrust && relationship.trust_level < choice.requiresTrust) return;
    setSelectedChoice(choice);
    setShowOutcome(true);
    setTimeout(() => onChoice(choice), 2200);
  };

  const isChoiceLocked = (choice: NPCDialogueChoice): { locked: boolean; reason: string } => {
    if (choice.requiresNegotiation && playerNegotiation < choice.requiresNegotiation)
      return { locked: true, reason: `Requires Negotiation ${choice.requiresNegotiation}` };
    if (choice.requiresNetworking && playerNetworking < choice.requiresNetworking)
      return { locked: true, reason: `Requires Networking ${choice.requiresNetworking}` };
    if (choice.requiresTrust && relationship.trust_level < choice.requiresTrust)
      return { locked: true, reason: `Requires Trust ${choice.requiresTrust}` };
    return { locked: false, reason: '' };
  };

  return (
    <>
      <style>{`
        @keyframes dialogueSlideIn {
          from { transform: translateY(24px) scale(0.97); opacity: 0; filter: blur(3px); }
          to   { transform: translateY(0) scale(1);       opacity: 1; filter: blur(0); }
        }
        @keyframes dialogueSlideOut {
          from { transform: translateY(0) scale(1); opacity: 1; }
          to   { transform: translateY(-16px) scale(0.97); opacity: 0; }
        }
        @keyframes choiceFadeIn {
          from { transform: translateX(-12px); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
        @keyframes outcomePop {
          0%   { transform: scale(0.95); opacity: 0; }
          60%  { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes typewriterCursor {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .dialogue-cursor::after {
          content: '|';
          animation: typewriterCursor 0.8s ease-in-out infinite;
          color: inherit;
          margin-left: 1px;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center pb-4 sm:pb-0 px-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ background: 'rgba(2,6,23,0.75)', backdropFilter: 'blur(6px)', animation: 'rareBackdropIn 0.3s ease both' }}
      >
        {/* Window */}
        <div
          className="w-full max-w-xl"
          style={{ animation: 'dialogueSlideIn 0.4s cubic-bezier(0.22,1,0.36,1) both' }}
        >
          {/* Top accent */}
          <div className="h-px w-full rounded-t-2xl"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, ${typeColor}, ${color}, transparent)` }} />

          <div
            className="rounded-b-2xl overflow-hidden"
            style={{
              background: 'linear-gradient(160deg, rgba(8,12,30,0.98), rgba(2,6,23,0.99))',
              border: `1px solid ${color}35`,
              borderTop: 'none',
              boxShadow: `0 0 60px ${color}25, 0 24px 60px rgba(0,0,0,0.8)`,
            }}
          >
            {/* ── Header ─────────────────────────────────────────────────── */}
            <div className="p-5 pb-4">
              <div className="flex items-start gap-4">
                <NPCAvatar initials={npc.avatar_initials} color={color} type={npc.type} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-black text-white leading-tight">{npc.name}</h2>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: color + 'cc' }}>{npc.title}</p>
                      <p className="text-[10px] text-slate-600 mt-0.5">{npc.district_name}</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 rounded-lg border border-slate-700/50 hover:border-slate-500 text-slate-600 hover:text-slate-300 transition-all flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Type + personality */}
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="text-[10px] font-black px-2 py-0.5 rounded"
                      style={{ color: typeColor, backgroundColor: typeColor + '20', border: `1px solid ${typeColor}35` }}
                    >
                      {NPC_TYPE_LABELS[npc.type]}
                    </span>
                    <PersonalityTag personality={npc.personality} negotiation={npc.negotiation_style} />
                  </div>
                </div>
              </div>

              {/* Trust bar */}
              <div className="mt-4">
                <TrustBar
                  trust={relationship.trust_level}
                  status={relationship.relationship_status}
                  color={sColor}
                />
              </div>

              {/* Interaction count */}
              {relationship.interaction_count > 0 && (
                <p className="text-[10px] text-slate-700 mt-1.5">
                  {relationship.interaction_count} previous interaction{relationship.interaction_count !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* ── Divider ─────────────────────────────────────────────────── */}
            <div className="mx-5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}30, transparent)` }} />

            {/* ── Dialogue body ───────────────────────────────────────────── */}
            <div className="p-5 pt-4 space-y-4">

              {/* Greeting (typewriter) */}
              <div
                className="rounded-xl p-4 relative"
                style={{
                  background: `linear-gradient(135deg, ${color}0d, transparent)`,
                  border: `1px solid ${color}20`,
                }}
              >
                {/* Speech bubble pointer */}
                <div className="absolute -top-1.5 left-6 w-3 h-3 rotate-45 border-t border-l"
                  style={{ backgroundColor: color + '20', borderColor: color + '25' }} />
                <p className="text-white font-bold text-sm leading-relaxed italic">
                  "{phase === 'typing' || phase === 'choices'
                    ? <span className={phase === 'typing' ? 'dialogue-cursor' : ''}>{typedText}</span>
                    : <span>{dlg.greeting.replace(/^"|"$/g, '')}</span>
                  }"
                </p>
              </div>

              {/* Body narrative */}
              {(phase === 'choices' || showOutcome) && (
                <p className="text-slate-400 text-sm leading-relaxed" style={{ animation: 'choiceFadeIn 0.4s ease both' }}>
                  {dlg.body}
                </p>
              )}

              {/* Memory notes */}
              {(phase === 'choices' || showOutcome) && relationship.notes.length > 0 && (
                <div style={{ animation: 'choiceFadeIn 0.4s ease 0.1s both' }}>
                  <MemoryNotes notes={relationship.notes} />
                </div>
              )}

              {/* ── Choices ──────────────────────────────────────────────── */}
              {phase === 'choices' && !showOutcome && (
                <div className="space-y-2" style={{ animation: 'choiceFadeIn 0.3s ease 0.15s both' }}>
                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Your response</p>
                  {dlg.choices.map((choice, i) => {
                    const { locked, reason } = isChoiceLocked(choice);
                    return (
                      <button
                        key={choice.id}
                        onClick={() => handleChoiceClick(choice)}
                        disabled={locked}
                        className="w-full text-left rounded-xl border transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed group relative overflow-hidden"
                        style={{
                          borderColor: locked ? '#334155' : color + '30',
                          backgroundColor: locked ? 'transparent' : color + '08',
                          animation: `choiceFadeIn 0.3s ease ${0.15 + i * 0.08}s both`,
                        }}
                      >
                        {/* Hover glow */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                          style={{ background: `linear-gradient(135deg, ${color}12, transparent)` }} />

                        <div className="relative p-3.5">
                          <div className="flex items-start gap-3">
                            <div
                              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black mt-0.5"
                              style={{ backgroundColor: locked ? '#334155' : color + '25', color: locked ? '#475569' : color }}
                            >
                              {locked ? <Lock className="w-2.5 h-2.5" /> : String.fromCharCode(65 + i)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-sm font-bold ${locked ? 'text-slate-600' : 'text-white group-hover:text-white'}`}>
                                  {choice.label}
                                </span>
                                <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5 ${locked ? 'text-slate-700' : 'text-slate-600'}`} />
                              </div>
                              <p className={`text-xs mt-0.5 ${locked ? 'text-slate-700' : 'text-slate-500'}`}>
                                {locked ? reason : choice.subtext}
                              </p>
                              {!locked && <div className="mt-2"><DeltaPills choice={choice} /></div>}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Outcome ──────────────────────────────────────────────── */}
              {showOutcome && selectedChoice && (
                <div style={{ animation: 'outcomePop 0.4s cubic-bezier(0.22,1,0.36,1) both' }}>
                  {/* NPC response */}
                  <div
                    className="rounded-xl p-4 mb-3"
                    style={{ background: `linear-gradient(135deg, ${color}12, transparent)`, border: `1px solid ${color}25` }}
                  >
                    <p className="text-white text-sm leading-relaxed italic font-medium">
                      "{selectedChoice.outcome_text}"
                    </p>
                  </div>

                  {/* Result summary */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color }} />
                    <span className="text-xs text-slate-400">Interaction logged.</span>
                    <DeltaPills choice={selectedChoice} />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom accent */}
            <div className="h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${color}25, transparent)` }} />
          </div>
        </div>
      </div>
    </>
  );
};
