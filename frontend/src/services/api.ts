import axios from 'axios';

// 1. Create the instance (like requests.Session())
// const api = axios.create({
//   baseURL: 'http://localhost:8000/api', // Point to your FastAPI backend
//   headers: {
//     'Content-Type': 'application/json',
//   },
// });


const api = axios.create({
  // Verwijder de hardcoded localhost URL. 
  // Omdat Nginx op hetzelfde domein draait, gebruiken we een relatieve URL.
  // Als je app draait op http://mijn-server-ip/, wordt dit automatisch http://mijn-server-ip/api
  baseURL: '/api', 
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Add an "Interceptor" (Middleware)
// Before every request is sent, check if we have a token in LocalStorage (browser memory)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // If token exists, attach it: Authorization: Bearer <token>
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;