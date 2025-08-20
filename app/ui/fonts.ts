import { Inter, Roboto_Flex, Playfair_Display, JetBrains_Mono, Outfit } from 'next/font/google';

// Material 3 Expressive Typography System
// Using multiple font families for enhanced visual hierarchy

// Primary font - Modern sans-serif for body text and UI
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700'],
});

// Display font - Elegant serif for headlines and hero text
export const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '800', '900'],
});

// Flexible font - Modern variable font for emphasis and branding
export const robotoFlex = Roboto_Flex({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-flex',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

// Code font - Monospace for technical content
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['300', '400', '500', '600', '700'],
});

// Brand font - Modern geometric for brand elements
export const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-brand',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
});

// Combine all font variables for easy application
export const fontVariables = [
  inter.variable,
  playfairDisplay.variable,
  robotoFlex.variable,
  jetbrainsMono.variable,
  outfit.variable,
].join(' ');

// Legacy exports for backward compatibility
export const albert_sans = inter;
export const lusitana = playfairDisplay;
