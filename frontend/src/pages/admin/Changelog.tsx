import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Tag, Calendar, AlertCircle, Wrench, Sparkles, GitCommit, Loader2 } from 'lucide-react';

type ChangeType = 'feat' | 'fix' | 'chore' | 'refactor' | 'docs' | 'perf' | 'revert' | 'unknown';

interface Change {
  type: ChangeType;
  text: string;
  hash?: string; 
  link?: string; 
}

interface Release {
  version: string;
  date: string;
  description?: string;
  changes: Change[];
}

const ChangeBadge = ({ type }: { type: string }) => {
  switch (type) {
    case 'feat':
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide border border-green-200">Feat</span>;
    case 'fix':
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide border border-red-200">Fix</span>;
    case 'docs':
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 text-yellow-700 uppercase tracking-wide border border-yellow-200">Docs</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wide border border-gray-200">{type}</span>;
  }
};

const Changelog = () => {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/system/changelog')
       .then(res => setReleases(res.data))
       .catch(err => console.error(err))
       .finally(() => setLoading(false));
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        
        <div className="mb-10 border-b pb-6">
          <h1 className="text-3xl font-bold text-gray-900">Project Geschiedenis</h1>
          <p className="text-gray-500 mt-2">Een overzicht van alle updates, verbeteringen en fixes.</p>
        </div>

        {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
        ) : (
            <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
            
            {releases.map((release, index) => (
                <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    
                    {/* ICON BOLLETJE */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-gray-100 group-hover:bg-blue-500 group-hover:text-white text-gray-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 transition-colors">
                        <Tag size={18} />
                    </div>
                    
                    {/* KAARTJE */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all">
                        
                        {/* HEADER VAN DE KAART */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                v{release.version}
                            </h3>
                            <time className="font-mono text-xs text-gray-400 flex items-center gap-1">
                                <Calendar size={12}/> {release.date}
                            </time>
                        </div>

                        {/* LIJST MET CHANGES */}
                        <ul className="space-y-3">
                            {release.changes.map((change, i) => (
                                <li key={i} className="text-sm text-gray-600 flex items-start gap-3">
                                    <div className="shrink-0 mt-0.5">
                                        <ChangeBadge type={change.type} />
                                    </div>
                                    <div className="flex-1 leading-relaxed">
                                        {change.text}
                                    </div>
                                    {change.hash && (
                                        <a href={change.link || "#"} target="_blank" rel="noreferrer" className="shrink-0 text-[10px] font-mono text-gray-400 hover:text-blue-500 flex items-center mt-0.5">
                                            <GitCommit size={10} className="mr-0.5"/> {change.hash.substring(0,6)}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            ))}
            </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default Changelog;