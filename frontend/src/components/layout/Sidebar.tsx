import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
// 1. Added 'Target' icon for the boards
import { LayoutDashboard, Users, Trophy, LogOut, Activity, Target } from 'lucide-react';
import { FileText } from 'lucide-react'; // Import the icon

const Sidebar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 2. Added 'Manage Boards' to the menu list
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Manage Players', path: '/dashboard/players' },
    { icon: Target, label: 'Manage Boards', path: '/dashboard/boards' }, // <--- NEW LINK
    { icon: Trophy, label: 'Create Tournament', path: '/dashboard/create-tournament' },
    { icon: Activity, label: 'System Logs', path: '/dashboard/logs' },
    { icon: FileText, label: 'Changelog', path: '/dashboard/changelog' },
  ];

  return (
    <div className="bg-slate-900 text-white w-64 min-h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-blue-400">Dart Manager</h1>
        {/* 3. Fixed user display (username no longer exists) */}
        <p className="text-xs text-slate-400 mt-1">
           Logged in as: {user?.first_name || 'Admin'}
        </p>
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
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
  );
};

export default Sidebar;