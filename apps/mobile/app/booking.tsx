// Booking — the request form plus the "what happens next" reassurance.
//
// Accepts an optional `?type=` param so the Book buttons on the Services page
// can land the visitor on the right session type already selected.

import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { BOOKING_TYPES, type BookingType } from '@tailsup/shared';
import { colors, radii, space } from '../src/design/tokens';
import { useBreakpoint } from '../src/design/useBreakpoint';
import { practice } from '../src/content/site';
import { Col, Container, Grid, Section, Stack } from '../src/components/Layout';
import { Page } from '../src/components/Page';
import { Body, BodyLg, H1, H3, Label } from '../src/components/Type';
import { Card, Eyebrow } from '../src/components/Ui';
import { BookingForm } from '../src/components/BookingForm';

const STEPS = [
  {
    title: 'You send the request',
    body: 'Takes a minute. No account needed, and nothing is charged.',
  },
  {
    title: `We confirm within ${practice.confirmTime}`,
    body: "If that slot has gone, we'll offer you the nearest one rather than leave you waiting.",
  },
  {
    title: 'We meet your dog',
    body: 'Bring whatever they normally wear. No need to practise anything beforehand.',
  },
];

/** Only accept a `type` param that is genuinely one of the booking enums. */
function parseType(raw: string | string[] | undefined): BookingType | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return BOOKING_TYPES.find((t) => t === value);
}

export default function BookingScreen() {
  const r = useBreakpoint();
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = parseType(params.type);

  return (
    <Page>
      <Section spacing="tight">
        <Stack gap={space.md} style={{ maxWidth: 660 }}>
          <Eyebrow>Booking</Eyebrow>
          <H1>Pick a time that suits you</H1>
          <BodyLg color={colors.textMuted}>
            Send a request — we&rsquo;ll confirm it, or suggest something close. Nothing is charged
            until it&rsquo;s confirmed.
          </BodyLg>
        </Stack>
      </Section>

      <Container style={{ paddingBottom: r.isPhone ? space.xl : space.xxl }}>
        <Grid gap={space.md} align="flex-start">
          <Col weight={1}>
            <Card tint="white" padding={r.isPhone ? 26 : 40}>
              <BookingForm initialType={initialType} />
            </Card>
          </Col>

          <Col width={360}>
            <Stack gap={space.md}>
              <Card tint="peach" padding={30}>
                <Stack gap={space.md}>
                  <H3>What happens next</H3>
                  <Stack gap={space.md}>
                    {STEPS.map((step, i) => (
                      <View
                        key={step.title}
                        style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}
                      >
                        <View
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: radii.pill,
                            backgroundColor: colors.surface,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Label color={colors.primary} style={{ fontSize: 14 }}>
                            {String(i + 1)}
                          </Label>
                        </View>
                        <Stack gap={3} style={{ flex: 1 }}>
                          <Label style={{ fontSize: 16 }}>{step.title}</Label>
                          <Body color={colors.textOnPeach}>{step.body}</Body>
                        </Stack>
                      </View>
                    ))}
                  </Stack>
                </Stack>
              </Card>

              <Card tint="white" padding={30}>
                <Stack gap={11}>
                  <H3>Need to change it later?</H3>
                  <Body color={colors.textMuted}>
                    Just reply to the confirmation. Life with a dog is unpredictable — we&rsquo;d
                    rather move a session than have you cancel it.
                  </Body>
                </Stack>
              </Card>
            </Stack>
          </Col>
        </Grid>
      </Container>
    </Page>
  );
}
