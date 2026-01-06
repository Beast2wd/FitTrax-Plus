import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccentColor, ThemeMode, DarkTheme, LightTheme, AccentColors, getTheme, Theme } from '../constants/Colors';

interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  theme: Theme;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  toggleMode: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      accent: 'blue',
      theme: getTheme('dark', 'blue'),
      
      setMode: (mode: ThemeMode) => {
        const accent = get().accent;
        set({ 
          mode, 
          theme: getTheme(mode, accent) 
        });
      },
      
      setAccent: (accent: AccentColor) => {
        const mode = get().mode;
        set({ 
          accent, 
          theme: getTheme(mode, accent) 
        });
      },
      
      toggleMode: () => {
        const currentMode = get().mode;
        const newMode: ThemeMode = currentMode === 'dark' ? 'light' : 'dark';
        const accent = get().accent;
        set({ 
          mode: newMode, 
          theme: getTheme(newMode, accent) 
        });
      },
    }),
    {
      name: 'fitrax-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        mode: state.mode, 
        accent: state.accent 
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.theme = getTheme(state.mode, state.accent);
        }
      },
    }
  )
);
