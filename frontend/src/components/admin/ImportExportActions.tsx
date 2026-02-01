import React, { useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import api from '../../services/api';

interface Props {
  onSuccess: () => void;
  targetPath: string; // bijv. 'players'
}

const ImportExportActions = ({ onSuccess, targetPath }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    // We bouwen de URL op basis van de Axios configuratie.
    // Als de baseURL relatief is ('/api'), voegen we de origin toe voor window.location.
    const baseUrl = api.defaults.baseURL === '/api' 
      ? `${window.location.origin}/api` 
      : api.defaults.baseURL;

    window.location.href = `${baseUrl}/${targetPath}/export-template`;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Verstuur het bestand naar de import endpoint[cite: 38].
      const response = await api.post(`/${targetPath}/import-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // De backend stuurt nu een 'count' terug om aan te geven hoeveel records er zijn toegevoegd.
      const count = response.data.count;

      if (count === 0) {
        alert("Import voltooid, maar er zijn 0 records toegevoegd. Controleer of de kolomnamen in je CSV (zoals first_name) overeenkomen met de template.");
      } else {
        alert(`Succesvol ${count} items geïmporteerd!`);
        onSuccess(); // Ververs de lijst in de parent component[cite: 520, 560].
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || "Fout bij importeren. Controleer het CSV formaat.";
      alert(errorMsg);
    } finally {
      // Reset de file input zodat hetzelfde bestand opnieuw gekozen kan worden indien nodig.
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-3 mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
      {/* Knop om de CSV template te downloaden */}
      <button 
        onClick={handleDownloadTemplate}
        className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 transition text-sm font-bold"
      >
        <Download size={16} /> Template Downloaden
      </button>
      
      {/* Knop om de verborgen file input te triggeren */}
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-md hover:bg-green-100 transition text-sm font-bold"
      >
        <Upload size={16} /> Importeer CSV
      </button>

      {/* Verborgen input voor het selecteren van bestanden */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".csv" 
        className="hidden" 
      />
    </div>
  );
};

export default ImportExportActions;