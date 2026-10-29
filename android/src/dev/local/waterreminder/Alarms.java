package dev.local.waterreminder;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** One pending system alarm at a time; every firing chains the next one. */
final class Alarms {
    private static final int REQUEST = 7;
    private static final String ACTION = "dev.local.waterreminder.TICK";

    private Alarms() {
    }

    private static PendingIntent pending(Context context) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        intent.setAction(ACTION);
        return PendingIntent.getBroadcast(context, REQUEST, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancel(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager != null) {
            manager.cancel(pending(context));
        }
    }

    /** Exact when the system allows it, otherwise the closest inexact alarm. */
    static void schedule(Context context, Plan plan) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) {
            return;
        }
        PendingIntent intent = pending(context);
        manager.cancel(intent);
        if (plan.paused) {
            return;
        }
        long now = System.currentTimeMillis();
        long when = plan.nextAt > now ? plan.nextAt : now + 60000L;
        plan.nextAt = when;
        boolean exact = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms();
        try {
            if (exact) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, intent);
            } else {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, intent);
            }
        } catch (SecurityException error) {
            manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, intent);
        }
    }
}
