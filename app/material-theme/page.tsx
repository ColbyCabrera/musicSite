'use client';

import React from 'react';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { Input } from '@/app/ui/shadcn/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/ui/shadcn/components/ui/card';
import { ThemeToggle } from '@/app/ui/theme/ThemeToggle';

export default function MaterialThemePage() {
  return (
    <div className="min-h-screen bg-background text-on-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-container to-secondary-container py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-6">
            <h1 className="display-large text-on-primary-container">
              Material 3 Expressive
            </h1>
            <p className="headline-medium text-on-secondary-container max-w-2xl mx-auto">
              Experience the new era of Material Design with dynamic color, expressive typography, and delightful motion.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button variant="default" className="state-layer md-motion-emphasized">
                Get Started
              </Button>
              <Button variant="outline" className="state-layer md-motion-emphasized">
                Learn More
              </Button>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-tertiary opacity-20 corner-full"></div>
        <div className="absolute bottom-10 left-10 w-20 h-20 bg-secondary opacity-30 corner-lg"></div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="display-small text-primary mb-4">
              Expressive Design System
            </h2>
            <p className="headline-small text-on-surface-variant max-w-3xl mx-auto">
              Built with authentic Material 3 components, dynamic theming, and enhanced typography for a truly expressive experience.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Typography Card */}
            <Card className="elevation-2 corner-lg bg-surface-container state-layer md-motion-emphasized hover:elevation-3">
              <CardHeader>
                <div className="w-12 h-12 bg-primary corner-sm flex items-center justify-center mb-4">
                  <span className="text-on-primary title-medium">Aa</span>
                </div>
                <CardTitle className="title-large">Typography</CardTitle>
                <CardDescription className="body-medium">
                  Five distinct font families create visual hierarchy and expressiveness.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="display-small">Display</p>
                  <p className="headline-medium">Headlines</p>
                  <p className="title-large">Titles</p>
                  <p className="body-large">Body Text</p>
                  <p className="label-medium">Labels</p>
                </div>
              </CardContent>
            </Card>

            {/* Color Card */}
            <Card className="elevation-2 corner-lg bg-surface-container state-layer md-motion-emphasized hover:elevation-3">
              <CardHeader>
                <div className="w-12 h-12 bg-secondary corner-sm flex items-center justify-center mb-4">
                  <div className="w-6 h-6 bg-tertiary corner-full"></div>
                </div>
                <CardTitle className="title-large">Dynamic Color</CardTitle>
                <CardDescription className="body-medium">
                  Personalized palettes generated from any seed color with perfect contrast.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  <div className="aspect-square bg-primary corner-sm"></div>
                  <div className="aspect-square bg-secondary corner-sm"></div>
                  <div className="aspect-square bg-tertiary corner-sm"></div>
                  <div className="aspect-square bg-error corner-sm"></div>
                  <div className="aspect-square bg-surface-variant corner-sm"></div>
                </div>
              </CardContent>
            </Card>

            {/* Components Card */}
            <Card className="elevation-2 corner-lg bg-surface-container state-layer md-motion-emphasized hover:elevation-3">
              <CardHeader>
                <div className="w-12 h-12 bg-tertiary corner-sm flex items-center justify-center mb-4">
                  <span className="text-on-tertiary title-medium">⚡</span>
                </div>
                <CardTitle className="title-large">Components</CardTitle>
                <CardDescription className="body-medium">
                  Authentic Material 3 components with built-in accessibility and theming.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button variant="default" className="w-full state-layer">
                    Filled Button
                  </Button>
                  <Button variant="outline" className="w-full state-layer">
                    Outlined Button
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Interactive Demo */}
      <section className="py-20 px-6 bg-surface-container-low">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="display-small text-primary mb-6">
                Try It Yourself
              </h2>
              <p className="headline-small text-on-surface mb-8">
                Customize the theme in real-time and see how Material 3 adapts to your preferences.
              </p>
              
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="title-large">Form Elements</h3>
                  <div className="space-y-4">
                    <Input 
                      label="Your Name" 
                      variant="outlined" 
                      placeholder="Enter your name"
                      supportingText="This field uses Material 3 text fields"
                    />
                    <Input 
                      label="Email Address" 
                      variant="filled" 
                      placeholder="Enter your email"
                      type="email"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="title-large">Actions</h3>
                  <div className="flex gap-3 flex-wrap">
                    <Button variant="default" className="state-layer">Primary</Button>
                    <Button variant="secondary" className="state-layer">Secondary</Button>
                    <Button variant="outline" className="state-layer">Outline</Button>
                    <Button variant="ghost" className="state-layer">Text</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <ThemeToggle />
              
              <Card className="elevation-3 corner-lg bg-surface-container-high">
                <CardHeader>
                  <CardTitle className="title-large">Motion & States</CardTitle>
                  <CardDescription className="body-medium">
                    Enhanced with expressive motion and interactive state layers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="aspect-square bg-primary-container corner-lg state-layer flex items-center justify-center transition-all hover:elevation-2">
                      <span className="title-medium text-on-primary-container">Hover</span>
                    </div>
                    <div className="aspect-square bg-secondary-container corner-lg state-layer flex items-center justify-center transition-all hover:elevation-2">
                      <span className="title-medium text-on-secondary-container">Focus</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 bg-surface-container-highest">
        <div className="container mx-auto max-w-4xl text-center">
          <p className="body-large text-on-surface mb-4">
            Built with Material 3 Expressive Design
          </p>
          <p className="body-medium text-on-surface-variant">
            Featuring dynamic theming, expressive typography, and authentic Material components.
          </p>
        </div>
      </footer>
    </div>
  );
}
