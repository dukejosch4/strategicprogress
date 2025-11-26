import React, { useState, useEffect } from 'react';
import { FolderGit2, Gamepad2, Plus, Code } from 'lucide-react';
import { ChessStats, ProjectItem } from '../types';
import Comments from './Comments';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query } from 'firebase/firestore';

const ProjectsTab: React.FC = () => {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [chessStats, setChessStats] = useState<ChessStats | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newProject, setNewProject] = useState<Partial<ProjectItem>>({ title: '', description: '', type: 'other' });

  useEffect(() => {
    // Load projects from DB
    const q = query(collection(db, 'projects'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectItem));
        setProjects(p);
        
        // Check for chess config in projects
        const chessProj = p.find(x => x.type === 'chess');
        if (chessProj?.config?.chessUsername) {
            fetchChess(chessProj.config.chessUsername);
        }
    });
    return () => unsubscribe();
  }, []);

  const fetchChess = async (username: string) => {
    try {
      const response = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
      if (response.ok) {
        const data = await response.json();
        setChessStats({
          rating: data.chess_rapid?.last?.rating || 0,
          wins: data.chess_rapid?.record?.win || 0,
          losses: data.chess_rapid?.record?.loss || 0,
          draws: data.chess_rapid?.record?.draw || 0
        });
      }
    } catch (e) {
      console.error("Chess API Error", e);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!newProject.title) return;
    
    try {
        await addDoc(collection(db, 'projects'), {
            title: newProject.title,
            description: newProject.description,
            type: newProject.type,
            config: newProject.config || {}
        });
        setShowAdd(false);
        setNewProject({ title: '', description: '', type: 'other' });
    } catch(err) {
        console.error(err);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <FolderGit2 className="text-emerald-500" /> Personal Projects
        </h2>
        <button onClick={() => setShowAdd(!showAdd)} className="text-emerald-500 hover:text-white">
            <Plus />
        </button>
      </div>

      {showAdd && (
          <form onSubmit={handleAddProject} className="bg-slate-800 p-4 rounded border border-slate-700 space-y-3">
              <input 
                placeholder="Project Title" 
                className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})}
              />
               <textarea 
                placeholder="Description" 
                className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})}
              />
              <select 
                className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                value={newProject.type} onChange={e => setNewProject({...newProject, type: e.target.value as any})}
              >
                  <option value="other">General</option>
                  <option value="chess">Chess</option>
                  <option value="coding">Coding</option>
              </select>
              {newProject.type === 'chess' && (
                  <input 
                    placeholder="Chess.com Username"
                    className="w-full bg-slate-900 border border-slate-700 p-2 rounded text-white"
                    onChange={e => setNewProject({...newProject, config: { chessUsername: e.target.value }})}
                  />
              )}
              <button className="bg-emerald-600 px-4 py-2 rounded text-white">Add Project</button>
          </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projects.map(project => (
            <div key={project.id} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col">
                 <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-4 border-b border-slate-700">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {project.type === 'chess' ? <Gamepad2 /> : project.type === 'coding' ? <Code /> : <FolderGit2 />} 
                    {project.title}
                    </h3>
                </div>
                <div className="p-6 flex-1">
                    <p className="text-slate-300 text-sm mb-4">{project.description}</p>
                    
                    {project.type === 'chess' && chessStats && (
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <div className="bg-slate-900 p-3 rounded border border-slate-700 text-center">
                            <div className="text-2xl font-bold text-white">{chessStats.rating}</div>
                            <div className="text-xs text-slate-500">Rating</div>
                            </div>
                            <div className="bg-slate-900 p-3 rounded border border-slate-700 text-center">
                            <div className="text-2xl font-bold text-emerald-400">{chessStats.wins}</div>
                            <div className="text-xs text-slate-500">Wins</div>
                            </div>
                        </div>
                    )}
                </div>
                 <div className="p-4 border-t border-slate-700 bg-slate-850">
                    <Comments contextId={`project-${project.id}`} />
                </div>
            </div>
        ))}

        {projects.length === 0 && !showAdd && (
            <div className="col-span-2 text-center text-slate-500 py-10">
                No active projects. Add one to start tracking.
            </div>
        )}
      </div>
    </div>
  );
};

export default ProjectsTab;