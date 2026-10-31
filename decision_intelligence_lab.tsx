import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

// ==========================================
// INDIAN NUMBER FORMATTING
// ==========================================
const formatINR = (num) => {
  if (typeof num !== 'number' || isNaN(num)) return '₹0';
  const negative = num < 0;
  const abs = Math.abs(Math.round(num));
  const str = abs.toString();
  if (str.length <= 3) return `${negative ? '-' : ''}₹${str}`;
  const last3 = str.slice(-3);
  const rest = str.slice(0, -3);
  const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  return `${negative ? '-' : ''}₹${formatted}`;
};

const formatINRShort = (num) => {
  const abs = Math.abs(num);
  if (abs >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
  if (abs >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (abs >= 1000) return `${(num / 1000).toFixed(0)}k`;
  return num.toString();
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function App() {
  // Slider state
  const [salary, setSalary] = useState(67500);
  const [expenses, setExpenses] = useState(15000);
  const [prepMonths, setPrepMonths] = useState(4);
  const [savings, setSavings] = useState(60000);

  // Computed results
  const results = useMemo(() => {
    const earningMonths = Math.max(0, 12 - prepMonths);
    const totalIncome = salary * earningMonths;
    const totalExpenses12 = expenses * 12;
    const netPosition = savings + totalIncome - totalExpenses12;
    const runway = expenses > 0 ? savings / expenses : Infinity;

    // 12-month timeline
    const timeline = [];
    let balance = savings;
    for (let m = 1; m <= 12; m++) {
      const isPreparing = m <= prepMonths;
      const monthIncome = isPreparing ? 0 : salary;
      balance += monthIncome - expenses;
      timeline.push({
        month: `Month ${m}`,
        label: `M${m}`,
        balance: Math.round(balance),
        income: Math.round(monthIncome),
        expenses: Math.round(expenses),
        net: Math.round(monthIncome - expenses),
      });
    }

    // Recommendation engine
    let rec;
    if (prepMonths === 0) {
      rec = {
        type: 'positive',
        title: 'Earning starts immediately',
        desc: 'With no preparation gap, income begins from month one. Consider whether additional upskilling could unlock a higher salary.',
      };
    } else if (prepMonths <= runway) {
      rec = {
        type: 'positive',
        title: 'A preparation window may be workable',
        desc: `Your current savings cover ${runway.toFixed(1)} months of expenses. Your selected ${prepMonths}-month preparation window fits within that buffer; weigh this against the extra time needed to build skills.`,
      };
    } else {
      rec = {
        type: 'warning',
        title: 'Preparation period exceeds your financial runway',
        desc: `Your savings only cover ${runway.toFixed(1)} months of expenses, but you've planned ${prepMonths} months of preparation. Consider reducing prep time or increasing savings first.`,
      };
    }

    return { netPosition, runway, totalIncome, totalExpenses12, timeline, rec, earningMonths };
  }, [salary, expenses, prepMonths, savings]);

  return (
    <div className="min-h-screen bg-[#0c1222] text-white font-sans antialiased">
      <div className="max-w-6xl mx-auto px-6 py-10 md:px-10 lg:px-16">

        {/* ── HEADER ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-3">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Decision Lab<span className="text-emerald-400">.</span>
          </h1>
          <span className="px-4 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-full tracking-widest uppercase whitespace-nowrap shadow-lg shadow-emerald-600/20">
            Live Simulator · INR
          </span>
        </div>

        <p className="text-slate-400 text-sm md:text-[15px] max-w-2xl leading-relaxed mb-10">
          Should you take a job now, or keep studying for a better role? Adjust the salary, monthly
          expenses, and preparation time to see how your cash runway and one-year outcome change in
          real time.
        </p>

        {/* ── TWO-COLUMN LAYOUT ── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">

          {/* LEFT COLUMN — Shape your scenario */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-800 bg-[#111a2e] space-y-8">
            <div>
              <h2 className="text-lg font-bold mb-1">Shape your scenario</h2>
              <p className="text-[12px] text-slate-400 leading-relaxed">
                These are illustrative estimates, not a prediction. Move a slider to model your own situation.
              </p>
            </div>

            {/* Slider — Monthly take-home salary */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="text-[13px] text-slate-200 font-medium">Monthly take-home salary</label>
                <span className="text-[13px] font-bold text-emerald-400 font-mono">{formatINR(salary)}</span>
              </div>
              <input
                type="range" min={10000} max={100000} step={500}
                value={salary}
                onChange={(e) => setSalary(Number(e.target.value))}
                className="w-full h-[6px] rounded-full appearance-none cursor-pointer accent-teal-500"
                style={{ background: `linear-gradient(to right, #0d9488 ${((salary - 10000) / 90000) * 100}%, #1e293b ${((salary - 10000) / 90000) * 100}%)` }}
              />
              <p className="text-[11px] text-slate-500">₹10k–₹1 lakh per month</p>
            </div>

            {/* Slider — Monthly living expenses */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="text-[13px] text-slate-200 font-medium">Monthly living expenses</label>
                <span className="text-[13px] font-bold text-emerald-400 font-mono">{formatINR(expenses)}</span>
              </div>
              <input
                type="range" min={5000} max={80000} step={500}
                value={expenses}
                onChange={(e) => setExpenses(Number(e.target.value))}
                className="w-full h-[6px] rounded-full appearance-none cursor-pointer accent-teal-500"
                style={{ background: `linear-gradient(to right, #0d9488 ${((expenses - 5000) / 75000) * 100}%, #1e293b ${((expenses - 5000) / 75000) * 100}%)` }}
              />
              <p className="text-[11px] text-slate-500">Rent, food, transport, bills, and essentials</p>
            </div>

            {/* Slider — Preparation months */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="text-[13px] text-slate-200 font-medium">Months spent preparing before earning</label>
                <div className="text-[13px] font-bold font-mono">
                  <span className="text-amber-400">{prepMonths}</span>
                  <span className="text-amber-400/70 ml-1.5">months</span>
                </div>
              </div>
              <input
                type="range" min={0} max={12} step={1}
                value={prepMonths}
                onChange={(e) => setPrepMonths(Number(e.target.value))}
                className="w-full h-[6px] rounded-full appearance-none cursor-pointer accent-teal-500"
                style={{ background: `linear-gradient(to right, #0d9488 ${(prepMonths / 12) * 100}%, #1e293b ${(prepMonths / 12) * 100}%)` }}
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>0</span>
                <span>12 months</span>
              </div>
            </div>

            {/* Slider — Current savings */}
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <label className="text-[13px] text-slate-200 font-medium">Current savings</label>
                <span className="text-[13px] font-bold text-emerald-400 font-mono">{formatINR(savings)}</span>
              </div>
              <input
                type="range" min={0} max={500000} step={5000}
                value={savings}
                onChange={(e) => setSavings(Number(e.target.value))}
                className="w-full h-[6px] rounded-full appearance-none cursor-pointer accent-teal-500"
                style={{ background: `linear-gradient(to right, #0d9488 ${(savings / 500000) * 100}%, #1e293b ${(savings / 500000) * 100}%)` }}
              />
              <p className="text-[11px] text-slate-500">Liquid cash you can access today</p>
            </div>
          </div>

          {/* RIGHT COLUMN — Your decision snapshot */}
          <div className="lg:col-span-3 space-y-6">
            <div>
              <h2 className="text-lg font-bold mb-1">Your decision snapshot</h2>
              <p className="text-[12px] text-slate-400">Calculated over the next 12 months from today.</p>
            </div>

            {/* Three metric cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Projected net position */}
              <div className="p-5 rounded-xl border border-slate-700/60 bg-[#111a2e] space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Projected net position</div>
                <div className={`text-2xl font-extrabold font-mono tracking-tight ${results.netPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatINR(results.netPosition)}
                </div>
                <div className="text-[10px] text-slate-500">Savings + income − expenses</div>
              </div>

              {/* Cash runway */}
              <div className="p-5 rounded-xl border border-slate-700/60 bg-[#111a2e] space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Cash runway before job</div>
                <div className="text-2xl font-extrabold font-mono tracking-tight text-white">
                  {results.runway === Infinity ? '∞' : results.runway.toFixed(1)} mo
                </div>
                <div className="text-[10px] text-slate-500">Savings ÷ monthly expenses</div>
              </div>

              {/* Income earned */}
              <div className="p-5 rounded-xl border border-slate-700/60 bg-[#111a2e] space-y-1.5">
                <div className="text-[11px] text-slate-400 font-medium">Income earned in 12 months</div>
                <div className="text-2xl font-extrabold font-mono tracking-tight text-amber-400">
                  {formatINR(results.totalIncome)}
                </div>
                <div className="text-[10px] text-slate-500">After preparation period</div>
              </div>
            </div>

            {/* Recommendation box */}
            <div className={`p-5 rounded-xl border ${
              results.rec.type === 'warning'
                ? 'border-rose-500/30 bg-rose-950/30'
                : 'border-slate-700/60 bg-[#111a2e]'
            }`}>
              <div className="flex items-start space-x-3">
                <span className={`text-base mt-0.5 ${results.rec.type === 'warning' ? 'text-rose-400' : 'text-blue-400'}`}>
                  ✦
                </span>
                <div>
                  <h4 className="font-bold text-[13px] text-white mb-1">{results.rec.title}</h4>
                  <p className="text-[12px] text-slate-300 leading-relaxed">{results.rec.desc}</p>
                </div>
              </div>
            </div>

            {/* Quick metrics row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-700/60 bg-[#111a2e]">
                <div className="text-[11px] text-slate-400 font-medium mb-1">Monthly surplus after job</div>
                <div className={`text-lg font-bold font-mono ${(salary - expenses) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatINR(salary - expenses)}
                  <span className="text-[11px] text-slate-500 font-normal ml-1">/mo</span>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-slate-700/60 bg-[#111a2e]">
                <div className="text-[11px] text-slate-400 font-medium mb-1">Total expenses over 12 months</div>
                <div className="text-lg font-bold font-mono text-slate-200">
                  {formatINR(results.totalExpenses12)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── CHART SECTION ── */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#111a2e] space-y-5 mb-10">
          <div>
            <h2 className="text-lg font-bold">Where you could stand after 12 months</h2>
            <p className="text-[12px] text-slate-400 mt-1">
              Month-by-month cash balance projection based on your inputs
            </p>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={results.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#475569" fontSize={11} tickLine={false}
                  tickFormatter={(v) => `₹${formatINRShort(v)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                  }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}
                  formatter={(value) => [formatINR(value), 'Cash Balance']}
                />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
                {prepMonths > 0 && (
                  <ReferenceLine
                    x={`M${prepMonths}`}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                    label={{ value: 'Job starts', fill: '#f59e0b', fontSize: 10, position: 'top' }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#0c1222', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── MONTHLY BREAKDOWN ── */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#111a2e] space-y-5 mb-10">
          <div>
            <h2 className="text-lg font-bold">Monthly income vs. expenses</h2>
            <p className="text-[12px] text-slate-400 mt-1">
              Green bars show income; gray bars show fixed monthly expenses
            </p>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results.timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${formatINRShort(v)}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '10px',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                  }}
                  formatter={(value, name) => [formatINR(value), name === 'income' ? 'Income' : 'Expenses']}
                />
                <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} name="income" />
                <Bar dataKey="expenses" fill="#334155" radius={[4, 4, 0, 0]} name="expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="text-center text-[11px] text-slate-600 pb-8">
          Decision Lab · All calculations are illustrative and run entirely in your browser. No data is stored.
        </div>

      </div>
    </div>
  );
}
