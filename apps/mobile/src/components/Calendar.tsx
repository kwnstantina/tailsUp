// A month calendar for the booking request form.
//
// IMPORTANT — this shows the practice's USUAL working pattern, not live
// availability. There is no availability endpoint yet (the trainer-side
// calendar is a later phase), so a visitor is making a *request* against
// plausible slots and the trainer confirms or offers an alternative. The
// booking page says so in as many words rather than implying a slot is held.

import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors, radii } from '../design/tokens';
import { IconChevronLeft, IconChevronRight } from './Icons';
import { Label, Small } from './Type';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Midnight today, in the visitor's own timezone. */
function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Weekends are closed; everything from today onwards on a weekday is offerable. */
function isSelectable(date: Date, today: Date): boolean {
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return false;
  return date.getTime() >= today.getTime();
}

export function formatLongDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

interface CalendarProps {
  value: Date | null;
  onChange: (next: Date) => void;
}

export function Calendar({ value, onChange }: CalendarProps) {
  const today = useMemo(startOfToday, []);
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // Never let a visitor page back past the current month — there is nothing
  // bookable there.
  const canGoBack =
    view.getFullYear() > today.getFullYear() ||
    (view.getFullYear() === today.getFullYear() && view.getMonth() > today.getMonth());

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(view.getFullYear(), view.getMonth(), 1);
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    // getDay() is Sunday-first; the grid is Monday-first.
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;

    const cells: (Date | null)[] = Array.from({ length: leadingBlanks }, () => null);
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push(new Date(view.getFullYear(), view.getMonth(), day));
    }
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [view]);

  const shift = (months: number) =>
    setView((current) => new Date(current.getFullYear(), current.getMonth() + months, 1));

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityState={{ disabled: !canGoBack }}
          disabled={!canGoBack}
          onPress={() => shift(-1)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canGoBack ? 1 : 0.3 }}
        >
          <IconChevronLeft />
        </Pressable>

        <Label style={{ fontSize: 16.5 }}>
          {`${MONTHS[view.getMonth()]} ${view.getFullYear()}`}
        </Label>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next month"
          onPress={() => shift(1)}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <IconChevronRight />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 7 }}>
        {WEEKDAYS.map((day, i) => (
          <View key={day} style={{ flex: 1, height: 26, alignItems: 'center', justifyContent: 'center' }}>
            <Small color={i > 4 ? colors.placeholder : colors.textMuted} style={{ fontSize: 12.5 }}>
              {day}
            </Small>
          </View>
        ))}
      </View>

      <View style={{ gap: 7 }}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={{ flexDirection: 'row', gap: 7 }}>
            {week.map((date, dayIndex) => {
              if (!date) {
                return <View key={`blank-${dayIndex}`} style={{ flex: 1, height: 44 }} />;
              }

              const selectable = isSelectable(date, today);
              const selected = sameDay(date, value);

              return (
                <Pressable
                  key={date.toISOString()}
                  accessibilityRole="button"
                  accessibilityLabel={formatLongDate(date)}
                  accessibilityState={{ disabled: !selectable, selected }}
                  disabled={!selectable}
                  onPress={() => onChange(date)}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 44,
                    borderRadius: radii.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: selected
                      ? colors.primary
                      : !selectable
                        ? 'transparent'
                        : pressed
                          ? colors.mintSoft
                          : colors.surface,
                    borderWidth: selectable && !selected ? 2 : 0,
                    borderColor: colors.fieldBorder,
                  })}
                >
                  <Label
                    color={selected ? colors.onDark : selectable ? colors.text : colors.placeholder}
                    style={{ fontSize: 15 }}
                  >
                    {String(date.getDate())}
                  </Label>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The practice's usual start times. Confirmed by the trainer, not held. */
export const TIME_SLOTS = ['09:00', '10:30', '13:00', '15:30', '17:00'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

export function TimeSlotPicker({
  value,
  onChange,
  disabled,
}: {
  value: TimeSlot | null;
  onChange: (next: TimeSlot) => void;
  disabled: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 9, opacity: disabled ? 0.45 : 1 }}>
      {TIME_SLOTS.map((slot) => {
        const selected = slot === value;
        return (
          <Pressable
            key={slot}
            accessibilityRole="radio"
            accessibilityLabel={slot}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(slot)}
            style={({ pressed }) => ({
              height: 48,
              borderRadius: radii.sm,
              paddingHorizontal: 16,
              justifyContent: 'center',
              backgroundColor: selected
                ? colors.primary
                : pressed
                  ? colors.mintSoft
                  : colors.surface,
              borderWidth: selected ? 0 : 2,
              borderColor: colors.fieldBorder,
            })}
          >
            <Label color={selected ? colors.onDark : colors.text} style={{ fontSize: 15.5 }}>
              {slot}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Combine the chosen day and slot into the ISO timestamp POST /bookings wants.
 * `toISOString()` produces a Z-suffixed value, which Zod's
 * `datetime({ offset: true })` accepts.
 */
export function toRequestedAt(date: Date, slot: TimeSlot): string {
  const [hours, minutes] = slot.split(':').map(Number);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0,
  ).toISOString();
}
