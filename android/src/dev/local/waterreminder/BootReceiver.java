package dev.local.waterreminder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Alarms do not survive a reboot, so restore the next one. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Plan plan = Plan.load(context);
        long now = System.currentTimeMillis();
        plan.rollDay(now);
        plan.nextAt = Schedule.nextDueAt(now, plan.interval, plan.start, plan.end);
        plan.save(context);
        Alarms.schedule(context, plan);
    }
}
