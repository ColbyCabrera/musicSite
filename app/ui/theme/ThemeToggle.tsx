'use client';

import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, seedColor, setSeedColor, expressiveMode, setExpressiveMode } = useTheme();

  const handleSeedColorChange = (color: string) => {
    setSeedColor(color);
  };

  const presetColors = [
    { name: 'Material Purple', value: '#6750A4' },
    { name: 'Ocean Blue', value: '#006A6B' },
    { name: 'Forest Green', value: '#386A20' },
    { name: 'Sunset Orange', value: '#A03B00' },
    { name: 'Cherry Red', value: '#BA1A1A' },
    { name: 'Lavender', value: '#7B61C4' },
    { name: 'Coral', value: '#FF6B6B' },
    { name: 'Mint', value: '#20C997' },
  ];

  return (
    <div className={`space-y-6 p-6 bg-surface-container corner-lg elevation-2 ${className}`}>
      <div className="space-y-4">
        <h3 className="title-medium text-on-surface">Theme Settings</h3>
        
        {/* Theme Mode */}
        <div className="space-y-2">
          <label className="label-medium text-on-surface">Appearance</label>
          <div className="flex gap-2">
            {(['light', 'dark', 'auto'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={`px-4 py-2 corner-sm label-medium transition-all state-layer ${
                  theme === mode
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-variant text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Expressive Mode */}
        <div className="flex items-center justify-between">
          <label className="label-medium text-on-surface">Expressive Design</label>
          <button
            onClick={() => setExpressiveMode(!expressiveMode)}
            className={`relative w-12 h-6 corner-full transition-colors ${
              expressiveMode ? 'bg-primary' : 'bg-outline'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 bg-white corner-full transition-transform ${
                expressiveMode ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Color Seed */}
        <div className="space-y-3">
          <label className="label-medium text-on-surface">Seed Color</label>
          <div className="grid grid-cols-4 gap-2">
            {presetColors.map((color) => (
              <button
                key={color.name}
                onClick={() => handleSeedColorChange(color.value)}
                className={`aspect-square corner-sm border-2 transition-all state-layer ${
                  seedColor.toLowerCase() === color.value.toLowerCase()
                    ? 'border-primary border-4'
                    : 'border-outline hover:border-outline-variant'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
          
          {/* Custom Color Input */}
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={seedColor}
              onChange={(e) => handleSeedColorChange(e.target.value)}
              className="w-12 h-8 corner-sm border border-outline cursor-pointer"
            />
            <input
              type="text"
              value={seedColor}
              onChange={(e) => handleSeedColorChange(e.target.value)}
              placeholder="#6750A4"
              className="flex-1 px-3 py-2 bg-surface-container corner-sm border border-outline body-medium text-on-surface focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
