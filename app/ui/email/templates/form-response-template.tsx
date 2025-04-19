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
import { LabeledResponse } from '@/app/lib/definitions';

<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=check_circle"
/>;

export default function FormResponseTemplate({
  response,
  message,
}: {
  response: LabeledResponse | null;
  message: string;
}) {
  if (!response || !response.responses) {
    return (
      <Html>
        <Head />
        <Preview>No response found</Preview>
        <Tailwind>
          <Body>
            <Container>
              <Text>No response found.</Text>
            </Container>
          </Body>
        </Tailwind>
      </Html>
    );
  }

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
      <Preview>{response.formName}</Preview>
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
              {response.formName}
            </Heading>
            <Section>
              <Text className="whitespace-pre-wrap">{message}</Text>
            </Section>
            <Hr className="mx-0 mt-1 w-full border border-solid border-gray-50" />
            <Section>
              {response.responses.map((response) => {
                const { fieldType, label, value } = response;

                if (fieldType === 'SECTION-HEADER') {
                  return null;
                }

                const renderResponseValue = () => {
                  switch (fieldType) {
                    case 'CHECKBOX':
                      return (
                        <Text className="my-1! mb-2! text-black">
                          {value === 'true' ? 'Yes' : 'No'}
                        </Text>
                      );
                    default:
                      return (
                        <Text className="my-1! mb-2! text-black">
                          {value === '' ? 'No response' : String(value)}
                        </Text>
                      );
                  }
                };

                return (
                  <Section key={response.fieldId} className="my-0.5">
                    <h3 className="my-1">{label}</h3>
                    {renderResponseValue()}
                  </Section>
                );
              })}
            </Section>

            <Hr className="my-3 w-full border border-solid border-gray-50" />
            <Text className="text-muted-foreground text-sm">
              Submitted by {response.userName} at {response.createdAt}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
