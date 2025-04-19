import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Tailwind,
  Section,
  Img,
  Hr,
} from '@react-email/components';
import { get24hrTime, to12hrTimeString } from '@/app/lib/utils';
import FormResponseTemplate from './templates/form-response-template';
import ResetPasswordTemplate from './templates/reset-password-template';

export const emailTemplates = ['jobFormResponse'];

export type EmailTemplate = (typeof emailTemplates)[number];

export default function EmailTemplate(
  subject: string,
  body: string,
  from: string,
  to: string,
  template?: EmailTemplate,
  data?: string,
  createdAt?: string,
) {
  switch (template) {
    case 'jobFormResponse':
      return (
        <Html>
          <Head />
          <Body className="mx-0 my-auto">
            <Container className="m-auto p-0">
              {data && (
                <FormResponseTemplate
                  response={JSON.parse(data)}
                  message={body}
                />
              )}
            </Container>
          </Body>
        </Html>
      );
    case 'resetPassword':
      return (
        <Html>
          <Head />
          <Body className="mx-0 my-auto">
            <Container className="m-auto p-0">
              {data && <ResetPasswordTemplate code={JSON.parse(data).code} />}
            </Container>
          </Body>
        </Html>
      );
    default:
      return (
        <Html>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&icon_names=check_circle,cancel"
          />
          <style>
            {`
              .material-symbols-outlined {
                font-variation-settings:
                'FILL' 1,
                'wght' 400,
                'GRAD' 0,
                'opsz' 24
              }
            `}
          </style>
          <Head />

          <Tailwind>
            <Body className="mx-auto my-auto overflow-hidden rounded-lg bg-white font-sans">
              <Container className="overflow-hidden rounded-lg border border-solid border-gray-50 p-5">
                <Section className="mt-6">
                  <Img
                    src={'https://rmsfitness.com/img/RMS-Logo-250px.png'}
                    width="250"
                    height="250"
                    alt="logo"
                    className="mx-auto my-0 h-16 w-16"
                  />
                </Section>
                <Heading className="mx-0 mt-6 mb-2 text-center text-xl font-normal text-black">
                  {subject}
                </Heading>
                <Section>
                  <Text className="whitespace-pre-wrap">{body}</Text>
                </Section>
                <Hr className="my-3 w-full border border-solid border-gray-50" />
                <Text className="text-muted-foreground text-sm">
                  From {from} at{' '}
                  {to12hrTimeString(get24hrTime(createdAt?.toString()))}
                </Text>
              </Container>
            </Body>
          </Tailwind>
        </Html>
      );
  }
}
