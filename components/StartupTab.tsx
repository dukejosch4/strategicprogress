import React, { useState, useEffect } from 'react';
import { Rocket, PlusCircle, Link as LinkIcon, Calendar } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { StartupPost } from '../types';
import Comments from './Comments';

const StartupTab: React.FC = () => {
  const [posts, setPosts] = useState<StartupPost[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '' });

  useEffect(() => {
    // REMOVED orderBy('date', 'desc') to avoid index requirements.
    const q = query(collection(db, 'startup_updates'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StartupPost[];
      
      // Client-side sort: Descending (newest first)
      p.sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
        const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
        return dateB - dateA;
      });

      setPosts(p);
    });
    return () => unsubscribe();
  }, []);

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title || !newPost.content) return;
    
    try {
      await addDoc(collection(db, 'startup_updates'), {
        title: newPost.title,
        content: newPost.content,
        date: serverTimestamp(),
        tags: ['Milestone']
      });
      setNewPost({ title: '', content: '' });
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Failed to post (Check console for permission errors)");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-slate-700 pb-6">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <Rocket className="text-emerald-500" size={32} /> Startup Journey
          </h2>
          <p className="text-slate-400 mt-2">Documenting the 0 to 1.</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="text-emerald-500 hover:text-emerald-400 transition-colors"
        >
          <PlusCircle size={32} />
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddPost} className="bg-slate-800 p-6 rounded-xl border border-slate-700 mb-8">
          <input
            type="text"
            placeholder="Milestone Title"
            className="w-full bg-slate-900 text-white p-3 rounded mb-3 border border-slate-700"
            value={newPost.title}
            onChange={e => setNewPost({...newPost, title: e.target.value})}
          />
          <textarea
            placeholder="What happened today?"
            className="w-full bg-slate-900 text-white p-3 rounded mb-3 border border-slate-700 h-32"
            value={newPost.content}
            onChange={e => setNewPost({...newPost, content: e.target.value})}
          />
          <button className="bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700">
            Publish Update
          </button>
        </form>
      )}

      <div className="relative border-l-2 border-slate-700 ml-4 space-y-12">
        {posts.length === 0 ? (
          <div className="ml-8 text-slate-500 italic">Initializing startup timeline...</div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="relative ml-8">
              <span className="absolute -left-[41px] top-0 bg-slate-900 border-2 border-emerald-500 w-5 h-5 rounded-full"></span>
              
              <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center gap-3 mb-2 text-slate-400 text-xs">
                  <Calendar size={14} />
                  <span>{post.date?.toDate ? post.date.toDate().toLocaleDateString() : 'Just now'}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{post.title}</h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-line">{post.content}</p>
                
                {/* Mock External Link */}
                <div className="mt-4 pt-4 border-t border-slate-700/50 flex gap-2">
                  <button className="text-emerald-400 text-sm flex items-center gap-1 hover:underline">
                    <LinkIcon size={14} /> View Prototype
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <Comments contextId="startup-main" />
    </div>
  );
};

export default StartupTab;