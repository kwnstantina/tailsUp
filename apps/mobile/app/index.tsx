// Home — the journey the business actually needs: who we are → what we do →
// the thing nobody else does → leave a lead.
//
// The data-driven tracking is ONE section here, not the headline. The homepage
// sells a dog trainer; the platform is the reason to pick this one.

import { View } from 'react-native';
import { colors, radii, space } from '../src/design/tokens';
import { useBreakpoint } from '../src/design/useBreakpoint';
import { crew, practice, sampleCurve, services, trustClaims } from '../src/content/site';
import { Col, Container, Grid, Section, Stack, Wrap } from '../src/components/Layout';
import { Page } from '../src/components/Page';
import { Body, BodyLg, H1, H2, H3, Label, Small } from '../src/components/Type';
import {
  Button,
  Card,
  Eyebrow,
  Highlight,
  IconBubble,
  Sticker,
  TINTS,
} from '../src/components/Ui';
import { CirclePhoto, PhotoPlaceholder, Wave } from '../src/components/Media';
import { ProgressCurve } from '../src/components/ProgressCurve';
import { LeadForm } from '../src/components/LeadForm';
import {
  IconMagnifier,
  IconPair,
  IconTrio,
  Paw,
} from '../src/components/Icons';

const SERVICE_ICONS = [IconMagnifier, IconPair, IconTrio];

export default function HomeScreen() {
  const r = useBreakpoint();

  return (
    <Page>
      {/* ------------------------------------------------------------ Hero */}
      <Section spacing="normal">
        <Grid gap={r.isPhone ? space.lg : space.xl} align="center">
          <Col weight={1}>
            <Stack gap={space.md}>
              <Eyebrow>{`Force-free dog training in ${practice.city}`}</Eyebrow>

              <View style={{ gap: 2 }}>
                <H1>Happy dogs,</H1>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Highlight>
                    <H1>happier</H1>
                  </Highlight>
                  <H1>walks.</H1>
                </View>
              </View>

              <BodyLg style={{ maxWidth: 490 }}>
                Barking, lunging, pulling on the lead, or just a bit much on a Tuesday morning?
                We&rsquo;ll work it out together — at your dog&rsquo;s pace, with far less stress
                than you&rsquo;re expecting.
              </BodyLg>

              <View
                style={{
                  flexDirection: r.isPhone ? 'column' : 'row',
                  gap: space.sm,
                  marginTop: 4,
                }}
              >
                <Button label="Book a first hello" href="/booking" block={r.isPhone} />
                <Button
                  label="See what we do"
                  href="/services"
                  variant="secondary"
                  block={r.isPhone}
                />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radii.pill,
                    backgroundColor: colors.primary,
                  }}
                />
                <Label color={colors.textMuted}>{`We usually reply ${practice.replyTime}.`}</Label>
              </View>
            </Stack>
          </Col>

          <Col weight={1}>
            <View style={{ position: 'relative' }}>
              {/*
                Decorative shapes behind the photo. Hidden with `display` rather
                than a conditional so the tree stays identical between the
                pre-rendered HTML and the hydrated client (see SiteHeader).
              */}
              <View
                style={{
                  display: r.isPhone ? 'none' : 'flex',
                  position: 'absolute',
                  left: -10,
                  top: 40,
                  width: 150,
                  height: 150,
                  borderRadius: radii.pill,
                  backgroundColor: colors.mint,
                }}
              />
              <View
                style={{
                  display: r.isPhone ? 'none' : 'flex',
                  position: 'absolute',
                  right: 24,
                  top: -34,
                  width: 92,
                  height: 92,
                  borderRadius: radii.pill,
                  backgroundColor: colors.coral,
                  opacity: 0.85,
                }}
              />
              <PhotoPlaceholder
                label="[PHOTO — a very pleased dog, mid-walk]"
                height={r.isPhone ? 260 : 440}
                tint="peach"
                style={r.isPhone ? undefined : { width: '92%', alignSelf: 'flex-end' }}
              />
            </View>
          </Col>
        </Grid>
      </Section>

      <Wave color={colors.bgAlt} height={r.isPhone ? 36 : 64} />

      {/* -------------------------------------------------------- Stickers */}
      <View style={{ backgroundColor: colors.bgAlt }}>
        <Container style={{ paddingTop: space.xs, paddingBottom: space.lg }}>
          <Wrap gap={14} justify={r.isPhone ? 'flex-start' : 'center'}>
            {trustClaims.map((claim, i) => (
              <Sticker
                key={claim.label}
                label={claim.label}
                tint={claim.tint}
                tick={claim.tick}
                // Alternating tilt, never past 2° — beyond that it reads broken
                // rather than deliberate.
                rotate={i % 2 === 0 ? -1.5 : 1.3}
              />
            ))}
          </Wrap>
        </Container>
      </View>

      {/* ------------------------------------------------------------ Crew */}
      <Section background={colors.bgAlt} spacing="tight">
        <Stack gap={space.md}>
          <View
            style={{
              flexDirection: r.isPhone ? 'column' : 'row',
              alignItems: r.isPhone ? 'flex-start' : 'flex-end',
              justifyContent: 'space-between',
              gap: space.sm,
            }}
          >
            <Stack gap={10}>
              <Eyebrow>Some of the crew</Eyebrow>
              <H2>Dogs we&rsquo;ve worked with</H2>
            </Stack>
          </View>

          <Grid gap={r.isPhone ? space.md : 20}>
            {crew.map((member, i) => (
              <Col key={`${member.name}-${i}`}>
                <CirclePhoto name={member.name} caption={member.workedOn} tint={member.tint} />
              </Col>
            ))}
          </Grid>
        </Stack>
      </Section>

      {/* -------------------------------------------------------- Services */}
      <Section spacing="normal">
        <Stack gap={space.lg}>
          <Stack gap={10} style={{ alignItems: r.isPhone ? 'flex-start' : 'center' }}>
            <Eyebrow>What we do</Eyebrow>
            <H2 style={{ textAlign: r.isPhone ? 'left' : 'center' }}>Three ways to start</H2>
            <BodyLg
              color={colors.textMuted}
              style={{ maxWidth: 560, textAlign: r.isPhone ? 'left' : 'center' }}
            >
              Not sure which one? Send us a note describing the chaos — we&rsquo;ll tell you
              honestly where to begin.
            </BodyLg>
          </Stack>

          <Grid>
            {services.map((service, i) => {
              const Icon = SERVICE_ICONS[i] ?? IconMagnifier;
              const tint = service.tint;
              return (
                <Col key={service.type}>
                  <Card tint={tint} style={{ flex: 1, gap: space.sm }}>
                    <IconBubble>
                      <Icon size={28} color={TINTS[tint].iconInk} />
                    </IconBubble>
                    <H3>{service.title}</H3>
                    <Body color={TINTS[tint].ink}>{service.summary}</Body>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 'auto',
                        paddingTop: space.md,
                        gap: space.sm,
                      }}
                    >
                      <Label style={{ fontSize: 18 }}>{service.price}</Label>
                      <Button label="Book it" href="/booking" variant="green" size="small" />
                    </View>
                  </Card>
                </Col>
              );
            })}
          </Grid>
        </Stack>
      </Section>

      {/* ------------------------------------------------- The proof band */}
      <Container style={{ paddingBottom: r.isPhone ? space.xl : space.xxl }}>
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
                <Eyebrow color={colors.highlight}>The bit nobody else does</Eyebrow>
                <H2 color={colors.onDark}>You get to watch it work</H2>
                <BodyLg color={colors.onDarkMuted} style={{ maxWidth: 470 }}>
                  Every session we tap out what actually happened — what set your dog off, how
                  close they could get, how quickly they came back down. Four taps. It takes
                  nothing away from the session.
                </BodyLg>
                <BodyLg color={colors.onDarkMuted} style={{ maxWidth: 470 }}>
                  A few weeks in, it turns into this. Handy on the days it feels like nothing is
                  changing.
                </BodyLg>
                <Button
                  label="Show me a real one"
                  href="/results"
                  style={{ marginTop: 6 }}
                  block={r.isPhone}
                />
              </Stack>
            </Col>

            <Col weight={1}>
              <View
                style={{
                  backgroundColor: colors.bg,
                  borderRadius: radii.card - 4,
                  padding: r.isPhone ? 20 : 28,
                  gap: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space.xs,
                  }}
                >
                  <H3 numberOfLines={1} style={{ flex: 1 }}>
                    [DOG NAME]&rsquo;s twelve weeks
                  </H3>
                  <Label color={colors.accentInk}>2 m → 14 m</Label>
                </View>
                <ProgressCurve data={sampleCurve} />
                <Small>
                  How close another dog could get before [DOG NAME] reacted. Sample data.
                </Small>
              </View>
            </Col>
          </Grid>
        </View>
      </Container>

      {/* ------------------------------------------------------ Lead capture */}
      <Section background={colors.bgAlt} spacing="normal">
        <Grid gap={r.isPhone ? space.lg : space.xl} align="center">
          <Col weight={1}>
            <Stack gap={space.md}>
              <H2>So, tell us about your dog.</H2>
              <BodyLg color={colors.textMuted} style={{ maxWidth: 450 }}>
                A few sentences is plenty. Whatever they&rsquo;re doing, we&rsquo;ve almost
                certainly met it before — and nothing you write here is going to shock us.
              </BodyLg>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <Paw size={22} />
                <Label>No newsletter. No drip campaign. Just a reply.</Label>
              </View>
            </Stack>
          </Col>
          <Col weight={1}>
            <Card tint="white">
              <LeadForm variant="compact" />
            </Card>
          </Col>
        </Grid>
      </Section>
    </Page>
  );
}
