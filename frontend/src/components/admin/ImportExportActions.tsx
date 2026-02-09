import React, { useRef } from 'react';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import api from '../../services/api';

interface Props {
  targetPath: string;
  onSuccess: () => void;
  onResult?: (data: any) => void; // Optionele callback voor gedetailleerde resultaten
}

const ImportExportActions = ({ targetPath, onSuccess, onResult }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportTemplate = async () => {
    try {
      const response = await api.get(`/${targetPath}/export-template`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${targetPath}_template.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      alert("Kon template niet downloaden.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      // We versturen het bestand naar de backend
      const res = await api.post(`/${targetPath}/import-csv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Als er een onResult callback is, stuur de data (met eventuele errors) terug
      if (onResult) {
        onResult(res.data);
      }

      alert(res.data.message || "Import voltooid");
      
      // Ververs de lijst op de pagina
      onSuccess();
      
      // Reset de file input zodat hetzelfde bestand opnieuw gekozen kan worden indien nodig
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg = err.response?.data?.detail || "Er is een fout opgetreden tijdens de import.";
      alert("Fout: " + errorMsg);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mb-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <div className="w-full mb-2">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Bulk Acties</span>
      </div>
      
      {/* Import Knop */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition shadow-sm"
      >
        <Upload size={16} className="text-blue-600" />
        CSV Importeren
      </button>

      {/* Export Template Knop */}
      <button
        onClick={handleExportTemplate}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition shadow-sm"
      >
        <Download size={16} className="text-green-600" />
        Template Downloaden
      </button>

      {/* Verborgen File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImport}
        accept=".csv"
        className="hidden"
      />
      
      <div className="w-full mt-2">
        <p className="text-[10px] text-gray-500 flex items-center gap-1">
          <FileSpreadsheet size={12} />
          Gebruik de template voor de juiste kolomnamen om fouten te voorkomen.
        </p>
      </div>
    </div>
  );
};

export default ImportExportActions;