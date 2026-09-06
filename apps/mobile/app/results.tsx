// Results — the proof page. This is where the structured-data differentiator
// earns its keep, so it explains the actual measurements rather than making
// claims about them.
//
// The labels below are rendered FROM the shared enums, so the page can never
// describe a trigger or outcome the database doesn't record.

import { View } from 'react-native';
import { OUTCOMES, TRIGGER_TYPES } from '@tailsup/shared';
import type { Outcome, TriggerType } from '@tailsup/shared';
import { colors, radii, space } from '../src/design/tokens';
import { useBreakpoint } from '../src/design/useBreakpoint';
import { practice, sampleCurve } from '../src/content/site';
import { Col, Container, Grid, Section, Stack } from '../src/components/Layout';
import { Page } from '../src/components/Page';
import { Body, BodyLg, H1, H2, H3, Label } from '../src/components/Type';
import { Button, Card, Eyebrow, IconBubble } from '../src/components/Ui';
import { ProgressCurve } from '../src/components/ProgressCurve';
import { IconInfo, Paw } from '../src/components/Icons';

// Human wording for the enum values. Keyed by the enum so a new value shows up
// as a missing label in review rather than silently vanishing from the page.
const TRIGGER_LABELS: Record<TriggerType, string> = {
  dog: 'Another dog',
  human: 'A person',
  noise: 'A noise',
  vehicle: 'A vehicle',
  other: 'Something else',
};

const OUTCOME_LABELS: Record<Outcome, { title: string; body: string }> = {
  disengaged: {
    title: 'Disengaged',
    body: 'Your dog noticed, thought about it, and chose to look away. This is the one we are growing.',
  },
  recovered_slowly: {
    title: 'Recovered slowly',
    body: 'They reacted, then came back down on their own. Still progress — the recovery is the skill.',
  },
  over_threshold: {
    title: 'Over threshold',
    body: 'Too close, too much, too fast. Nobody learns anything here, so we log it and back off next time.',
  },
};

const MEASURES = [
  {
    title: 'What set them off',
    body: 'One of five triggers, tapped in the moment rather than remembered afterwards.',
  },
  {
    title: 'How close they could get',
    body: 'The threshold distance in metres — the single number that tells you whether things are moving.',
  },
  {
    title: 'How intense it got',
    body: 'One to ten. Two sessions at the same distance can be completely different days.',
  },
  {
    title: 'How they came back',
    body: 'The outcome, which is what turns a list of incidents into a picture of recovery.',
  },
];

export default function ResultsScreen() {
  const r = useBreakpoint();

  return (
    <Page>
      <Section spacing="tight">
        <Stack gap={space.md} style={{ maxWidth: 720 }}>
          <Eyebrow>Results</Eyebrow>
          <H1>What twelve weeks actually looks like</H1>
          <BodyLg color={colors.textMuted}>
            Most trainers ask you to trust them. We would rather show you the numbers — including
            the weeks that went backwards, because those are in there too.
          </BodyLg>
        </Stack>
      </Section>

      <Container style={{ paddingBottom: r.isPhone ? space.lg : space.xl }}>
        <View
          style={{
            backgroundColor: colors.primaryDeep,
            borderRadius: radii.band,
            padding: r.isPhone ? 26 : 48,
            gap: space.lg,
          }}
        >
          <Stack gap={space.sm}>
            <Eyebrow color={colors.highlight}>Threshold over time</Eyebrow>
            <H2 color={colors.onDark}>[DOG NAME], twelve weeks of lead reactivity</H2>
            <BodyLg color={colors.onDarkMuted} style={{ maxWidth: 640 }}>
              How close another dog could get before [DOG NAME] reacted. Week four dips — that was
              a bad week with roadworks on the usual route. Week ten flattens off, which is what
              consolidation looks like rather than a plateau.
            </BodyLg>
          </Stack>

          <ProgressCurve data={sampleCurve} variant="dark" />

          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
              backgroundColor: 'rgba(255,252,245,0.08)',
              borderRadius: radii.field,
              padding: 18,
            }}
          >
            <View style={{ marginTop: 2 }}>
              <IconInfo size={20} color={colors.highlight} />
            </View>
            <Body color={colors.onDarkMuted} style={{ flex: 1 }}>
              This is sample data, shown to explain the method. Real client curves go up here once
              we have a case and the owner&rsquo;s permission to share it.
            </Body>
          </View>
        </View>
      </Container>

      {/* -------------------------------------------------- How we measure */}
      <Section spacing="normal">
        <Stack gap={space.lg}>
          <Stack gap={10} style={{ maxWidth: 660 }}>
            <Eyebrow>How we measure</Eyebrow>
            <H2>Four taps, every time something happens</H2>
            <BodyLg color={colors.textMuted}>
              Logging a moment takes about three seconds, which is the only reason it actually gets
              done. Nothing is written up from memory afterwards.
            </BodyLg>
          </Stack>

          <Grid gap={space.md}>
            {MEASURES.map((measure, i) => (
              <Col key={measure.title}>
                <Card tint={i % 2 === 0 ? 'mint' : 'peach'} padding={28} style={{ flex: 1 }}>
                  <Stack gap={10}>
                    <IconBubble size={44}>
                      <Label
                        color={i % 2 === 0 ? colors.primary : colors.accentInk}
                        style={{ fontSize: 17 }}
                      >
                        {String(i + 1)}
                      </Label>
                    </IconBubble>
                    <H3>{measure.title}</H3>
                    <Body color={i % 2 === 0 ? colors.textOnMint : colors.textOnPeach}>
                      {measure.body}
                    </Body>
                  </Stack>
                </Card>
              </Col>
            ))}
          </Grid>
        </Stack>
      </Section>

      {/* ------------------------------------------------------- Triggers */}
      <Section background={colors.bgAlt} spacing="normal">
        <Grid gap={r.isPhone ? space.lg : space.xl} align="flex-start">
          <Col weight={1}>
            <Stack gap={space.md}>
              <Eyebrow>The five triggers</Eyebrow>
              <H2>Not every reaction is the same reaction</H2>
              <BodyLg color={colors.textMuted} style={{ maxWidth: 460 }}>
                A dog who barks at vehicles and a dog who barks at other dogs need completely
                different plans. Recording which one it was — rather than &ldquo;he was
                reactive&rdquo; — is what makes the difference visible.
              </BodyLg>
              <Stack gap={10} style={{ marginTop: 4 }}>
                {TRIGGER_TYPES.map((trigger) => (
                  <View
                    key={trigger}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                  >
                    <Paw size={18} />
                    <Label style={{ fontSize: 16.5 }}>{TRIGGER_LABELS[trigger]}</Label>
                  </View>
                ))}
              </Stack>
            </Stack>
          </Col>

          <Col weight={1}>
            <Stack gap={space.md}>
              <Eyebrow>The three outcomes</Eyebrow>
              <H2>What we are actually growing</H2>
              <Stack gap={space.sm} style={{ marginTop: 4 }}>
                {OUTCOMES.map((outcome) => (
                  <Card key={outcome} tint="white" padding={24}>
                    <Stack gap={7}>
                      <H3 style={{ fontSize: 19, lineHeight: 25 }}>
                        {OUTCOME_LABELS[outcome].title}
                      </H3>
                      <Body color={colors.textMuted}>{OUTCOME_LABELS[outcome].body}</Body>
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </Stack>
          </Col>
        </Grid>
      </Section>

      <Section spacing="normal">
        <View
          style={{
            flexDirection: r.isPhone ? 'column' : 'row',
            alignItems: r.isPhone ? 'flex-start' : 'center',
            gap: space.lg,
          }}
        >
          <Stack gap={10} style={{ flex: r.isPhone ? undefined : 1 }}>
            <H2 style={{ fontSize: r.isPhone ? 27 : 32, lineHeight: r.isPhone ? 32 : 38 }}>
              Want a curve of your own?
            </H2>
            <BodyLg color={colors.textMuted} style={{ maxWidth: 520 }}>
              It starts with a first hello. We usually reply {practice.replyTime}.
            </BodyLg>
          </Stack>
          <View style={{ flexDirection: r.isPhone ? 'column' : 'row', gap: space.sm }}>
            <Button label="Book a first hello" href="/booking" block={r.isPhone} />
            <Button
              label="Ask a question"
              href="/contact"
              variant="secondary"
              block={r.isPhone}
            />
          </View>
        </View>
      </Section>
    </Page>
  );
}
