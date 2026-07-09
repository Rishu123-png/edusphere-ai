import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{theme: Theme; toggle: ()=>void; setTheme: (t:Theme)=>void}>({theme:'light', toggle:()=>{}, setTheme:()=>{}});

export const ThemeProvider = ({children}:{children: React.ReactNode}) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('edusphere-theme') as Theme | null;
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem('edusphere-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  useEffect(() => { setTheme(theme); }, []);

  return <ThemeCtx.Provider value={{theme, setTheme, toggle: ()=>setTheme(theme === 'dark' ? 'light' : 'dark')}}>{children}</ThemeCtx.Provider>
};

export const useTheme = () => useContext(ThemeCtx);
