import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Activity, Moon, Zap, Cpu, RefreshCw, AlertTriangle } from 'lucide-react';
import { HealthMetric } from '../types';
import { getStrategicInsight } from '../services/geminiService';
import Comments from './Comments';
import { db } from '../firebase';
import { collection, query, onSnapshot, limit } from 'firebase/firestore';

const HealthTab: React.FC = () => {
  const [data, setData] = useState<HealthMetric[]>([]);
  const [insight, setInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Real Data Fetching from Firestore
    // REMOVED orderBy('date', 'asc') to prevent "index required" errors.
    // Fetching raw collection and sorting in memory.
    const q = query(
      collection(db, 'health_metrics'),
      limit(100) // Safety limit
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedData = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          // Convert Firestore Timestamp to readable date if necessary, or assume string stored
          date: d.date?.toDate ? d.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : d.date,
          // Helper for sorting
          rawDate: d.date?.toDate ? d.date.toDate() : new Date(d.date)
        };
      }) as (HealthMetric & { rawDate: Date })[];
      
      // Client-side sorting
      fetchedData.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

      // Take only the last 30 days after sorting
      setData(fetchedData.slice(-30));
      setLoadingData(false);
      setError(null);
    }, (err) => {
        console.error("Firestore Error:", err);
        setError("Could not load data. Check permissions or console.");
        setLoadingData(false);
    });

    return () => unsubscribe();
  }, []);

  const handleGenerateInsight = async () => {
    if (data.length === 0) return;
    setLoadingInsight(true);
    const result = await getStrategicInsight('Whoop Health Data (Male, 21, Athlete)', data.slice(-7));
    setInsight(result);
    setLoadingInsight(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
        // Trigger the Cloud Function
        await fetch('https://us-central1-strategic-progress2.cloudfunctions.net/triggerWhoopSync', { method: 'POST' });
        // The onSnapshot listener above will automatically pick up the new data once it's written to DB
    } catch (e) {
        console.error("Manual Sync Error:", e);
        alert("Manual sync failed. See console for details.");
    } finally {
        // Keep spinning briefly to show action happened
        setTimeout(() => setSyncing(false), 2000);
    }
  };

  const avgRecovery = data.length ? Math.round(data.reduce((acc, curr) => acc + curr.recovery, 0) / data.length) : 0;
  const avgHRV = data.length ? Math.round(data.reduce((acc, curr) => acc + curr.hrv, 0) / data.length) : 0;
  const latestSleep = data.length > 0 ? data[data.length - 1].sleepPerformance : 0;

  if (loadingData) {
    return <div className="text-center text-slate-500 py-20">Syncing Health Data...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Activity className="text-emerald-500" /> Physiological Status
        </h2>
        <div className="flex gap-2">
           {/* Connect Button */}
          <a 
            href="https://us-central1-strategic-progress2.cloudfunctions.net/whoopAuth"
            target="_blank"
            rel="noopener noreferrer"
            className={`bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-full border border-slate-600 transition-all flex items-center gap-1 ${data.length > 0 ? 'hidden' : ''}`}
          >
            <RefreshCw size={14} /> Connect Whoop
          </a>
          
          {/* Sync Button */}
           <button 
            onClick={handleSync}
            disabled={syncing}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-full border border-slate-600 transition-all flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Sync Data"}
          </button>

          <button 
            onClick={handleGenerateInsight}
            disabled={loadingInsight || data.length === 0}
            className="bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs px-3 py-1.5 rounded-full border border-emerald-500/30 transition-all flex items-center gap-1 disabled:opacity-50"
          >
            <Cpu size={14} /> {loadingInsight ? 'Analyzing...' : 'AI Coach Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 p-4 rounded-lg text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
        </div>
      )}

      {data.length === 0 && !error && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 p-4 rounded-lg text-yellow-200 text-sm">
          No health data found. Please connect your Whoop account and click "Sync Data".
        </div>
      )}

      {insight && (
        <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-lg">
          <h4 className="text-emerald-400 text-sm font-semibold mb-1">Strategic Insight</h4>
          <p className="text-slate-300 text-sm whitespace-pre-line leading-relaxed">{insight}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm">30-Day Avg Recovery</span>
            <Zap size={18} className={avgRecovery > 66 ? "text-green-400" : "text-yellow-400"} />
          </div>
          <div className="text-3xl font-bold text-white">{avgRecovery}%</div>
        </div>
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm">Avg HRV (ms)</span>
            <Activity size={18} className="text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-white">{avgHRV}</div>
          <div className="text-xs text-slate-500 mt-1">Ref: Male 21 Avg: ~70ms</div>
        </div>
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-400 text-sm">Sleep Performance</span>
            <Moon size={18} className="text-purple-400" />
          </div>
          <div className="text-3xl font-bold text-white">
            {latestSleep}%
          </div>
        </div>
      </div>

      {/* HRV Trend Graph */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
        <h3 className="text-lg font-medium text-slate-200 mb-6">Heart Rate Variability vs Population (Male, 21)</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickMargin={10} />
              <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <ReferenceLine y={75} label="Pop. Avg" stroke="red" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="hrv" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recovery vs Strain */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
          <h3 className="text-lg font-medium text-slate-200 mb-6">Recovery vs Strain Balance</h3>
          <div className="h-48 w-full">
             <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" hide />
                <YAxis yAxisId="left" stroke="#10b981" fontSize={12} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12} domain={[0, 21]} />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b' }} />
                <Line yAxisId="left" type="monotone" dataKey="recovery" stroke="#10b981" strokeWidth={2} dot={false} name="Rec %" />
                <Line yAxisId="right" type="monotone" dataKey="strain" stroke="#3b82f6" strokeWidth={2} dot={false} name="Strain" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <Comments contextId="health-tab" />
    </div>
  );
};

export default HealthTab;
