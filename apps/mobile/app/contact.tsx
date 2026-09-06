// Contact — the lead form plus where to find us.
// This page is the business's actual job: capturing a lead. Everything else on
// it is there to make sending the form feel safe.

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors, space } from '../src/design/tokens';
import { useBreakpoint } from '../src/design/useBreakpoint';
import { contactDetails, practice } from '../src/content/site';
import { Col, Container, Grid, Section, Stack } from '../src/components/Layout';
import { Page } from '../src/components/Page';
import { Body, BodyLg, H1, H3, Label, Small } from '../src/components/Type';
import { Button, Card, Eyebrow } from '../src/components/Ui';
import { LeadForm } from '../src/components/LeadForm';
import { PhotoPlaceholder } from '../src/components/Media';
import { IconClock, IconInfo, IconMail, IconPin } from '../src/components/Icons';

function DetailRow({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 3 }}>{icon}</View>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

export default function ContactScreen() {
  const r = useBreakpoint();

  return (
    <Page>
      <Section spacing="tight">
        <Stack gap={space.md} style={{ maxWidth: 660 }}>
          <Eyebrow>Get in touch</Eyebrow>
          <H1>Tell us about your dog</H1>
          <BodyLg color={colors.textMuted}>
            You don&rsquo;t need the right words for it. &ldquo;He loses it at other dogs and
            I&rsquo;ve run out of ideas&rdquo; is a perfectly good start.
          </BodyLg>
        </Stack>
      </Section>

      <Container style={{ paddingBottom: r.isPhone ? space.xl : space.xxl }}>
        <Grid gap={space.md} align="flex-start">
          <Col weight={1}>
            <Card tint="white" padding={r.isPhone ? 26 : 40}>
              <LeadForm variant="full" />
            </Card>
          </Col>

          <Col width={400}>
            <Stack gap={space.md}>
              <Card tint="peach" padding={30}>
                <Stack gap={space.md}>
                  <H3>Where to find us</H3>
                  <PhotoPlaceholder
                    label="[MAP]"
                    height={168}
                    tint="mint"
                    kind="map"
                    style={{ borderRadius: 20 }}
                  />
                  <Stack gap={space.sm}>
                    <DetailRow icon={<IconPin size={19} color={colors.accentInk} />}>
                      <Body color={colors.textOnPeach}>{contactDetails.addressLine1}</Body>
                      <Body color={colors.textOnPeach}>{contactDetails.addressLine2}</Body>
                    </DetailRow>
                    <DetailRow icon={<IconClock size={19} color={colors.accentInk} />}>
                      <Body color={colors.textOnPeach}>{contactDetails.hours}</Body>
                      <Small color={colors.accentInk}>{contactDetails.hoursNote}</Small>
                    </DetailRow>
                    <DetailRow icon={<IconMail size={19} color={colors.accentInk} />}>
                      <Body color={colors.textOnPeach}>{contactDetails.email}</Body>
                      <Body color={colors.textOnPeach}>{contactDetails.phone}</Body>
                    </DetailRow>
                  </Stack>
                </Stack>
              </Card>

              <Card tint="white" padding={30}>
                <Stack gap={11}>
                  <H3>Already know what you need?</H3>
                  <Body color={colors.textMuted}>
                    Skip the back-and-forth and ask for a time that suits you. Nothing is charged
                    until we&rsquo;ve confirmed it.
                  </Body>
                  <Button
                    label="Request a booking"
                    href="/booking"
                    variant="secondary"
                    block
                    size="small"
                    style={{ marginTop: 4 }}
                  />
                </Stack>
              </Card>

              {/* Safeguarding note — a bite or a sudden change is a different
                  conversation, and the site should say so before the form. */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  alignItems: 'flex-start',
                  paddingHorizontal: 6,
                }}
              >
                <View style={{ marginTop: 2 }}>
                  <IconInfo size={19} color={colors.accentInk} />
                </View>
                <Small style={{ flex: 1 }}>
                  If your dog has bitten someone, or something has changed suddenly, say so in the
                  message — we&rsquo;ll prioritise it, and we may ask you to see a vet first.
                </Small>
              </View>
            </Stack>
          </Col>
        </Grid>
      </Container>

      <Section background={colors.bgAlt} spacing="tight">
        <Stack gap={10} style={{ alignItems: r.isPhone ? 'flex-start' : 'center' }}>
          <Label color={colors.textMuted} style={{ fontSize: 16.5 }}>
            {`We usually reply ${practice.replyTime}.`}
          </Label>
        </Stack>
      </Section>
    </Page>
  );
}
