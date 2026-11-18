package lu.marcio.worktimepro.preview;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WorkTimeWidget")
public final class WorkTimeWidgetPlugin extends Plugin {
    private Context appContext() { return getContext().getApplicationContext(); }

    // Native preferences are the authority on whether home-screen actions
    // were explicitly enabled. Reinstalling the Preview can clear this state.
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", WidgetStore.isEnabled(appContext()));
        result.put("notificationsEnabled", WidgetStore.notificationsEnabled(appContext()));
        result.put("state", WidgetStore.state(appContext()));
        result.put("hasPendingEvents", WidgetStore.pending(appContext()).length() > 0);
        call.resolve(result);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        WidgetStore.setEnabled(appContext(), enabled);
        WorkTimeWidgetProvider.updateAll(appContext());
        WorkTimeNotification.update(appContext());
        JSObject result = new JSObject();
        result.put("enabled", WidgetStore.isEnabled(appContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void getPendingActions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("events", WidgetStore.pending(appContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void acknowledgeActions(PluginCall call) {
        WidgetStore.acknowledge(appContext(), call.getString("throughId", ""));
        call.resolve();
    }

    @PluginMethod
    public void updateState(PluginCall call) {
        WidgetStore.setState(appContext(),
            call.getString("state", "idle"), call.getString("started", ""));
        WorkTimeWidgetProvider.updateAll(appContext());
        WorkTimeNotification.update(appContext());
        call.resolve();
    }

    @PluginMethod
    public void setShiftNotifications(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        WidgetStore.setNotificationsEnabled(appContext(),enabled);
        WorkTimeNotification.update(appContext());
        JSObject result = new JSObject();
        result.put("systemAllowed", WorkTimeNotification.systemAllowed(appContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void getShiftNotificationStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", WidgetStore.notificationsEnabled(appContext()));
        result.put("systemAllowed", WorkTimeNotification.systemAllowed(appContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(Settings.EXTRA_APP_PACKAGE, appContext().getPackageName());
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception err) {
            call.reject("Não foi possível abrir as definições de notificações",err);
        }
    }

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        AppWidgetManager manager = AppWidgetManager.getInstance(appContext());
        JSObject result = new JSObject();
        boolean supported = android.os.Build.VERSION.SDK_INT >= 26
            && manager.isRequestPinAppWidgetSupported();
        result.put("supported", supported);
        boolean requested = false;
        if (supported) {
            requested = manager.requestPinAppWidget(
                new ComponentName(appContext(), WorkTimeWidgetProvider.class), null, null);
        }
        result.put("requested", requested);
        call.resolve(result);
    }
}
