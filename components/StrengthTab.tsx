import React, { useState, useEffect } from 'react';
import { Dumbbell, Save, History } from 'lucide-react';
import { WorkoutSession, ExerciseLog } from '../types';
import Comments from './Comments';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';

const PLANS = {
  PPL: ['Bench Press', 'Incline Dumbbell Press', 'Overhead Press', 'Lateral Raises', 'Tricep Pushdown'],
  UpperLower: ['Squat', 'Romanian Deadlift', 'Leg Press', 'Calf Raises', 'Hanging Leg Raises'],
  FullBody: ['Deadlift', 'Pullups', 'Dips', 'Lunges', 'Face Pulls']
};

const StrengthTab: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'PPL' | 'UpperLower' | 'FullBody'>('PPL');
  const [currentWorkout, setCurrentWorkout] = useState<ExerciseLog[]>(
    PLANS['PPL'].map(name => ({ name, sets: 3, reps: 10, weight: 0 }))
  );
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Fetch workout history for charts
    // REMOVED orderBy('date', 'asc') to avoid index requirement on composite query (userId + date)
    const q = query(
      collection(db, 'workouts'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const d = doc.data();
        // Calculate total volume
        const volume = d.exercises.reduce((acc: number, ex: ExerciseLog) => acc + (ex.sets * ex.reps * ex.weight), 0);
        return {
          id: doc.id,
          date: d.date?.toDate ? d.date.toDate().toLocaleDateString('en-US', {month: 'numeric', day: 'numeric'}) : 'N/A',
          rawDate: d.date?.toDate ? d.date.toDate() : new Date(),
          volume
        };
      });

      // Client-side sort (Ascending for chart)
      logs.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

      setHistory(logs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePlanChange = (plan: 'PPL' | 'UpperLower' | 'FullBody') => {
    setSelectedPlan(plan);
    setCurrentWorkout(PLANS[plan].map(name => ({ name, sets: 3, reps: 10, weight: 0 })));
  };

  const updateExercise = (index: number, field: keyof ExerciseLog, value: number) => {
    const updated = [...currentWorkout];
    updated[index] = { ...updated[index], [field]: value };
    setCurrentWorkout(updated);
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'workouts'), {
        userId: auth.currentUser.uid,
        date: serverTimestamp(),
        plan: selectedPlan,
        exercises: currentWorkout
      });
      alert("Workout saved successfully!");
      // Reset logic could go here
    } catch (e) {
      console.error("Error saving workout", e);
      alert("Error saving workout");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Dumbbell className="text-emerald-500" /> Strength & Hypertrophy
        </h2>
        <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
          {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map(plan => (
            <button
              key={plan}
              onClick={() => handlePlanChange(plan)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                selectedPlan === plan 
                  ? 'bg-slate-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tracker Panel */}
        <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 bg-slate-850 flex justify-between items-center">
            <h3 className="font-semibold text-slate-200">Log Workout: {selectedPlan}</h3>
            <span className="text-xs text-emerald-500 font-mono">
               Total Vol: {currentWorkout.reduce((acc, curr) => acc + (curr.sets * curr.reps * curr.weight), 0)} kg
            </span>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-slate-500 uppercase font-bold tracking-wider">
              <div className="col-span-5">Exercise</div>
              <div className="col-span-2 text-center">Sets</div>
              <div className="col-span-2 text-center">Reps</div>
              <div className="col-span-3 text-center">Kg</div>
            </div>
            <div className="space-y-2">
              {currentWorkout.map((ex, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5 text-sm text-slate-200 font-medium">{ex.name}</div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={ex.sets}
                      onChange={(e) => updateExercise(idx, 'sets', parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded text-center text-white py-1 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={ex.reps}
                      onChange={(e) => updateExercise(idx, 'reps', parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded text-center text-white py-1 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div className="col-span-3">
                    <input 
                      type="number" 
                      value={ex.weight}
                      onChange={(e) => updateExercise(idx, 'weight', parseInt(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded text-center text-white py-1 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <button 
              onClick={handleSave}
              className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Save size={18} /> Save Session to DB
            </button>
          </div>
        </div>

        {/* Stats Panel */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex flex-col">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2"><History size={18}/> Volume History</h3>
          <div className="flex-1 min-h-[200px]">
             {loading ? (
                 <div className="h-full flex items-center justify-center text-slate-500">Loading history...</div>
             ) : history.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-slate-500">No logs yet.</div>
             ) : (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip 
                    cursor={{fill: '#334155', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f1f5f9' }}
                    />
                    <Bar dataKey="volume" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
             )}
          </div>
        </div>
      </div>
      <Comments contextId="strength-tab" />
    </div>
  );
};

export default StrengthTab;