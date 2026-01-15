import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Trash2, Target } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Dartboard } from '../../types';

const ManageBoards = () => {
  const [boards, setBoards] = useState<Dartboard[]>([]);
  const [formData, setFormData] = useState({ name: '', number: '' });

  useEffect(() => { loadBoards(); }, []);

  const loadBoards = async () => {
    try {
      const response = await api.get('/dartboards/');
      setBoards(response.data);
    } catch (err) { console.error(err); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/dartboards/', {
        name: formData.name,
        number: parseInt(formData.number)
      });
      setFormData({ name: '', number: '' });
      loadBoards();
    } catch (err) { alert("Error adding board"); }
  };

  const handleDelete = async (id: number) => {
    if(!confirm("Delete this board?")) return;
    try { await api.delete(`/dartboards/${id}`); loadBoards(); }
    catch (err) { alert("Error deleting board"); }
  };

  return (
    <AdminLayout>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Manage Dartboards</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm h-fit">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="text-blue-600" /> Add Board
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Board Number</label>
              <input type="number" required className="w-full border rounded p-2"
                value={formData.number}
                onChange={e => setFormData({...formData, number: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Location Name</label>
              <input type="text" required placeholder="e.g. Main Stage" className="w-full border rounded p-2"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700">
              Add Board
            </button>
          </form>
        </div>

        {/* List */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {boards.map(board => (
            <div key={board.id} className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-gray-400 uppercase">Board {board.number}</span>
                <div className="text-lg font-bold text-gray-800">{board.name}</div>
              </div>
              <button onClick={() => handleDelete(board.id)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ManageBoards;