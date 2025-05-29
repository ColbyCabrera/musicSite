// import AuthButtons from './ui/auth/authbuttons';
import { auth } from '@/auth';

export default async function Page() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <main className="fade-in flex min-h-screen flex-col p-4 sm:p-6">
      <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
        <div className="flex flex-col justify-center gap-6 rounded-lg bg-gray-50 px-4 py-6 sm:px-6 sm:py-8 md:py-10 md:w-2/5 md:px-20">
          {/* <AuthButtons isLoggedIn={isLoggedIn}></AuthButtons> */}
        </div>
        <div className="flex items-center justify-center p-4 sm:p-6 md:w-3/5 md:px-28 md:py-12"></div>
      </div>
    </main>
  );
}
