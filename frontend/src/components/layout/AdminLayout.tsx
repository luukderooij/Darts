// FILE: frontend/src/components/layout/AdminLayout.tsx
import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth'; // Zorg dat dit pad klopt
import Sidebar from './Sidebar';
import { Menu, Loader2 } from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, isLoading } = useAuth(); // Haal user status op
  const navigate = useNavigate();

  // BEVEILIGING: Stuur terug naar login als er geen user is
  useEffect(() => {
    if (!isLoading && !user) {
        navigate('/login');
    }
  }, [isLoading, user, navigate]);

  // Terwijl we checken, toon een laadschermpje ipv de beschermde inhoud
  if (isLoading) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-100 text-blue-600">
            <Loader2 className="animate-spin w-10 h-10" />
        </div>
      );
  }

  // Als we niet ingelogd zijn (en de redirect loopt nog), toon niks
  if (!user) return null;

  // --- HIERONDER IS JOUW ORIGINELE LAYOUT ---
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar Component */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full w-full relative">
        
        {/* Mobile Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center gap-4 md:hidden shrink-0">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="text-gray-600 hover:text-blue-600 p-1"
          >
            <Menu size={24} />
          </button>
          <span className="font-bold text-gray-800">Dart Manager</span>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;