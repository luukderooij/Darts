import api from './api';

// The data shape expected by FastAPI's OAuth2PasswordRequestForm
// It expects form-data, not JSON!
export const loginUser = async (username: string, password: string) => {
  const formData = new FormData();
  formData.append('username', username);
  formData.append('password', password);

  const response = await api.post('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data; // Returns { access_token: "...", token_type: "bearer" }
};

export const registerUser = async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
};