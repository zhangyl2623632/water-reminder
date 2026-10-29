package dev.local.waterreminder;

import java.util.Calendar;

/**
 * Pure time math for the reminder. No Android types here, so the same code runs
 * in the desktop JVM test.
 */
final class Schedule {
    static final int MIN_INTERVAL = 5;
    static final int MAX_INTERVAL = 480;

    private Schedule() {
    }

    static int clamp(int value, int min, int max) {
        return value < min ? min : (value > max ? max : value);
    }

    static int minutesOfDay(long at) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        return c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
    }

    /** Both edges are inclusive; a start later than the end means an overnight window. */
    static boolean insideWindow(long at, int start, int end) {
        if (start == end) {
            return true;
        }
        int minute = minutesOfDay(at);
        return start < end ? (minute >= start && minute <= end) : (minute >= start || minute <= end);
    }

    private static long startOn(long at, int startMinute, int dayOffset) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        c.set(Calendar.HOUR_OF_DAY, startMinute / 60);
        c.set(Calendar.MINUTE, startMinute % 60);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (dayOffset != 0) {
            c.add(Calendar.DAY_OF_MONTH, dayOffset);
        }
        return c.getTimeInMillis();
    }

    static long nextWindowStart(long at, int start, int end) {
        long today = startOn(at, start, 0);
        int minute = minutesOfDay(at);
        if (start < end) {
            return minute < start ? today : startOn(at, start, 1);
        }
        if (start > end) {
            return (minute > end && minute < start) ? today : startOn(at, start, 1);
        }
        return startOn(at, start, 1);
    }

    static long nextDueAt(long at, int interval, int start, int end) {
        if (!insideWindow(at, start, end)) {
            return nextWindowStart(at, start, end);
        }
        long candidate = at + interval * 60000L;
        return insideWindow(candidate, start, end) ? candidate : nextWindowStart(candidate, start, end);
    }

    static String clock(int minutes) {
        return String.format("%02d:%02d", (minutes / 60) % 24, minutes % 60);
    }

    static String whenLabel(long at, long now) {
        Calendar a = Calendar.getInstance();
        a.setTimeInMillis(at);
        Calendar n = Calendar.getInstance();
        n.setTimeInMillis(now);
        String time = String.format("%02d:%02d", a.get(Calendar.HOUR_OF_DAY), a.get(Calendar.MINUTE));
        if (sameDay(a, n)) {
            return "今天 " + time;
        }
        Calendar t = Calendar.getInstance();
        t.setTimeInMillis(now);
        t.add(Calendar.DAY_OF_MONTH, 1);
        if (sameDay(a, t)) {
            return "明天 " + time;
        }
        return (a.get(Calendar.MONTH) + 1) + " 月 " + a.get(Calendar.DAY_OF_MONTH) + " 日 " + time;
    }

    private static boolean sameDay(Calendar a, Calendar b) {
        return a.get(Calendar.YEAR) == b.get(Calendar.YEAR)
                && a.get(Calendar.DAY_OF_YEAR) == b.get(Calendar.DAY_OF_YEAR);
    }
}
