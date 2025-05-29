'use client';

import { createContext, useState, useEffect, useContext, ReactNode, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';

// Kullanıcı tipi
export type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  isAdmin?: boolean; // Admin olup olmadığını belirten özellik
};

// Auth context tipleri
export type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// LocalStorage anahtarı
const USER_STORAGE_KEY = 'cyberly_user';

// Özel olay ekleyelim - oturum değişikliği için
export const AUTH_CHANGE_EVENT = 'auth_state_changed';

// LocalStorage'dan kullanıcı bilgisini al
const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('LocalStorage hatası:', error);
    return null;
  }
};

// LocalStorage'a kullanıcı bilgisini kaydet
const storeUser = (user: User | null): void => {
  if (typeof window === 'undefined') return;
  
  try {
    // Mevcut kullanıcıyı kontrol et
    const existingUserStr = localStorage.getItem(USER_STORAGE_KEY);
    const existingUser = existingUserStr ? JSON.parse(existingUserStr) : null;
    
    // Aynı kullanıcı ise gereksiz yere event tetikleme ve localstorage güncelleme
    if (user && existingUser && user.id === existingUser.id) {
      // Eğer aynı kullanıcıysa, sadece kritik alanlar değişmişse güncelle
      if (JSON.stringify(user) === JSON.stringify(existingUser)) {
        // Tamamen aynıysa hiçbir şey yapma
        return;
      }
    }
    
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      // Özel olay tetikle
      const authEvent = new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user } });
      window.dispatchEvent(authEvent);
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
      // Özel olay tetikle - çıkış durumu
      const authEvent = new CustomEvent(AUTH_CHANGE_EVENT, { detail: { user: null } });
      window.dispatchEvent(authEvent);
    }
  } catch (error) {
    console.error('LocalStorage kayıt hatası:', error);
  }
};

// Cookie alıcı (istemci tarafında çalışır)
const getCookie = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const part = parts.pop();
    if (part) {
      return part.split(';').shift() || null;
    }
  }
  return null;
};

// JWT token çözümleyici
const parseJwt = (token: string) => {
  try {
    return jwtDecode<{
      userId: string;
      email: string;
      role: string;
      exp: number;
    }>(token);
  } catch (e) {
    console.error('Token çözümleme hatası:', e);
    return null;
  }
};

// Token geçerli mi kontrol et
const isTokenValid = (token: string): boolean => {
  const decoded = parseJwt(token);
  if (!decoded) return false;
  
  // Süre kontrolü
  const currentTime = Date.now() / 1000;
  return decoded.exp > currentTime;
};

// AuthProvider bileşeni
export function AuthProvider({ children }: { children: ReactNode }) {
  // Router tanımla
  const router = useRouter();
  
  // LocalStorage'dan başlangıç kullanıcı durumu
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Kullanıcı durumu değiştiğinde LocalStorage'ı güncelle
  // Ancak useEffect her render'da çalışmayı önleyeceğiz
  const userRef = useRef<User | null>(user);
  
  // Sadece kullanıcı değiştiğinde etkileyecek şekilde güncelle
  useEffect(() => {
    // userRef'ten farklıysa güncelle
    if (JSON.stringify(user) !== JSON.stringify(userRef.current)) {
      userRef.current = user;
      storeUser(user);
    }
  }, [user]);

  // Sayfa yüklendiğinde oturum durumunu kontrol et
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        // Eğer kullanıcı zaten varsa tekrar kontrol etmeye gerek yok
        if (user) {
          setLoading(false);
          return;
        }

        // LocalStorage'daki kullanıcı bilgisini kontrol et
        const storedUser = getStoredUser();
        if (storedUser) {
          // Kullanıcı bilgisi localStorage'da varsa doğrudan kullan
          setUser(storedUser);
          setLoading(false);
          return;
        }

        const isAuthenticated = await checkAuth();
        
        // Callback URL'i kontrol et
        const callbackUrl = searchParams?.get('callbackUrl');
        
        // Kullanıcı giriş yapmış ve bir callback URL varsa, pathname'e bakmaksızın yönlendir
        if (isAuthenticated && callbackUrl && callbackUrl !== pathname) {
          router.push(decodeURIComponent(callbackUrl));
        }
      } catch (error) {
        console.error('Oturum kontrolü hatası:', error);
      } finally {
        setLoading(false);
      }
    };

    checkUserSession();
  }, [pathname, router, searchParams, user]);

  // Kullanıcı oturumunu kontrol et
  const checkAuth = async (): Promise<boolean> => {
    try {
      // LocalStorage'da oturum varsa kontrol et
      const storedUser = getStoredUser();
      if (storedUser) {
        // Sadece istemci tarafı doğrulama yaparak işlemi hızlandır
        setUser(storedUser);
        return true;
      }
      
      // İstemci tarafında cookie kontrolü yap
      const token = getCookie('auth_token');
      
      if (!token) {
        setUser(null);
        storeUser(null);
        return false;
      }
      
      // Token geçerliliğini istemci tarafında kontrol et
      if (!isTokenValid(token)) {
        setUser(null);
        storeUser(null);
        return false;
      }
      
      // Token geçerli, sunucu doğrulamasına git
      try {
        const controller = new AbortController();
        // 10 saniye timeout ekle
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/auth/session', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          credentials: 'include',
          cache: 'no-store',
          mode: 'same-origin', // CORS hatalarını önlemek için
          signal: controller.signal // timeout için
        });
        
        // Timeout'u temizle
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          setUser(null);
          storeUser(null);
          return false;
        }
        
        // JSON parse hatalarını yakala
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          setUser(null);
          storeUser(null);
          return false;
        }
        
        if (data.user) {
          // Kullanıcı bilgisini güncelle
          setUser(data.user);
          storeUser(data.user);
          return true;
        }
      } catch (fetchError) {
        console.error('Oturum fetch hatası:', fetchError);
        
        // AbortError özel olarak işle - timeout durumunda
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          console.warn('Oturum doğrulama isteği zaman aşımına uğradı');
        }
        
        // Fetch hatası durumunda - bağlantı veya ağ problemi olabilir
        // Daha önce depolanmış kullanıcı bilgisi varsa, o bilgileri geçici olarak koru
        const existingUser = getStoredUser();
        if (existingUser) {
          setUser(existingUser);
          return true; // Ağ hatası olsa bile kullanıcı bilgisi varsa oturumu açık tut
        }
      }
      
      // Sunucu tarafından doğrulama yapılamadıysa kullanıcı state'ini temizle
      setUser(null);
      storeUser(null);
      return false;
    } catch (error) {
      console.error('checkAuth: Oturum kontrolü hatası:', error);
      setUser(null);
      storeUser(null);
      return false;
    }
  };

  // Giriş fonksiyonu
  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      // Ağ hatalarını yakalamak için try-catch
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({ email, password }),
          credentials: 'include', // Cookie'ler için
          cache: 'no-store',
          mode: 'same-origin' // CORS hatalarını önlemek için
        });

        // Response tipi kontrolü
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Sunucu geçersiz yanıt döndürdü. Lütfen daha sonra tekrar deneyin.');
        }

        // JSON parse hatalarını yakalamak için try-catch
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('Sunucu yanıtı işlenemedi. Lütfen daha sonra tekrar deneyin.');
        }

        if (!response.ok) {
          throw new Error(data.error || 'Giriş yapılırken bir hata oluştu');
        }

        // Kullanıcı bilgilerini doğrudan yanıttan al
        if (data.user) {
          setUser(data.user);
          
          // Token'ı localStorage'a kaydet
          if (data.token) {
            localStorage.setItem('cyberly_token', data.token);
          }
          
          // Kullanıcıyı localStorage'a kaydetme işlemini güçlendirelim
          try {
            // Önce localStorage'ı temizle
            localStorage.removeItem(USER_STORAGE_KEY);
            // Sonra yeni kullanıcı bilgilerini kaydet
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
            
            // Kullanıcı state'ini güncelle
            storeUser(data.user);
          } catch (storageError) {
            console.error('LocalStorage kayıt hatası:', storageError);
          }
          
          // Navbar'ı ve diğer bileşenleri bilgilendir
          if (typeof window !== 'undefined') {
            // Olay yayınla - hızlı güncelleme için
            const authEvent = new CustomEvent(AUTH_CHANGE_EVENT, { 
              detail: { user: data.user, loggedIn: true } 
            });
            window.dispatchEvent(authEvent);
          }
          
          // Callback URL varsa doğrudan yönlendir, yoksa ana sayfaya
          const callbackUrl = searchParams?.get('callbackUrl');
          
          if (callbackUrl) {
            try {
              router.push(decodeURIComponent(callbackUrl));
            } catch (navigateError) {
              // Hata durumunda alternatif olarak window.location kullan
              window.location.href = decodeURIComponent(callbackUrl);
            }
          } else {
            // Ana sayfaya yönlendir
            try {
              router.push('/');
            } catch (navigateError) {
              // Hata durumunda alternatif olarak window.location kullan
              window.location.href = '/';
            }
          }
        } else {
          // Oturum durumunu kontrol et
          await checkAuth();
        }
      } catch (fetchError) {
        // Ağ hatalarını özel olarak işle
        if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
          throw new Error('Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin.');
        }
        
        // Diğer hataları yeniden fırlat
        throw fetchError;
      }
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Çıkış işlemi
  const logout = async (): Promise<void> => {
    setLoading(true);
    
    try {
      // LocalStorage temizliği - bu kısmı async/await dışında tut ki hızlıca çalışsın
      if (typeof window !== 'undefined') {
        // Kullanıcı verilerini temizle
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem('cyberly_token');
        // Diğer muhtemel storage öğelerini temizle
        sessionStorage.removeItem(USER_STORAGE_KEY);
        
        // Cookie'yi doğrudan temizle - ekstra önlem
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Olay yayınla - hızlı güncelleme için
        const authEvent = new CustomEvent(AUTH_CHANGE_EVENT, { 
          detail: { user: null, loggedIn: false } 
        });
        window.dispatchEvent(authEvent);
        
        // Giriş sayfasına yönlendirme
        try {
          router.push('/giris');
        } catch (routerError) {
          window.location.href = '/giris';
        }
      }
      
      // State'i hemen güncelle
      setUser(null);
      
      try {
        // API üzerinden çıkış işlemi - token cookie'sini temizler
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
      } catch (apiError) {
        // API hatası olsa bile kullanıcı çıkış yapmış olacak
      }
    } catch (error) {
      // Hata durumunda da temizlik yapalım
      setUser(null);
      storeUser(null);
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem(USER_STORAGE_KEY);
        localStorage.removeItem('cyberly_token');
        document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        
        // Hata durumunda da giriş sayfasına yönlendir
        window.location.href = '/giris';
      }
    } finally {
      setLoading(false);
    }
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

// Auth context hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth hook must be used within an AuthProvider');
  }
  return context;
}