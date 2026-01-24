import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Users, Trophy, LogOut, Activity, Target, FileText, X } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Manage Players', path: '/dashboard/players' },
    { icon: Target, label: 'Manage Boards', path: '/dashboard/boards' },
    { icon: Trophy, label: 'Create Tournament', path: '/dashboard/create-tournament' },
    { icon: Activity, label: 'System Logs', path: '/dashboard/logs' },
    { icon: FileText, label: 'Changelog', path: '/dashboard/changelog' },
  ];

  return (
    <>
      {/* 1. Mobile Overlay (Alleen zichtbaar als menu open is op mobiel) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* 2. De Sidebar zelf */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-30
        w-64 bg-slate-900 text-white flex flex-col min-h-screen shadow-xl
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-blue-400">Dart Manager</h1>
            <p className="text-xs text-slate-400 mt-1">
               Logged in as: {user?.first_name || 'Admin'}
            </p>
          </div>
          {/* Sluit knop (Alleen mobiel) */}
          <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => onClose()} // Sluit menu na klik op mobiel
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 text-red-400 hover:text-red-300 w-full p-3 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;