'use client';

import { Button } from '@/app/ui/shadcn/components/ui/button';
import Link from 'next/link';
import { clientSignOut } from '@/app/lib/actions';

export default function AuthButtons({
  isLoggedIn,
}: {
  isLoggedIn: boolean;
}) {
  if (isLoggedIn) {
    return (
      <Button className="w-24" onClick={() => clientSignOut()}>
        Sign Out
      </Button>
    );
  } else {
    return (
      <>
        <Button asChild className="w-24">
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild className="w-24">
          <Link href="/register">Register</Link>
        </Button>
      </>
    );
  }
}
