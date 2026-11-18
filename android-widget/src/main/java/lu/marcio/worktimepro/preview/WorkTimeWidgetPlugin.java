package lu.marcio.worktimepro.preview;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WorkTimeWidget")
public final class WorkTimeWidgetPlugin extends Plugin {
    private Context appContext() { return getContext().getApplicationContext(); }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        WidgetStore.setEnabled(appContext(), enabled);
        WorkTimeWidgetProvider.updateAll(appContext());
        call.resolve();
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
        call.resolve();
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
