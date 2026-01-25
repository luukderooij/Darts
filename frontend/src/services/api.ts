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

// This listens to every response coming BACK from the backend.
api.interceptors.response.use(
  (response) => {
    // If the response is good (status 200-299), just return it.
    return response;
  },
  (error) => {
    // If the backend returns 401 Unauthorized, the token is invalid/expired.
    if (error.response && error.response.status === 401) {
      // 1. Remove the bad token
      localStorage.removeItem('token');
      
      // 2. Redirect to login page
      // We use window.location because this file is not a React component,
      // so we can't use the useNavigate hook here.
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    
    // Pass the error along so specific components can still handle it if needed
    return Promise.reject(error);
  }
);

export default api;