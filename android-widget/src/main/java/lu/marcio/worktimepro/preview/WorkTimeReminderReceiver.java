package lu.marcio.worktimepro.preview;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.util.Calendar;

/** Inexact, silent personal reminders; no salary, work status or location in notifications. */
public class WorkTimeReminderReceiver extends BroadcastReceiver {
    static final String PREFS = "worktime_personal_reminders";
    static final String CHANNEL = "worktime_personal_reminders";
    static final String ENTRY = "entry";
    static final String EXIT = "exit";

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean validTime(String time) {
        return time != null && time.matches("([01][0-9]|2[0-3]):[0-5][0-9]");
    }

    static PendingIntent intent(Context context, String kind) {
        Intent event = new Intent(context, WorkTimeReminderReceiver.class);
        event.setAction("lu.marcio.worktimepro.preview.REMINDER_" + kind);
        return PendingIntent.getBroadcast(context, ENTRY.equals(kind) ? 731 : 732,
            event, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static boolean enabledDay(int mask, Calendar day) {
        return (mask & (1 << (day.get(Calendar.DAY_OF_WEEK) - 1))) != 0;
    }

    static long nextTime(String clock, int mask, long now) {
        if (!validTime(clock) || mask < 1 || mask > 127) return -1;
        Calendar day = Calendar.getInstance();
        day.setTimeInMillis(now);
        int hour = Integer.parseInt(clock.substring(0, 2));
        int minute = Integer.parseInt(clock.substring(3, 5));
        for (int i = 0; i <= 7; i++) {
            Calendar candidate = (Calendar) day.clone();
            candidate.add(Calendar.DAY_OF_YEAR, i);
            candidate.set(Calendar.HOUR_OF_DAY, hour);
            candidate.set(Calendar.MINUTE, minute);
            candidate.set(Calendar.SECOND, 0);
            candidate.set(Calendar.MILLISECOND, 0);
            if (enabledDay(mask, candidate) && candidate.getTimeInMillis() > now)
                return candidate.getTimeInMillis();
        }
        return -1;
    }

    static void schedule(Context context) {
        AlarmManager manager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (manager == null) throw new IllegalStateException("AlarmManager unavailable");
        SharedPreferences config = prefs(context);
        for (String kind : new String[]{ENTRY, EXIT}) {
            PendingIntent alarm = intent(context, kind);
            manager.cancel(alarm);
            if (!config.getBoolean("enabled", false)) continue;
            long next = nextTime(config.getString(kind, ""), config.getInt("days", 0), System.currentTimeMillis());
            if (next > 0) manager.setAndAllowWhileIdle(AlarmManager.RTC, next, alarm);
        }
    }

    @Override public void onReceive(Context context, Intent event) {
        if (event == null || event.getAction() == null) return;
        String action = event.getAction();
        String kind = action.endsWith("_entry") ? ENTRY : action.endsWith("_exit") ? EXIT : "";
        if (kind.isEmpty()) return;
        SharedPreferences config = prefs(context);
        if (!config.getBoolean("enabled", false)) return;
        try {
            Calendar now = Calendar.getInstance();
            String clock = config.getString(kind, "");
            if (!validTime(clock) || !enabledDay(config.getInt("days", 0), now)) return;
            Calendar planned = (Calendar) now.clone();
            planned.set(Calendar.HOUR_OF_DAY, Integer.parseInt(clock.substring(0, 2)));
            planned.set(Calendar.MINUTE, Integer.parseInt(clock.substring(3, 5)));
            planned.set(Calendar.SECOND, 0); planned.set(Calendar.MILLISECOND, 0);
            long delay = now.getTimeInMillis() - planned.getTimeInMillis();
            if (delay < 0 || delay > 2L * 60 * 60 * 1000) return;
            String day = now.get(Calendar.YEAR) + "-" + now.get(Calendar.DAY_OF_YEAR);
            if (day.equals(config.getString("last_" + kind, ""))) return;
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null || !manager.areNotificationsEnabled()) return;
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Lembretes WorkTime", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Lembretes silenciosos para confirmar o relógio de ponto");
            channel.setSound(null, null);
            channel.enableVibration(false);
            manager.createNotificationChannel(channel);
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            Notification.Builder builder = new Notification.Builder(context, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_recent_history)
                .setContentTitle(ENTRY.equals(kind) ? "Lembrete de entrada" : "Lembrete de saída")
                .setContentText("Confirma o relógio de ponto quando estiveres em segurança.")
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setOnlyAlertOnce(true).setAutoCancel(true);
            if (launch != null) builder.setContentIntent(PendingIntent.getActivity(context, 733, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            manager.notify(ENTRY.equals(kind) ? 731 : 732, builder.build());
            config.edit().putString("last_" + kind, day).apply();
        } catch (Exception ignored) {
            // A denied permission or unavailable service must not crash the app.
        } finally {
            try { schedule(context); } catch (Exception ignored) {}
        }
    }
}
