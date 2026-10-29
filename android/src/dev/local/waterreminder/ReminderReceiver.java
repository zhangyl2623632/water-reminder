package dev.local.waterreminder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires at the due time: shows one notification, then chains the next alarm. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Plan plan = Plan.load(context);
        long now = System.currentTimeMillis();
        plan.rollDay(now);
        if (!plan.paused && Schedule.insideWindow(now, plan.start, plan.end)) {
            Notifier.show(context, Notifier.pick());
            plan.count += 1;
        }
        plan.nextAt = Schedule.nextDueAt(now, plan.interval, plan.start, plan.end);
        plan.save(context);
        Alarms.schedule(context, plan);
    }
}
