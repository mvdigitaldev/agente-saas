import axios from 'axios';

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: apiUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token (com refresh automático)
apiClient.interceptors.request.use(async (config) => {
  const { supabase } = await import('@/lib/supabase/client');
  
  // Obter sessão atual
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    // Verificar se o token está próximo de expirar (menos de 5 minutos)
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
      // Se faltam menos de 5 minutos, fazer refresh
      if (expiresIn < 300) {
        try {
          const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
          if (refreshedSession?.access_token) {
            config.headers.Authorization = `Bearer ${refreshedSession.access_token}`;
            return config;
          }
        } catch (error) {
          console.error('Erro ao renovar token:', error);
          // Continuar com o token atual mesmo se o refresh falhar
        }
      }
    }
    
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  return config;
});

// Interceptor para tratar erros (com retry após refresh de token)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Se erro 401 (não autorizado) e ainda não tentou refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { supabase } = await import('@/lib/supabase/client');
        
        // Tentar fazer refresh do token
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshedSession?.access_token && !refreshError) {
          // Atualizar header com novo token e retry
          originalRequest.headers.Authorization = `Bearer ${refreshedSession.access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshErr) {
        console.error('Erro ao renovar token após 401:', refreshErr);
        // Se refresh falhar, redirecionar para login
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    // Não mostrar toast para erros que já foram tratados ou que têm skipErrorToast
    if (error.config?.skipErrorToast) {
      return Promise.reject(error);
    }
    
    // Erros serão tratados pelos componentes individualmente
    // Não mostrar toast automático aqui para evitar duplicação
    return Promise.reject(error);
  }
);

