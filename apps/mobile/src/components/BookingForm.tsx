// The booking request form — POST /bookings.
//
// The endpoint writes TWO rows in one transaction (a `lead` carrying the
// requester's contact details, and the `booking` linked to it), because the
// booking table holds contact only by reference. That is invisible from here:
// this form posts CreateBookingInput and gets a BookingDTO back.
//
// Client-side rules mirror apps/api/src/routes/bookings.ts (name/contact
// 1–200, notes ≤5000, type from BOOKING_TYPES, requestedAt ISO-8601).

import { useState } from 'react';
import { View } from 'react-native';
import { BOOKING_TYPES, type BookingType } from '@tailsup/shared';
import type { CreateBookingInput } from '@tailsup/shared';
import { ApiError, createBooking } from '../api/client';
import { practice, services } from '../content/site';
import { colors, radii, space } from '../design/tokens';
import { useBreakpoint } from '../design/useBreakpoint';
import {
  Calendar,
  TimeSlotPicker,
  formatLongDate,
  toRequestedAt,
  type TimeSlot,
} from './Calendar';
import { Field, FormError, FormSuccess, OptionCards, type OptionCard } from './Field';
import { Col, Grid, Stack } from './Layout';
import { Body, H3, Label, Small } from './Type';
import { Button } from './Ui';

const LIMITS = { name: 200, contact: 200, notes: 5000 } as const;

// Built from the shared enum so a new booking type can never silently miss
// the form: BOOKING_TYPES is the same array the DB enum and Zod use.
const TYPE_OPTIONS: OptionCard<BookingType>[] = BOOKING_TYPES.map((type) => {
  const service = services.find((s) => s.type === type);
  return {
    value: type,
    title: service?.title ?? type,
    meta: service ? `${service.meta[0]?.value ?? ''} · ${service.price}` : '',
  };
});

function StepHeading({ step, children }: { step: number; children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: radii.pill,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Label color={colors.accentInk} style={{ fontSize: 14 }}>
          {String(step)}
        </Label>
      </View>
      <H3>{children}</H3>
    </View>
  );
}

export function BookingForm({ initialType }: { initialType?: BookingType }) {
  const r = useBreakpoint();

  const [type, setType] = useState<BookingType>(initialType ?? 'assessment');
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null);

  function validate(): CreateBookingInput | null {
    const next: Record<string, string> = {};

    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    const trimmedNotes = notes.trim();

    if (!date) next.when = 'Pick a day that suits you.';
    else if (!slot) next.when = 'Pick a time as well.';

    if (trimmedName.length === 0) next.name = 'We need something to call you.';
    else if (trimmedName.length > LIMITS.name) next.name = 'That name is a little too long for us.';

    if (trimmedContact.length === 0) {
      next.contact = 'Without this we cannot confirm anything.';
    } else if (trimmedContact.length > LIMITS.contact) {
      next.contact = 'That is longer than we can store.';
    }

    if (trimmedNotes.length > LIMITS.notes) {
      next.notes = 'That is a very long note — could you trim it a little?';
    }

    setErrors(next);
    if (Object.keys(next).length > 0 || !date || !slot) return null;

    return {
      name: trimmedName,
      contact: trimmedContact,
      type,
      requestedAt: toRequestedAt(date, slot),
      ...(trimmedNotes.length > 0 ? { notes: trimmedNotes } : {}),
    };
  }

  async function submit() {
    setFormError(null);
    const payload = validate();
    if (!payload || !date || !slot) return;

    setBusy(true);
    try {
      await createBooking(payload);
      setConfirmed(`${formatLongDate(date)} at ${slot}`);
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'Something unexpected went wrong. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (confirmed) {
    return (
      <FormSuccess
        title="Request sent."
        body={`We've asked for ${confirmed}. We'll confirm within ${practice.confirmTime} — and if that slot has gone we'll offer you the nearest one rather than leave you waiting. Nothing has been charged.`}
      />
    );
  }

  return (
    <Stack gap={space.lg}>
      {formError ? <FormError message={formError} /> : null}

      <Stack gap={space.sm}>
        <StepHeading step={1}>What kind of session?</StepHeading>
        <OptionCards options={TYPE_OPTIONS} value={type} onChange={setType} isPhone={r.isPhone} />
        <Small>
          New here? Start with a first hello — we ask everyone to, so we are not guessing.
        </Small>
      </Stack>

      <View style={{ height: 1, backgroundColor: colors.fieldBorder }} />

      <Stack gap={space.sm}>
        <StepHeading step={2}>When works for you?</StepHeading>
        <Grid gap={space.lg} align="flex-start">
          <Col weight={1}>
            <Calendar value={date} onChange={setDate} />
          </Col>
          <Col width={210}>
            <Stack gap={10}>
              <Label>{date ? `Times on ${formatLongDate(date)}` : 'Pick a day first'}</Label>
              <TimeSlotPicker value={slot} onChange={setSlot} disabled={!date} />
            </Stack>
          </Col>
        </Grid>
        {errors.when ? <Small color={colors.danger}>{errors.when}</Small> : null}
        <Small>
          These are our usual start times, not a live diary — we will confirm the exact slot with
          you.
        </Small>
      </Stack>

      <View style={{ height: 1, backgroundColor: colors.fieldBorder }} />

      <Stack gap={space.md}>
        <StepHeading step={3}>How do we reach you?</StepHeading>
        <Grid gap={space.md}>
          <Col>
            <Field
              label="Your name"
              value={name}
              onChangeText={setName}
              placeholder="Alex Moreau"
              error={errors.name}
              autoComplete="name"
              textContentType="name"
              maxLength={LIMITS.name}
            />
          </Col>
          <Col>
            <Field
              label="Email or phone"
              value={contact}
              onChangeText={setContact}
              placeholder="However you like to be reached"
              error={errors.contact}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              maxLength={LIMITS.contact}
            />
          </Col>
        </Grid>

        <Field
          label="Anything we should know first?"
          value={notes}
          onChangeText={setNotes}
          hint="Optional"
          placeholder="Luna is nervous with new people — it might be easier to meet in the park than at the house."
          multiline
          error={errors.notes}
          maxLength={LIMITS.notes}
        />

        <View
          style={{
            flexDirection: r.isPhone ? 'column' : 'row',
            alignItems: r.isPhone ? 'stretch' : 'center',
            gap: space.md,
            marginTop: 4,
          }}
        >
          <Button label="Request this time" onPress={submit} busy={busy} block={r.isPhone} />
          <Body color={colors.textMuted} style={{ flex: r.isPhone ? undefined : 1 }}>
            This sends a request, not a payment.
          </Body>
        </View>
      </Stack>
    </Stack>
  );
}
