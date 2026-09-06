// Services — the detail behind the three home-page cards, plus the tracking
// service that comes with private work.

import { View } from 'react-native';
import { colors, radii, space } from '../src/design/tokens';
import { useBreakpoint } from '../src/design/useBreakpoint';
import { sampleCurve, services } from '../src/content/site';
import { Col, Container, Grid, Section, Stack } from '../src/components/Layout';
import { Page } from '../src/components/Page';
import { Body, BodyLg, H1, H2, Label, Small } from '../src/components/Type';
import { Bullet, Button, Card, Eyebrow, IconBubble, TINTS } from '../src/components/Ui';
import { ProgressCurve } from '../src/components/ProgressCurve';
import { IconMagnifier, IconPair, IconTrio } from '../src/components/Icons';

const SERVICE_ICONS = [IconMagnifier, IconPair, IconTrio];

export default function ServicesScreen() {
  const r = useBreakpoint();

  return (
    <Page>
      <Section spacing="tight">
        <Stack gap={space.md} style={{ maxWidth: 700 }}>
          <Eyebrow>Services</Eyebrow>
          <H1>What working together actually looks like</H1>
          <BodyLg color={colors.textMuted}>
            Every dog starts with a first hello. Where you go after that depends on what we find —
            and on what fits your week, honestly.
          </BodyLg>
        </Stack>
      </Section>

      <Container style={{ paddingBottom: space.lg }}>
        <Stack gap={space.md}>
          {services.map((service, i) => {
            const Icon = SERVICE_ICONS[i] ?? IconMagnifier;
            return (
              <Card key={service.type} tint="white" padding={r.isPhone ? 26 : 40}>
                <Grid gap={r.isPhone ? space.md : space.lg} align="flex-start">
                  <Col width={220}>
                    <Stack gap={space.sm}>
                      <IconBubble size={52}>
                        <Icon size={24} color={TINTS[service.tint].iconInk} />
                      </IconBubble>
                      <H2 style={{ fontSize: r.isPhone ? 27 : 30, lineHeight: r.isPhone ? 32 : 36 }}>
                        {service.title}
                      </H2>
                      <Small>{service.strapline}</Small>
                    </Stack>
                  </Col>

                  <Col weight={1}>
                    <Stack gap={space.md}>
                      <Body>{service.summary}</Body>
                      <Stack gap={10}>
                        <Eyebrow>{service.detailHeading}</Eyebrow>
                        <Stack gap={9}>
                          {service.detail.map((line) => (
                            <Bullet key={line}>{line}</Bullet>
                          ))}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Col>

                  <Col width={220}>
                    <View
                      style={{
                        backgroundColor: colors.bgAlt,
                        borderRadius: 20,
                        padding: 22,
                        gap: 14,
                      }}
                    >
                      {service.meta.map((row) => (
                        <Stack key={row.label} gap={3}>
                          <Small style={{ fontSize: 13 }}>{row.label}</Small>
                          <Label style={{ fontSize: 16.5 }}>{row.value}</Label>
                        </Stack>
                      ))}
                      <Stack gap={3}>
                        <Small style={{ fontSize: 13 }}>Price</Small>
                        <Label style={{ fontSize: 16.5 }}>{service.price}</Label>
                      </Stack>
                      <Button
                        label="Book this"
                        href="/booking"
                        variant="green"
                        size="small"
                        block
                        style={{ marginTop: 4 }}
                      />
                    </View>
                  </Col>
                </Grid>
              </Card>
            );
          })}
        </Stack>
      </Container>

      {/* The premium differentiator — one dark band, once on the page. */}
      <Container style={{ paddingVertical: r.isPhone ? space.lg : space.xl }}>
        <View
          style={{
            backgroundColor: colors.primaryDeep,
            borderRadius: radii.band,
            padding: r.isPhone ? 26 : 56,
          }}
        >
          <Grid gap={r.isPhone ? space.lg : space.xl} align="center">
            <Col weight={1}>
              <Stack gap={space.md}>
                <Eyebrow color={colors.highlight}>Included with private sessions</Eyebrow>
                <H2 color={colors.onDark}>Progress you can actually see</H2>
                <BodyLg color={colors.onDarkMuted} style={{ maxWidth: 480 }}>
                  Every session gets logged as it happens — the trigger, the distance, how intense
                  it got, how your dog recovered. You see it in your own account, week by week,
                  without having to trust anyone&rsquo;s memory of it.
                </BodyLg>
                <Button
                  label="See a real progress report"
                  href="/results"
                  variant="ghostOnDark"
                  block={r.isPhone}
                  style={{ marginTop: 4 }}
                />
              </Stack>
            </Col>
            <Col weight={1}>
              <Stack gap={12}>
                <ProgressCurve data={sampleCurve} variant="dark" />
                <Small color={colors.onDarkFaint}>
                  Threshold distance over twelve weeks. Sample data.
                </Small>
              </Stack>
            </Col>
          </Grid>
        </View>
      </Container>

      <Section background={colors.bgAlt} spacing="tight">
        <View
          style={{
            flexDirection: r.isPhone ? 'column' : 'row',
            alignItems: r.isPhone ? 'flex-start' : 'center',
            gap: space.lg,
          }}
        >
          <Stack gap={10} style={{ flex: r.isPhone ? undefined : 1 }}>
            <H2 style={{ fontSize: r.isPhone ? 27 : 32, lineHeight: r.isPhone ? 32 : 38 }}>
              Still not sure which one?
            </H2>
            <BodyLg color={colors.textMuted} style={{ maxWidth: 520 }}>
              Describe what&rsquo;s happening in a few sentences. We&rsquo;ll tell you where to
              start — even if the answer is a vet, not a trainer.
            </BodyLg>
          </Stack>
          <Button label="Send us a note" href="/contact" block={r.isPhone} />
        </View>
      </Section>
    </Page>
  );
}
