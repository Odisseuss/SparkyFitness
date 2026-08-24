/**
 * HH:MM (device clock) -> a Date on selectedDate, rolling bedtime back a day
 * when it is chronologically after wake time on the same calendar day —
 * matches web's exact overnight-wraparound handling in SleepEntrySection.
 */
export function toBedtimeWakeTimeDates(
  selectedDate: string,
  bedtimeHHMM: string,
  wakeTimeHHMM: string,
): { bed: Date; wake: Date } {
  const wake = new Date(`${selectedDate}T${wakeTimeHHMM}:00`);
  let bed = new Date(`${selectedDate}T${bedtimeHHMM}:00`);
  if (bed > wake) {
    bed = new Date(bed.getTime() - 24 * 60 * 60 * 1000);
  }
  return { bed, wake };
}
