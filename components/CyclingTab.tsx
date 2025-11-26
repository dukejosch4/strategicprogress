import React, { useState, useMemo } from 'react';
import { Bike, Upload, TrendingUp, Timer, Zap, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Line, CartesianGrid } from 'recharts';
import { CyclingDataPoint } from '../types';
import { parseTrainingFile } from '../utils/parsers';
import Comments from './Comments';

const CyclingTab: React.FC = () => {
  const [data, setData] = useState<CyclingDataPoint[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Statistics
  const stats = useMemo(() => {
    if (!data.length) return { dist: 0, avgSpd: 0, gain: 0, tss: 0, maxPwr: 0 };
    
    // Calculate totals
    const totalDist = data[data.length - 1].distance; // accumulated distance
    const totalTimeHours = data[data.length - 1].time / 3600;
    
    const avgSpd = totalTimeHours > 0 ? totalDist / totalTimeHours : 0;
    
    // Gain
    const gain = data.reduce((acc, c, i) => {
      if (i === 0) return 0;
      const diff = c.elevation - data[i-1].elevation;
      return diff > 0 ? acc + diff : acc;
    }, 0);

    // Power stats
    const avgPower = data.reduce((acc, c) => acc + c.power, 0) / data.length;
    const normPower = avgPower * 1.05; // Simplified Normalized Power
    const ftp = 250; // Hardcoded user setting for now
    const intensityFactor = normPower / ftp;
    const tss = Math.round((data[data.length-1].time * normPower * intensityFactor) / (ftp * 3600) * 100);
    const maxPwr = Math.max(...data.map(d => d.power));

    return { 
      dist: totalDist.toFixed(1), 
      avgSpd: avgSpd.toFixed(1), 
      gain: Math.round(gain),
      tss: isNaN(tss) ? 0 : tss,
      maxPwr
    };
  }, [data]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setError("");
    if (file) {
      setLoading(true);
      setFileName(file.name);
      try {
        const parsedData = await parseTrainingFile(file);
        if (parsedData.length === 0) {
            setError("No trackpoints found in file.");
        }
        setData(parsedData);
      } catch (err) {
        console.error(err);
        setError("Failed to parse file. Ensure it is a valid GPX or TCX.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bike className="text-emerald-500" /> Cycling Analysis
        </h2>
        <div className="relative group">
          <input 
            type="file" 
            accept=".gpx,.tcx" 
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
            <Upload size={18} /> {loading ? "Parsing..." : (fileName || "Import GPX/TCX")}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded text-red-300 flex items-center gap-2">
            <AlertTriangle size={18} /> {error}
        </div>
      )}

      {data.length === 0 && !loading && !error && (
        <div className="text-center py-20 border-2 border-dashed border-slate-800 rounded-xl">
            <Bike size={48} className="mx-auto text-slate-700 mb-4" />
            <h3 className="text-slate-500 font-medium">No Ride Data Loaded</h3>
            <p className="text-slate-600 text-sm mt-1">Upload a Garmin/Wahoo GPX or TCX file to visualize performance.</p>
        </div>
      )}

      {data.length > 0 && (
      <>
        {/* Metrics Header */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col">
            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Distance</span>
            <div className="text-2xl font-bold text-white">{stats.dist} <span className="text-sm font-normal text-slate-500">km</span></div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col">
            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Elevation</span>
            <div className="text-2xl font-bold text-white">{stats.gain} <span className="text-sm font-normal text-slate-500">m</span></div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col">
            <div className="flex justify-between">
                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Avg Speed</span>
                <Timer size={16} className="text-emerald-500"/>
            </div>
            <div className="text-2xl font-bold text-white">{stats.avgSpd} <span className="text-sm font-normal text-slate-500">km/h</span></div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col">
            <div className="flex justify-between">
                <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">TSS</span>
                <Zap size={16} className="text-yellow-500"/>
            </div>
            <div className="text-2xl font-bold text-white">{stats.tss}</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col">
            <span className="text-slate-400 text-xs uppercase font-bold tracking-wider mb-1">Max Watts</span>
            <div className="text-2xl font-bold text-white">{stats.maxPwr}</div>
            </div>
        </div>

        {/* TrainingPeaks Style Chart */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-lg font-medium text-slate-200 mb-6 flex items-center gap-2">
            <TrendingUp size={18} /> Ride Analysis
            </h3>
            <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data}>
                <defs>
                    <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis 
                    dataKey="time" 
                    tickFormatter={(val) => `${Math.floor(val/60)}`} 
                    stroke="#94a3b8" 
                    fontSize={12}
                    minTickGap={30}
                />
                <YAxis yAxisId="left" stroke="#94a3b8" fontSize={12} label={{ value: 'Elev (m)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={12} label={{ value: 'Spd (km/h)', angle: 90, position: 'insideRight', fill: '#10b981' }}/>
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
                    labelFormatter={(label) => `${Math.floor(Number(label)/60)} min`}
                />
                <Area yAxisId="left" type="monotone" dataKey="elevation" stroke="#64748b" fillOpacity={1} fill="url(#colorElevation)" />
                <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#10b981" dot={false} strokeWidth={2} />
                </ComposedChart>
            </ResponsiveContainer>
            </div>
        </div>
      </>
      )}
      <Comments contextId="cycling-tab" />
    </div>
  );
};

export default CyclingTab;