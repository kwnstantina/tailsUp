// About — who you'll be working with, and how the practice works.
// The journey's second beat: they've seen what we do, now they want to know
// whether they'd want us in their hallway.

import { View } from 'react-native';
import { colors, space } from '../src/design/tokens';
import { useBreakpoint } from '../src/design/useBreakpoint';
import { practice, trainer } from '../src/content/site';
import { Col, Container, Grid, Section, Stack } from '../src/components/Layout';
import { Page } from '../src/components/Page';
import { Body, BodyLg, H1, H2, H3 } from '../src/components/Type';
import { Button, Card, Eyebrow, IconBubble } from '../src/components/Ui';
import { PhotoPlaceholder } from '../src/components/Media';
import { IconCheck } from '../src/components/Icons';

const PRINCIPLES = [
  {
    title: 'Force-free, without exception',
    body: 'No corrections, no startle, nothing that makes a worried dog more worried. If a method relies on your dog being frightened of you, we do not use it.',
  },
  {
    title: 'We start where your dog is',
    body: 'Not where a training plan says they should be. That usually means going slower at the start and much faster later.',
  },
  {
    title: 'You get told the truth',
    body: 'Including when the honest answer is a vet, a behaviourist, or that a group class is not right for your dog yet.',
  },
  {
    title: 'Everything gets written down',
    body: 'Every session is logged as structured data, so progress is something you can look at rather than something you have to feel.',
  },
];

export default function AboutScreen() {
  const r = useBreakpoint();

  return (
    <Page>
      <Section spacing="tight">
        <Stack gap={space.md} style={{ maxWidth: 700 }}>
          <Eyebrow>Who you&rsquo;ll be working with</Eyebrow>
          <H1>{`Hi, I'm ${trainer.name}.`}</H1>
        </Stack>
      </Section>

      <Container style={{ paddingBottom: r.isPhone ? space.lg : space.xl }}>
        <Grid gap={r.isPhone ? space.lg : space.xl} align="center">
          <Col width={400}>
            <PhotoPlaceholder
              label={`[PORTRAIT — ${trainer.name}]`}
              height={r.isPhone ? 300 : 440}
              tint="mint"
              kind="portrait"
            />
          </Col>
          <Col weight={1}>
            <Stack gap={space.md}>
              <BodyLg style={{ maxWidth: 620 }}>{trainer.origin}</BodyLg>
              <BodyLg style={{ maxWidth: 620 }}>
                Most people who call are tired, a bit embarrassed, and convinced their dog is the
                difficult one. They&rsquo;re almost never right about that.
              </BodyLg>
              <BodyLg color={colors.textMuted} style={{ maxWidth: 620 }}>
                We start where your dog actually is and move one manageable step at a time. No
                shouting, no corrections, nothing that makes your dog more worried than they
                already are.
              </BodyLg>

              <View
                style={{
                  flexDirection: r.isPhone ? 'column' : 'row',
                  gap: space.sm,
                  marginTop: space.xs,
                }}
              >
                <Button label="Book a first hello" href="/booking" block={r.isPhone} />
                <Button
                  label="See the services"
                  href="/services"
                  variant="secondary"
                  block={r.isPhone}
                />
              </View>
            </Stack>
          </Col>
        </Grid>
      </Container>

      {/* Credentials — bracketed until they're filled in from site.ts. */}
      <Section background={colors.bgAlt} spacing="tight">
        <Grid gap={space.md}>
          <Col>
            <Card tint="white" padding={26}>
              <Stack gap={6}>
                <H3>{`${practice.yearsInPractice} years`}</H3>
                <Body color={colors.textMuted}>
                  working with reactive and anxious dogs in {practice.city}
                </Body>
              </Stack>
            </Card>
          </Col>
          <Col>
            <Card tint="white" padding={26}>
              <Stack gap={6}>
                <H3>{`${practice.dogsHelped} dogs`}</H3>
                <Body color={colors.textMuted}>
                  and their people, since {practice.since}
                </Body>
              </Stack>
            </Card>
          </Col>
          <Col>
            <Card tint="white" padding={26}>
              <Stack gap={6}>
                <H3>{practice.credential}</H3>
                <Body color={colors.textMuted}>
                  force-free, reward-based methods only
                </Body>
              </Stack>
            </Card>
          </Col>
        </Grid>
      </Section>

      <Section spacing="normal">
        <Stack gap={space.lg}>
          <Stack gap={10} style={{ maxWidth: 640 }}>
            <Eyebrow>How we work</Eyebrow>
            <H2>Four things we will not budge on</H2>
          </Stack>

          <Grid gap={space.md}>
            <Col>
              <Stack gap={space.md}>
                {PRINCIPLES.slice(0, 2).map((principle) => (
                  <Card key={principle.title} tint="mint" padding={30}>
                    <Stack gap={10}>
                      <IconBubble size={44}>
                        <IconCheck size={22} color={colors.primary} />
                      </IconBubble>
                      <H3>{principle.title}</H3>
                      <Body color={colors.textOnMint}>{principle.body}</Body>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Col>
            <Col>
              <Stack gap={space.md}>
                {PRINCIPLES.slice(2).map((principle) => (
                  <Card key={principle.title} tint="peach" padding={30}>
                    <Stack gap={10}>
                      <IconBubble size={44}>
                        <IconCheck size={22} color={colors.accentInk} />
                      </IconBubble>
                      <H3>{principle.title}</H3>
                      <Body color={colors.textOnPeach}>{principle.body}</Body>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Col>
          </Grid>
        </Stack>
      </Section>

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
              Come and meet us first
            </H2>
            <BodyLg color={colors.textMuted} style={{ maxWidth: 520 }}>
              You don&rsquo;t have to commit to anything to ask a question. Tell us what&rsquo;s
              going on and we&rsquo;ll tell you honestly whether we can help.
            </BodyLg>
          </Stack>
          <Button label="Get in touch" href="/contact" block={r.isPhone} />
        </View>
      </Section>
    </Page>
  );
}
