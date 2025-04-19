import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';

<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=check_circle"
/>;

export default function ResetPasswordTemplate({ code }: { code: string }) {
  return (
    <Html>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=check_circle,cancel"
      />
      <style>{`
          .material-symbols-outlined {
            font-variation-settings:
            'FILL' 1,
            'wght' 400,
            'GRAD' 0,
            'opsz' 24
          }
        `}</style>
      <Head />
      <Preview>Your code is: {code}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto overflow-hidden rounded-lg bg-white font-sans">
          <Container className="mx-auto overflow-hidden rounded-lg border border-solid border-gray-50 p-5">
            <Section className="mt-8">
              <Img
                src={'https://rmsfitness.com/img/RMS-Logo-250px.png'}
                width="250"
                height="250"
                alt="logo"
                className="mx-auto my-0 h-16 w-16"
              />
            </Section>
            <Heading className="mx-0 mt-8 mb-2 text-center text-xl font-normal text-black">
              Verification Code
            </Heading>
            <Section>
              <Text className="text-center text-sm font-bold text-black">
                Your code
              </Text>
              <Text className="mx-0 mt-1 mb-2 text-center text-xl font-normal text-black">
                {code}
              </Text>
            </Section>
            <Hr className="my-3 w-full border border-solid border-gray-50" />
            <Text className="text-muted-foreground text-sm">
              Not you? If you didn&apos;t request this email, you can safely
              ignore it.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
