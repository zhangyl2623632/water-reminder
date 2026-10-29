package dev.local.waterreminder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;

/** Builds the single, short, loud-enough notification (heads-up + sound). */
final class Notifier {
    /** New id on purpose: channel settings are immutable once created. */
    static final String CHANNEL_ID = "water-reminder-alert-v2";
    private static final String OLD_CHANNEL_ID = "water-reminder";
    private static final int NOTIFICATION_ID = 1;
    private static final long[] VIBRATION = { 0L, 400L, 200L, 400L };

    private static final String[] TEXTS = {
        "⏰ 该喝水啦，小口慢饮，不要一次性猛灌。",
        "💧 抿一口水吧，润润嗓子再继续。",
        "🌿 起身伸个懒腰，顺手喝两口水。",
        "💧 水杯见底了吗？续上，慢慢喝。",
        "🍃 这会儿喝几口，比一次灌一大杯舒服。",
        "⏰ 补水时间到，小口慢饮更舒服。",
        "💧 喝口水，歇三十秒再出发。",
        "💧 别等口渴才喝，现在来几口。",
    };

    private static int last = -1;

    private Notifier() {
    }

    static String pick() {
        int index = (int) (Math.random() * TEXTS.length);
        if (index == last) {
            index = (index + 1) % TEXTS.length;
        }
        last = index;
        return TEXTS[index];
    }

    /** Creates the heads-up channel and drops the silent one from earlier builds. */
    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) {
            return;
        }
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }
        try {
            manager.deleteNotificationChannel(OLD_CHANNEL_ID);
        } catch (RuntimeException error) {
            // already gone
        }
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "喝水提醒（横幅+声音）", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("到点从屏幕顶部弹出，并播放提示音");
        channel.enableVibration(true);
        channel.setVibrationPattern(VIBRATION);
        channel.enableLights(true);
        channel.setLightColor(0xFF2F7FC4);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setShowBadge(true);
        AudioAttributes audio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
        channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), audio);
        manager.createNotificationChannel(channel);
    }

    @SuppressWarnings("deprecation")
    static void show(Context context, String text) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            return;
        }
        ensureChannel(context);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(context, 11, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(context, CHANNEL_ID)
                : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("💧 该喝水啦")
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true)
                .setCategory(Notification.CATEGORY_REMINDER)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setContentIntent(content);
        if (Build.VERSION.SDK_INT < 26) {
            builder.setPriority(Notification.PRIORITY_HIGH)
                    .setDefaults(Notification.DEFAULT_ALL)
                    .setVibrate(VIBRATION)
                    .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                    .setTicker(text);
        }
        try {
            manager.notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException error) {
            // Notifications turned off for this app; MainActivity shows the hint.
        }
    }
}
