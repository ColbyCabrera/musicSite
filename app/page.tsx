// import AuthButtons from './ui/auth/authbuttons';
import { auth } from '@/auth';
import Link from 'next/link';
import { Button } from '@/app/ui/shadcn/components/ui/button';
import { ThemeToggle } from '@/app/ui/theme/ThemeToggle';

export default async function Page() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <main className="min-h-screen bg-background text-on-background">
      {/* Header */}
      <header className="bg-surface-container border-b border-outline-variant">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="title-large text-primary">Music Site</h1>
          <div className="flex items-center gap-4">
            <Link href="/material-theme">
              <Button variant="outline" className="state-layer">
                Material 3 Demo
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center min-h-[70vh]">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="display-medium text-primary">
                Welcome to the Future of Music
              </h2>
              <p className="headline-small text-on-surface-variant">
                Experience our platform with Material 3's expressive design language, featuring dynamic theming and beautiful typography.
              </p>
            </div>
            
            <div className="flex gap-4 flex-wrap">
              <Link href="/home">
                <Button variant="default" className="state-layer md-motion-emphasized">
                  Explore Music
                </Button>
              </Link>
              <Link href="/material-theme">
                <Button variant="secondary" className="state-layer md-motion-emphasized">
                  View Material 3 Demo
                </Button>
              </Link>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12">
              <div className="bg-primary-container corner-lg p-6 state-layer">
                <h3 className="title-medium text-on-primary-container mb-2">Dynamic Theming</h3>
                <p className="body-small text-on-primary-container">Personalized colors that adapt to your preferences</p>
              </div>
              <div className="bg-secondary-container corner-lg p-6 state-layer">
                <h3 className="title-medium text-on-secondary-container mb-2">Expressive Typography</h3>
                <p className="body-small text-on-secondary-container">Five font families for enhanced visual hierarchy</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-80 h-80 bg-gradient-to-br from-primary to-tertiary corner-full opacity-20"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-primary corner-full mx-auto flex items-center justify-center">
                    <span className="display-small text-on-primary">🎵</span>
                  </div>
                  <p className="headline-small text-primary">Material 3</p>
                  <p className="body-medium text-on-surface-variant">Expressive Design</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
