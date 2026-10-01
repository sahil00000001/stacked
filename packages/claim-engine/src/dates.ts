import { addDays, addMonths, differenceInYears, format, parseISO } from "date-fns";

/*
 * All dates are calendar dates (YYYY-MM-DD) in Asia/Kolkata. They are parsed as
 * local midnight and formatted back the same way, so the host timezone never
 * shifts a day. ISO date strings compare correctly as plain strings.
 */

const toISO = (d: Date): string => format(d, "yyyy-MM-dd");

export const addMonthsISO = (iso: string, n: number): string => toISO(addMonths(parseISO(iso), n));
export const addDaysISO = (iso: string, n: number): string => toISO(addDays(parseISO(iso), n));
export const ageOn = (dob: string, on: string): number => differenceInYears(parseISO(on), parseISO(dob));

const longDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2027-03-14" → "14 March 2027" */
export const formatDateLong = (iso: string): string => longDate.format(new Date(`${iso}T00:00:00Z`));
