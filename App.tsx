import React, { useState, useEffect } from 'react';
import { Tab } from './types';
import HealthTab from './components/HealthTab';
import StrengthTab from './components/StrengthTab';
import CyclingTab from './components/CyclingTab';
import StartupTab from './components/StartupTab';
import ProjectsTab from './components/ProjectsTab';
import Login from './components/Login';
import { Activity, Dumbbell, Bike, Rocket, FolderGit2, LogOut } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HEALTH);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    signOut(auth);
  };

  const renderContent = () => {
    switch (activeTab) {
      case Tab.HEALTH: return <HealthTab />;
      case Tab.STRENGTH: return <StrengthTab />;
      case Tab.CYCLING: return <CyclingTab />;
      case Tab.STARTUP: return <StartupTab />;
      case Tab.PROJECTS: return <ProjectsTab />;
      default: return <HealthTab />;
    }
  };

  const navItems = [
    { id: Tab.HEALTH, icon: Activity },
    { id: Tab.STRENGTH, icon: Dumbbell },
    { id: Tab.CYCLING, icon: Bike },
    { id: Tab.STARTUP, icon: Rocket },
    { id: Tab.PROJECTS, icon: FolderGit2 },
  ];

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500">Loading StrategicProgress...</div>;
  if (!user) return <Login />;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-emerald-500/30">
      {/* Sticky Header */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between h-auto md:h-16 py-3 md:py-0 items-center">
            <div className="flex w-full md:w-auto justify-between items-center mb-3 md:mb-0">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="font-bold text-white text-lg">S</span>
                </div>
                <span className="font-bold text-xl tracking-tight text-white">Strategic<span className="text-emerald-400">Progress</span></span>
              </div>
              <button onClick={handleLogout} className="md:hidden text-slate-400 hover:text-white">
                <LogOut size={20} />
              </button>
            </div>
            
            {/* Desktop & Mobile Tab Navigation */}
            <div className="flex items-center space-x-4 w-full md:w-auto">
                <div className="flex space-x-1 md:space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">
                {navItems.map((item) => (
                    <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 whitespace-nowrap ${
                        activeTab === item.id
                        ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                    >
                    <item.icon size={16} className={`mr-2 ${activeTab === item.id ? 'text-emerald-500' : 'text-slate-500'}`} />
                    {item.id}
                    </button>
                ))}
                </div>
                <button onClick={handleLogout} className="hidden md:block text-slate-400 hover:text-white pl-4 border-l border-slate-700">
                    <LogOut size={18} />
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="min-h-[80vh]">
          {renderContent()}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-8 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          <p>&copy; {new Date().getFullYear()} StrategicProgress. Data Driven Growth.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;