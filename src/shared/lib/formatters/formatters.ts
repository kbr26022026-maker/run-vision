function splitClock(totalSeconds: number) {
  const total = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Clock-style duration: `4:05`, `31:25`, `1:02:13`. */
export function formatClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return '—';
  }

  const { hours, minutes, seconds } = splitClock(totalSeconds);
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  }

  return `${minutes}:${ss}`;
}

export function formatDuration(seconds: number): string {
  return formatClock(seconds);
}

/** Pace in `m:ss`. Rounds the whole value first so 6:59.6 becomes 7:00, not 6:60. */
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm === null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return '—';
  }

  const total = Math.round(secondsPerKm);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatHeartRate(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : `${Math.round(value)}`;
}

export function formatGrade(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

export function formatElevation(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} м`;
}

export function formatPlaybackDistance(meters: number): string {
  return (meters / 1000).toFixed(2);
}

export function formatDistanceKm(meters: number, digits = 2): string {
  if (!Number.isFinite(meters) || meters < 0) {
    return '—';
  }

  return (meters / 1000).toFixed(digits);
}

export function formatActivityDuration(totalSeconds: number): string {
  return formatClock(totalSeconds);
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

const timeFormatter = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatActivityDate(date: Date): string {
  return dateFormatter.format(date).replace(/\s*г\.$/, '');
}

export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date).replace('.', '');
}

export function formatTimeOfDay(date: Date): string {
  return timeFormatter.format(date);
}

export function formatActivityDateTime(date: Date): string {
  return `${formatActivityDate(date)}, ${formatTimeOfDay(date)}`;
}
