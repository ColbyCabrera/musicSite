'use client';

import { Button } from '../shadcn/components/ui/button';

export default function SendButton() {
  const sendEmail = async () => {
    const response = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add any data you want to send here
      body: JSON.stringify({
        firstName: 'John',
      }),
    });

    const data = await response.json();
  };

  return <Button onClick={sendEmail}>Send Email</Button>;
}
