package dev.local.waterreminder;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.Calendar;

/** Persisted configuration, stored privately on the device. */
final class Plan {
    private static final String FILE = "water-reminder";

    int interval = 60;
    int start = 9 * 60;
    int end = 21 * 60;
    boolean paused = false;
    long nextAt = 0L;
    int count = 0;
    String day = "";

    static Plan load(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
        Plan plan = new Plan();
        plan.interval = Schedule.clamp(prefs.getInt("interval", 60), Schedule.MIN_INTERVAL, Schedule.MAX_INTERVAL);
        plan.start = Schedule.clamp(prefs.getInt("start", 9 * 60), 0, 1439);
        plan.end = Schedule.clamp(prefs.getInt("end", 21 * 60), 0, 1439);
        plan.paused = prefs.getBoolean("paused", false);
        plan.nextAt = prefs.getLong("nextAt", 0L);
        plan.count = prefs.getInt("count", 0);
        plan.day = prefs.getString("day", "");
        return plan;
    }

    void save(Context context) {
        context.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
                .putInt("interval", interval)
                .putInt("start", start)
                .putInt("end", end)
                .putBoolean("paused", paused)
                .putLong("nextAt", nextAt)
                .putInt("count", count)
                .putString("day", day)
                .apply();
    }

    void rollDay(long now) {
        String today = dayKey(now);
        if (!today.equals(day)) {
            day = today;
            count = 0;
        }
    }

    private static String dayKey(long at) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(at);
        return c.get(Calendar.YEAR) + "-" + (c.get(Calendar.MONTH) + 1) + "-" + c.get(Calendar.DAY_OF_MONTH);
    }
}
