'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  argbFromHex, 
  themeFromSourceColor, 
  applyTheme,
  Theme
} from '@material/material-color-utilities';

interface ThemeContextType {
  theme: 'light' | 'dark' | 'auto';
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  seedColor: string;
  setSeedColor: (color: string) => void;
  expressiveMode: boolean;
  setExpressiveMode: (enabled: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'auto';
  defaultSeedColor?: string;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'auto',
  defaultSeedColor = '#6750A4' // Material baseline purple
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(defaultTheme);
  const [seedColor, setSeedColor] = useState(defaultSeedColor);
  const [expressiveMode, setExpressiveMode] = useState(true);

  useEffect(() => {
    // Generate dynamic theme from seed color
    const sourceColorArgb = argbFromHex(seedColor);
    const materialTheme = themeFromSourceColor(sourceColorArgb);
    
    // Apply theme to document
    const isDark = theme === 'dark' || 
      (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const targetScheme = isDark ? materialTheme.schemes.dark : materialTheme.schemes.light;
    
    // Apply Material theme to CSS custom properties
    applyTheme(materialTheme, { target: document.documentElement, dark: isDark });
    
    // Add expressive enhancements
    if (expressiveMode) {
      document.documentElement.classList.add('expressive-theme');
      
      // Enhanced color mappings for expressive design
      const root = document.documentElement.style;
      
      // Expressive surface variants
      root.setProperty('--md-sys-color-surface-bright', isDark ? '#313033' : '#fffbfe');
      root.setProperty('--md-sys-color-surface-dim', isDark ? '#141317' : '#e7e0ec');
      
      // Enhanced state layers for expressiveness
      root.setProperty('--md-sys-state-hover-opacity', '0.08');
      root.setProperty('--md-sys-state-focus-opacity', '0.12');
      root.setProperty('--md-sys-state-pressed-opacity', '0.16');
      root.setProperty('--md-sys-state-selected-opacity', '0.14');
      
      // Expressive motion tokens
      root.setProperty('--md-sys-motion-easing-emphasized', 'cubic-bezier(0.2, 0, 0, 1)');
      root.setProperty('--md-sys-motion-easing-emphasized-decelerate', 'cubic-bezier(0.05, 0.7, 0.1, 1)');
      root.setProperty('--md-sys-motion-easing-emphasized-accelerate', 'cubic-bezier(0.3, 0, 0.8, 0.15)');
      root.setProperty('--md-sys-motion-duration-short1', '50ms');
      root.setProperty('--md-sys-motion-duration-short2', '100ms');
      root.setProperty('--md-sys-motion-duration-medium1', '250ms');
      root.setProperty('--md-sys-motion-duration-medium2', '300ms');
      root.setProperty('--md-sys-motion-duration-long1', '450ms');
      root.setProperty('--md-sys-motion-duration-long2', '500ms');
    } else {
      document.documentElement.classList.remove('expressive-theme');
    }
    
    // Set theme class for dark mode
    document.documentElement.classList.toggle('dark', isDark);
    
  }, [theme, seedColor, expressiveMode]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        // Trigger re-render by updating a dummy state
        setSeedColor(prev => prev);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme,
    seedColor,
    setSeedColor,
    expressiveMode,
    setExpressiveMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
