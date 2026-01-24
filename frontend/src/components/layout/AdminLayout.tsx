import { ReactNode, useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react'; // Hamburger icoon

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar Component (beheert zelf desktop/mobiel gedrag via CSS classes) */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full w-full relative">
        
        {/* Mobile Header (Alleen zichtbaar op klein scherm) */}
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
        {/* We veranderen p-8 naar p-4 op mobiel (md:p-8) voor meer ruimte */}
        <main className="flex-1 overflow-auto p-4 md:p-8 w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;