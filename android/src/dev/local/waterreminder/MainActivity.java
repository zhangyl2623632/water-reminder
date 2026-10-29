package dev.local.waterreminder;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.InputType;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/** One screen: status, three fields, and the buttons that drive the alarm. */
public class MainActivity extends Activity implements View.OnClickListener {
    private EditText intervalField;
    private EditText startField;
    private EditText endField;
    private TextView status;
    private TextView banner;
    private Button saveButton;
    private Button pauseButton;
    private Button previewButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Notifier.ensureChannel(this);

        ScrollView scroll = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        int pad = dp(22);
        root.setPadding(pad, pad, pad, pad);

        banner = new TextView(this);
        banner.setTextSize(13);
        banner.setPadding(dp(12), dp(10), dp(12), dp(10));
        banner.setBackgroundColor(0xFFFFF3E0);
        banner.setTextColor(0xFF8A5A00);
        banner.setVisibility(View.GONE);
        banner.setOnClickListener(this);
        root.addView(banner);

        TextView title = new TextView(this);
        title.setText("💧 喝水提醒");
        title.setTextSize(23);
        root.addView(title);

        TextView lede = new TextView(this);
        lede.setText("按手机本地时钟定时，一次只弹一条；不在时段内绝不打扰。");
        lede.setTextSize(13);
        lede.setPadding(0, dp(6), 0, dp(16));
        root.addView(lede);

        status = new TextView(this);
        status.setTextSize(15);
        status.setPadding(0, 0, 0, dp(6));
        root.addView(status);

        intervalField = field(root, "提醒间隔（分钟，5–480）");
        startField = field(root, "开始时间（HH:MM）");
        endField = field(root, "结束时间（HH:MM）");

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setPadding(0, dp(16), 0, dp(4));
        saveButton = button(buttons, "保存并开始");
        saveButton.setOnClickListener(this);
        pauseButton = button(buttons, "暂停");
        pauseButton.setOnClickListener(this);
        root.addView(buttons);

        previewButton = new Button(this);
        previewButton.setText("预览一条提醒");
        previewButton.setOnClickListener(this);
        root.addView(previewButton, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView note = new TextView(this);
        note.setTextSize(12);
        note.setPadding(0, dp(20), 0, 0);
        note.setText("说明：提醒依赖系统闹钟和通知权限。省电模式、系统清理后台时可能延迟几分钟；关掉通知就收不到。"
                + "重启手机后会自动恢复。所有设置只存在本机，不联网。");
        root.addView(note);

        scroll.addView(root);
        setContentView(scroll);

        loadIntoFields();
        askNotificationPermission();
    }

    @Override
    protected void onResume() {
        super.onResume();
        refreshStatus();
        refreshBanner();
    }

    @Override
    public void onClick(View view) {
        if (view == saveButton) {
            save();
        } else if (view == pauseButton) {
            toggle();
        } else if (view == previewButton) {
            Notifier.show(this, Notifier.pick());
            toast("已发出一条提醒；没看到请点上面的提示去开通知");
        } else if (view == banner) {
            openNotificationSettings();
        }
    }

    /** Tells the user when the heads-up banner or the notification permission is off. */
    private void refreshBanner() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        String problem = null;
        if (manager != null && !manager.areNotificationsEnabled()) {
            problem = "通知已关闭 → 点这里打开（否则收不到提醒）";
        } else if (manager != null && Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = manager.getNotificationChannel(Notifier.CHANNEL_ID);
            if (channel != null && channel.getImportance() < NotificationManager.IMPORTANCE_HIGH) {
                problem = "提醒横幅/声音被调低了 → 点这里改成「横幅」";
            }
        }
        if (problem == null) {
            banner.setVisibility(View.GONE);
        } else {
            banner.setText(problem);
            banner.setVisibility(View.VISIBLE);
        }
    }

    private void openNotificationSettings() {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
            startActivity(intent);
        } catch (RuntimeException error) {
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(android.net.Uri.parse("package:" + getPackageName()));
                startActivity(fallback);
            } catch (RuntimeException ignored) {
                toast("请到系统设置里打开本应用的通知");
            }
        }
    }

    private void askNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 3);
        }
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private EditText field(LinearLayout parent, String label) {
        TextView caption = new TextView(this);
        caption.setText(label);
        caption.setTextSize(13);
        caption.setPadding(0, dp(12), 0, dp(2));
        parent.addView(caption);
        EditText input = new EditText(this);
        input.setInputType(InputType.TYPE_CLASS_TEXT);
        input.setTextSize(17);
        parent.addView(input);
        return input;
    }

    private Button button(LinearLayout parent, String text) {
        Button button = new Button(this);
        button.setText(text);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        params.setMargins(0, 0, dp(8), 0);
        button.setLayoutParams(params);
        parent.addView(button);
        return button;
    }

    private void loadIntoFields() {
        Plan plan = Plan.load(this);
        intervalField.setText(String.valueOf(plan.interval));
        startField.setText(Schedule.clock(plan.start));
        endField.setText(Schedule.clock(plan.end));
        pauseButton.setText(plan.paused ? "继续" : "暂停");
    }

    private void save() {
        int interval;
        try {
            interval = Integer.parseInt(intervalField.getText().toString().trim());
        } catch (NumberFormatException error) {
            toast("间隔要填数字，例如 60");
            return;
        }
        if (interval < Schedule.MIN_INTERVAL || interval > Schedule.MAX_INTERVAL) {
            toast("间隔需要在 5–480 分钟之间");
            return;
        }
        int start = parseClock(startField.getText().toString());
        int end = parseClock(endField.getText().toString());
        if (start < 0 || end < 0) {
            toast("时间格式用 HH:MM，例如 09:00");
            return;
        }
        if (start == end) {
            toast("开始和结束时间不能相同");
            return;
        }
        Plan plan = Plan.load(this);
        plan.interval = interval;
        plan.start = start;
        plan.end = end;
        plan.paused = false;
        long now = System.currentTimeMillis();
        plan.rollDay(now);
        plan.nextAt = Schedule.nextDueAt(now, interval, start, end);
        plan.save(this);
        Alarms.schedule(this, plan);
        loadIntoFields();
        refreshStatus();
        toast("已保存 · 下次提醒 " + Schedule.whenLabel(plan.nextAt, now));
    }

    private void toggle() {
        Plan plan = Plan.load(this);
        long now = System.currentTimeMillis();
        plan.rollDay(now);
        plan.paused = !plan.paused;
        if (plan.paused) {
            Alarms.cancel(this);
            plan.nextAt = 0L;
        } else {
            plan.nextAt = Schedule.nextDueAt(now, plan.interval, plan.start, plan.end);
        }
        plan.save(this);
        if (!plan.paused) {
            Alarms.schedule(this, plan);
        }
        pauseButton.setText(plan.paused ? "继续" : "暂停");
        refreshStatus();
        toast(plan.paused ? "已暂停，配置保留" : "已继续");
    }

    private void refreshStatus() {
        Plan plan = Plan.load(this);
        long now = System.currentTimeMillis();
        String window = Schedule.clock(plan.start) + "–" + Schedule.clock(plan.end);
        String line;
        if (plan.paused) {
            line = "已暂停 · 每 " + plan.interval + " 分钟 · 时段 " + window;
        } else if (!Schedule.insideWindow(now, plan.start, plan.end)) {
            long next = plan.nextAt > now ? plan.nextAt : Schedule.nextWindowStart(now, plan.start, plan.end);
            line = "等待中（不在时段内） · 下次 " + Schedule.whenLabel(next, now) + " · 时段 " + window;
        } else {
            line = "提醒中 · 下次 " + Schedule.whenLabel(plan.nextAt, now) + " · 每 " + plan.interval + " 分钟 · 今日 " + plan.count + " 次";
        }
        status.setText(line);
    }

    private static int parseClock(String text) {
        if (text == null) {
            return -1;
        }
        String value = text.trim();
        int colon = value.indexOf(':');
        if (colon <= 0 || colon == value.length() - 1) {
            return -1;
        }
        try {
            int hour = Integer.parseInt(value.substring(0, colon).trim());
            int minute = Integer.parseInt(value.substring(colon + 1).trim());
            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                return -1;
            }
            return hour * 60 + minute;
        } catch (NumberFormatException error) {
            return -1;
        }
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }
}
