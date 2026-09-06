// The lead capture form — POST /leads.
//
// Used twice: a three-field `compact` version on the home page and the full
// version on /contact. One implementation, so the validation can never drift
// between them.
//
// Client-side rules mirror the Zod schema in apps/api/src/routes/leads.ts
// exactly (name/contact 1–200, source 1–100, message ≤5000). The server is
// still the authority — this only exists so a visitor gets told about a typo
// without a round trip.

import { useState } from 'react';
import { View } from 'react-native';
import type { CreateLeadInput } from '@tailsup/shared';
import { ApiError, createLead } from '../api/client';
import { leadSources, practice } from '../content/site';
import { colors, space } from '../design/tokens';
import { Field, ChoiceChips, FormError, FormSuccess } from './Field';
import { Body, Small } from './Type';
import { Button } from './Ui';

const LIMITS = { name: 200, contact: 200, source: 100, message: 5000 } as const;

interface LeadFormProps {
  variant?: 'compact' | 'full';
}

export function LeadForm({ variant = 'full' }: LeadFormProps) {
  const full = variant === 'full';

  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function validate(): CreateLeadInput | null {
    const next: Record<string, string> = {};

    const trimmedName = name.trim();
    const trimmedContact = contact.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length === 0) next.name = 'We need something to call you.';
    else if (trimmedName.length > LIMITS.name) next.name = 'That name is a little too long for us.';

    if (trimmedContact.length === 0) {
      next.contact = 'Without this we have no way to reply.';
    } else if (trimmedContact.length > LIMITS.contact) {
      next.contact = 'That is longer than we can store.';
    }

    if (full && !source) next.source = 'Pick whichever is closest.';

    if (trimmedMessage.length > LIMITS.message) {
      next.message = 'That is a very long message — could you trim it a little?';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      name: trimmedName,
      contact: trimmedContact,
      // `source` answers "how did you find us?", which is exactly what the
      // trainer wants to know. The compact form doesn't ask, so it records
      // where the lead came from instead.
      source: full && source ? source : 'website',
      ...(trimmedMessage.length > 0 ? { message: trimmedMessage } : {}),
    };
  }

  async function submit() {
    setFormError(null);
    const payload = validate();
    if (!payload) return;

    setBusy(true);
    try {
      await createLead(payload);
      setDone(true);
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

  if (done) {
    return (
      <FormSuccess
        title="Got it — thank you."
        body={`We've got your note and we'll come back to you ${practice.replyTime}. If it's urgent, ring us instead.`}
      />
    );
  }

  return (
    <View style={{ gap: space.md }}>
      {formError ? <FormError message={formError} /> : null}

      <Field
        label="Your name"
        value={name}
        onChangeText={setName}
        placeholder="Alex"
        error={errors.name}
        autoComplete="name"
        textContentType="name"
        maxLength={LIMITS.name}
      />

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

      {full ? (
        <ChoiceChips
          label="How did you find us?"
          options={leadSources}
          value={source as (typeof leadSources)[number] | null}
          onChange={setSource}
          error={errors.source}
        />
      ) : null}

      <Field
        label="What's going on?"
        value={message}
        onChangeText={setMessage}
        hint={full ? 'Optional, but it helps' : undefined}
        placeholder="She barks at every dog we pass and I've started walking her at 6am to avoid it…"
        multiline
        numberOfLines={full ? 6 : 4}
        error={errors.message}
        maxLength={LIMITS.message}
      />

      <View
        style={{
          flexDirection: full ? 'row' : 'column',
          alignItems: full ? 'center' : 'stretch',
          gap: space.md,
          marginTop: 4,
        }}
      >
        <Button label="Send it over" onPress={submit} busy={busy} block={!full} />
        {full ? (
          <Body color={colors.textMuted} style={{ flex: 1 }}>
            No newsletter, no automated sequence. Just a reply from a person.
          </Body>
        ) : (
          <Small>No newsletter. No drip campaign. Just a reply.</Small>
        )}
      </View>
    </View>
  );
}
