import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await import('@/lib/supabase/client').then(m => m.supabase.auth.getSession());
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Interceptor para tratar erros
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Não mostrar toast para erros que já foram tratados ou que têm skipErrorToast
    if (error.config?.skipErrorToast) {
      return Promise.reject(error);
    }
    
    // Erros serão tratados pelos componentes individualmente
    // Não mostrar toast automático aqui para evitar duplicação
    return Promise.reject(error);
  }
);

