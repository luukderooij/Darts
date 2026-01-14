import { createContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

// Define the shape of our User object (matches Python UserRead schema)
interface User {
  id: number;
  username: string;
}

// Define what functions/data we want to expose to the app
interface AuthContextType {
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

// Create the context (starts empty)
export const AuthContext = createContext<AuthContextType | null>(null);

// The Provider Component (wraps the whole app)
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // This runs once when the app starts (like __init__)
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // If we find a token, ask the backend "Who am I?"
          const response = await api.get('/users/me');
          setUser(response.data);
        } catch (error) {
          // If token is invalid/expired, clear it
          console.error("Token invalid", error);
          localStorage.removeItem('token');
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  // Function to run when user logs in
  const login = async (token: string) => {
    localStorage.setItem('token', token); // Save to browser
    try {
      const response = await api.get('/users/me'); // Fetch user details
      setUser(response.data);
    } catch (error) {
      console.error("Login failed fetching user", error);
    }
  };

  // Function to run when user logs out
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};