import { useEffect, useState, useRef } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Terminal, Wifi, WifiOff } from 'lucide-react';

const SystemLogs = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Open the Connection
    const ws = new WebSocket('ws://localhost:8000/api/ws/logs');

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Connected to Log Stream');
    };

    ws.onmessage = (event) => {
      // 2. Receive Data (it comes as a JSON array of strings)
      const data = JSON.parse(event.data);
      setLogs(data);
    };

    ws.onclose = () => setIsConnected(false);

    // Cleanup when leaving the page
    return () => {
      ws.close();
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto h-[calc(100vh-100px)] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <Terminal className="text-gray-600" />
            System Live Logs
          </h2>
          
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isConnected ? 'Live Stream Active' : 'Disconnected'}
          </div>
        </div>

        <div className="flex-1 bg-black rounded-lg shadow-2xl p-4 overflow-hidden border border-gray-700 flex flex-col font-mono text-sm">
          {/* Terminal Header */}
          <div className="flex gap-2 mb-4 border-b border-gray-800 pb-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>

          {/* Logs Output */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <span className="text-gray-500 italic">Waiting for logs...</span>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="text-green-400 break-words hover:bg-gray-900 transition-colors p-0.5 rounded">
                  <span className="text-gray-600 mr-2">$</span>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SystemLogs;