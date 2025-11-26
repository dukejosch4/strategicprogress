import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Comment } from '../types';
import { MessageSquare, Send } from 'lucide-react';

interface Props {
  contextId: string;
}

const Comments: React.FC<Props> = ({ contextId }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    // Removed orderBy('date', 'desc') to avoid Firestore composite index requirement.
    const q = query(
      collection(db, 'comments'),
      where('contextId', '==', contextId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      
      // Client-side sorting (Descending by date)
      // Handles Firestore Timestamp objects (which have .seconds)
      msgs.sort((a, b) => {
        const timeA = a.date?.seconds || 0;
        const timeB = b.date?.seconds || 0;
        return timeB - timeA;
      });
      
      setComments(msgs);
    });

    return () => unsubscribe();
  }, [contextId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await addDoc(collection(db, 'comments'), {
        contextId,
        text: newComment,
        author: 'Visitor', // In a real app, use auth.currentUser
        date: serverTimestamp()
      });
      setNewComment('');
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-slate-700">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-4 text-slate-200">
        <MessageSquare size={18} /> Discussion
      </h3>
      
      <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-slate-500 italic text-sm">No comments yet. Be the first to advise.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="bg-slate-800 p-3 rounded-md border border-slate-700">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-medium text-emerald-400 text-sm">{c.author}</span>
                <span className="text-xs text-slate-500">
                  {c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString() : 'Just now'}
                </span>
              </div>
              <p className="text-slate-300 text-sm">{c.text}</p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Leave a strategic comment..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
        />
        <button 
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default Comments;