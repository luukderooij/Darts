import { Link } from 'react-router-dom';
import { Trophy, Target, Users, BarChart3, ArrowRight, Play } from 'lucide-react';

const Home = () => {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* --- NAVIGATION --- */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Trophy className="text-blue-600 h-8 w-8" />
            <span className="font-bold text-xl text-gray-900 tracking-tight">Dart Manager</span>
          </div>
            <div className="flex items-center gap-2 md:gap-4">
            <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium transition text-sm md:text-base">
                Sign In
            </Link>
            <Link 
                to="/register" 
                className="bg-blue-600 text-white px-3 py-2 md:px-5 md:py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm text-sm md:text-base"
            >
                Get Started
            </Link>
            </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <div className="bg-gradient-to-b from-blue-50 to-white pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Manage your Dart Tournaments <br />
            <span className="text-blue-600">Like a Pro.</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create tournaments, manage players, and track live scores with ease. 
            The all-in-one solution for your local dart club.
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              to="/register" 
              className="flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Start for Free <ArrowRight size={20} />
            </Link>
            <Link 
              to="/login" 
              className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-50 transition shadow-sm"
            >
              <Play size={20} className="text-gray-400" /> Demo View
            </Link>
          </div>
        </div>
      </div>

      {/* --- FEATURES GRID --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 mb-24">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-200 transition">
            <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <Target className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Live Scoring</h3>
            <p className="text-gray-500 leading-relaxed">
              Use our tablet-friendly scorer interface to track matches in real-time. Scores update instantly across all devices.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-200 transition">
            <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <BarChart3 className="text-green-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Automated Brackets</h3>
            <p className="text-gray-500 leading-relaxed">
              Run Poules, Knockouts, or Hybrid formats. We automatically calculate standings and generate the bracket.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-200 transition">
            <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <Users className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Player Management</h3>
            <p className="text-gray-500 leading-relaxed">
              Keep a database of all your players, track their stats, and easily add them to new tournaments.
            </p>
          </div>
        </div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-gray-600 mb-4" />
          <p>&copy; {new Date().getFullYear()} Dart Tournament Manager. Built for the love of the game.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;