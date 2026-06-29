import { useEffect, useRef, useState } from 'react';
import { DollarSign, TrendingUp, Building2 } from 'lucide-react';

interface MoneyDisplayProps {
  money: number;
  monthlyIncome: number;
  empireValue: number;
}

function CountUp({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const [rising, setRising] = useState(false);

  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = 20;
    const stepVal = diff / steps;
    let current = prev.current;
    let step = 0;
    setRising(diff > 0);
    const id = setInterval(() => {
      step++;
      current += stepVal;
      setDisplay(Math.round(current));
      if (step >= steps) {
        setDisplay(value);
        prev.current = value;
        setRising(false);
        clearInterval(id);
      }
    }, 25);
    return () => clearInterval(id);
  }, [value]);

  const formatted = display >= 1_000_000
    ? `${prefix}${(display / 1_000_000).toFixed(1)}M${suffix}`
    : display >= 1_000
    ? `${prefix}${(display / 1_000).toFixed(0)}k${suffix}`
    : `${prefix}${display.toLocaleString()}${suffix}`;

  return (
    <span className={`transition-colors duration-300 ${rising ? 'text-emerald-300' : ''}`}>
      {formatted}
    </span>
  );
}

const STATS = [
  {
    key: 'money' as const,
    label: 'Balance',
    sublabel: 'Advisory earnings',
    Icon: DollarSign,
    color: '#10b981',
    glowColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.25)',
    prefix: '€',
  },
  {
    key: 'monthlyIncome' as const,
    label: 'Monthly Income',
    sublabel: 'Advisory fees / mo',
    Icon: TrendingUp,
    color: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.15)',
    borderColor: 'rgba(59,130,246,0.25)',
    prefix: '€',
    suffix: '/mo',
  },
  {
    key: 'empireValue' as const,
    label: 'Empire Value',
    sublabel: 'Total asset estimate',
    Icon: Building2,
    color: '#f59e0b',
    glowColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.25)',
    prefix: '€',
  },
];

export const MoneyDisplay = ({ money, monthlyIncome, empireValue }: MoneyDisplayProps) => {
  const values = { money, monthlyIncome, empireValue };

  return (
    <div className="grid grid-cols-3 gap-3">
      {STATS.map(({ key, label, sublabel, Icon, color, glowColor, borderColor, prefix, suffix }) => (
        <div
          key={key}
          className="relative overflow-hidden rounded-xl border p-4 transition-all duration-300 group hover:-translate-y-0.5"
          style={{
            background: `linear-gradient(135deg, ${glowColor} 0%, rgba(2,6,23,0.95) 100%)`,
            borderColor,
            boxShadow: `0 0 20px ${glowColor}`,
          }}
        >
          {/* Corner glow */}
          <div
            className="absolute -top-4 -right-4 w-16 h-16 rounded-full blur-2xl opacity-40 pointer-events-none"
            style={{ backgroundColor: color }}
          />

          <div className="relative flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: color + 'aa' }}>
                {label}
              </p>
              <p
                className="text-xl font-black leading-none tabular-nums"
                style={{ color }}
              >
                <CountUp value={values[key]} prefix={prefix} suffix={suffix} />
              </p>
              <p className="text-xs text-slate-600 mt-1">{sublabel}</p>
            </div>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: glowColor, border: `1px solid ${borderColor}` }}
            >
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
          </div>

          {/* Bottom shimmer line on hover */}
          <div
            className="absolute bottom-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          />
        </div>
      ))}
    </div>
  );
};
