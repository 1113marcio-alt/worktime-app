package lu.marcio.worktimepro.preview;

import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WorkTimeReminder")
public class WorkTimeReminderPlugin extends Plugin {
    @PluginMethod
    public void configure(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26) { call.reject("Android 8 ou superior necessário."); return; }
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        String entry = call.getString("entry", "");
        String exit = call.getString("exit", "");
        int days = call.getInt("days", 0);
        boolean pauseEnabled = Boolean.TRUE.equals(call.getBoolean("pauseEnabled", false));
        String pause = call.getString("pause", "12:00");
        if (enabled && (!WorkTimeReminderReceiver.validTime(entry) ||
            !WorkTimeReminderReceiver.validTime(exit) || (pauseEnabled && !WorkTimeReminderReceiver.validTime(pause)) || days < 1 || days > 127)) {
            call.reject("Horários inválidos."); return;
        }
        Context context = getContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (enabled && (manager == null || !manager.areNotificationsEnabled())) {
            call.reject("Autoriza as notificações nas definições Android."); return;
        }
        SharedPreferences prefs = WorkTimeReminderReceiver.prefs(context);
        boolean oldEnabled = prefs.getBoolean("enabled", false);
        String oldEntry = prefs.getString("entry", "");
        String oldExit = prefs.getString("exit", "");
        int oldDays = prefs.getInt("days", 0);
        boolean oldPauseEnabled = prefs.getBoolean("pauseEnabled", false);
        String oldPause = prefs.getString("pause", "12:00");
        if (!prefs.edit().putBoolean("enabled", enabled).putString("entry", entry)
            .putString("exit", exit).putInt("days", days).putBoolean("pauseEnabled", pauseEnabled).putString("pause", pause).commit()) {
            call.reject("Não foi possível guardar."); return;
        }
        try {
            WorkTimeReminderReceiver.schedule(context);
            call.resolve();
        } catch (Exception error) {
            prefs.edit().putBoolean("enabled", oldEnabled).putString("entry", oldEntry)
                .putString("exit", oldExit).putInt("days", oldDays).putBoolean("pauseEnabled", oldPauseEnabled).putString("pause", oldPause).commit();
            try { WorkTimeReminderReceiver.schedule(context); } catch (Exception ignored) {}
            call.reject("Não foi possível programar os lembretes.", error);
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        Context context = getContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        SharedPreferences prefs = WorkTimeReminderReceiver.prefs(context);
        result.put("available", Build.VERSION.SDK_INT >= 26);
        result.put("allowed", manager != null && manager.areNotificationsEnabled());
        result.put("enabled", prefs.getBoolean("enabled", false));
        result.put("entry", prefs.getString("entry", "05:00"));
        result.put("exit", prefs.getString("exit", "16:00"));
        result.put("days", prefs.getInt("days", 62));
        result.put("pauseEnabled", prefs.getBoolean("pauseEnabled", false));
        result.put("pause", prefs.getString("pause", "12:00"));
        call.resolve(result);
    }

    @PluginMethod
    public void reschedule(PluginCall call) {
        if (Build.VERSION.SDK_INT < 26) { call.resolve(); return; }
        try { WorkTimeReminderReceiver.schedule(getContext()); call.resolve(); }
        catch (Exception error) { call.reject("Não foi possível reprogramar.", error); }
    }
}
