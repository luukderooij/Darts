import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import AdminLayout from '../../components/layout/AdminLayout';
// Import the changelog file from the root folder
// The ?raw tells Vite to import it as text, not code
import changelogPath from '../../../../CHANGELOG.md?raw'; 

const Changelog = () => {
  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow min-h-[500px]">
        <h1 className="text-3xl font-bold mb-6 border-b pb-4 text-gray-800">System Updates</h1>
        <div className="prose prose-blue max-w-none text-gray-700">
           {/* This renders the markdown text as HTML */}
          <ReactMarkdown>{changelogPath}</ReactMarkdown>
        </div>
      </div>
    </AdminLayout>
  );
};

export default Changelog;