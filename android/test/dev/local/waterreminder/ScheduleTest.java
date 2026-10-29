package dev.local.waterreminder;

import java.util.Calendar;

/** Desktop-JVM check of the pure schedule math that the APK ships. */
public class ScheduleTest {
    private static int passed;
    private static int failed;

    public static void main(String[] args) {
        int start = 9 * 60;
        int end = 21 * 60;

        check("inside 10:15", Schedule.insideWindow(at(10, 15), start, end), true);
        check("inside 08:59", Schedule.insideWindow(at(8, 59), start, end), false);
        check("inside 21:00 inclusive", Schedule.insideWindow(at(21, 0), start, end), true);
        check("inside 21:01", Schedule.insideWindow(at(21, 1), start, end), false);

        check("due 10:15 +60", clock(Schedule.nextDueAt(at(10, 15), 60, start, end)), "11:15");
        check("due 08:30 -> opening", clock(Schedule.nextDueAt(at(8, 30), 60, start, end)), "09:00");
        check("due 22:10 -> tomorrow", dayShift(at(22, 10), Schedule.nextDueAt(at(22, 10), 60, start, end)), 1);
        check("due 21:00 rolls over", dayShift(at(21, 0), Schedule.nextDueAt(at(21, 0), 60, start, end)), 1);
        check("due 20:30 rolls over", dayShift(at(20, 30), Schedule.nextDueAt(at(20, 30), 60, start, end)), 1);
        check("due 19:30 stays", clock(Schedule.nextDueAt(at(19, 30), 60, start, end)), "20:30");

        int nightStart = 22 * 60;
        int nightEnd = 6 * 60;
        check("overnight inside 23:00", Schedule.insideWindow(at(23, 0), nightStart, nightEnd), true);
        check("overnight outside 12:00", Schedule.insideWindow(at(12, 0), nightStart, nightEnd), false);
        check("overnight due 23:00 +30", clock(Schedule.nextDueAt(at(23, 0), 30, nightStart, nightEnd)), "23:30");
        check("overnight due 05:30 +30", clock(Schedule.nextDueAt(at(5, 30), 30, nightStart, nightEnd)), "06:00");
        check("overnight due 06:30", clock(Schedule.nextDueAt(at(6, 30), 30, nightStart, nightEnd)), "22:00");
        check("overnight due 12:00", clock(Schedule.nextDueAt(at(12, 0), 30, nightStart, nightEnd)), "22:00");

        check("label today", Schedule.whenLabel(at(16, 20), at(10, 0)), "今天 16:20");
        check("label tomorrow", Schedule.whenLabel(at(9, 0, 1), at(22, 0)), "明天 09:00");
        check("clock 540", Schedule.clock(540), "09:00");

        System.out.println("\n" + passed + "/" + (passed + failed) + " passed");
        if (failed > 0) {
            System.exit(1);
        }
    }

    private static long at(int hour, int minute) {
        return at(hour, minute, 0);
    }

    private static long at(int hour, int minute, int dayOffset) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        c.add(Calendar.DAY_OF_MONTH, dayOffset);
        return c.getTimeInMillis();
    }

    private static String clock(long at) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        return String.format("%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }

    private static int dayShift(long from, long to) {
        Calendar a = Calendar.getInstance();
        a.setTimeInMillis(from);
        Calendar b = Calendar.getInstance();
        b.setTimeInMillis(to);
        return b.get(Calendar.DAY_OF_YEAR) - a.get(Calendar.DAY_OF_YEAR);
    }

    private static void check(String name, Object actual, Object expected) {
        boolean ok = String.valueOf(actual).equals(String.valueOf(expected));
        if (ok) {
            passed++;
        } else {
            failed++;
        }
        System.out.println((ok ? "PASS  " : "FAIL  ") + name + " -> " + actual + (ok ? "" : " (expected " + expected + ")"));
    }
}
