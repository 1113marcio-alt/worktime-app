package lu.marcio.worktimepro.preview;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.widget.RemoteViews;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class WorkTimeWidgetProvider extends AppWidgetProvider {
    private static final String PREFIX = "lu.marcio.worktimepro.preview.WIDGET_";
    static final String ACTION_START = PREFIX + "START";
    static final String ACTION_PAUSE = PREFIX + "PAUSE";
    static final String ACTION_RESUME = PREFIX + "RESUME";
    static final String ACTION_FINISH = PREFIX + "FINISH";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        String operation = null;
        if (ACTION_START.equals(action)) operation = "start";
        else if (ACTION_PAUSE.equals(action)) operation = "pause";
        else if (ACTION_RESUME.equals(action)) operation = "resume";
        else if (ACTION_FINISH.equals(action)) operation = "finish";
        if (operation != null) {
            WidgetStore.record(context, operation);
            updateAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, build(context, id));
    }

    private static PendingIntent pending(Context context, int id, String action, int code) {
        Intent intent = new Intent(context, WorkTimeWidgetProvider.class).setAction(action);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id);
        return PendingIntent.getBroadcast(context, id * 10 + code, intent,
             PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static RemoteViews build(Context context, int id) {
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.widget_worktime);
        boolean enabled = WidgetStore.isEnabled(context);
        String state = WidgetStore.state(context);
        String start = WidgetStore.started(context);
        String startLabel = "";
        try {
            if (!start.isEmpty()) startLabel = " • " + DateTimeFormatter.ofPattern("HH:mm")
               .withZone(ZoneId.systemDefault()).format(Instant.parse(start));
        } catch (Exception ignored) {}
        String label;
        String primary;
        String action;
        if (!enabled) {
            label = "Ativa o widget nas Opções";
            primary = "Abrir aplicação";
            action = "";
        } else if ("paused".equals(state)) {
            label = "Em pausa" + startLabel;
            primary = "▶ Retomar";
            action = ACTION_RESUME;
        } else if ("working".equals(state)) {
            label = "Turno em curso" + startLabel;
            primary = "Ⅱ Pausa";
            action = ACTION_PAUSE;
        } else {
            label = "Pronto para começar";
            primary = "▶ Iniciar turno";
            action = ACTION_START;
        }

        view.setTextViewText(R.id.widget_status, label);
        view.setTextViewText(R.id.widget_primary, primary);
        view.setViewVisibility(R.id.widget_finish,
            enabled && !"idle".equals(state) ? View.VISIBLE : View.GONE);
        if (!action.isEmpty()) {
            int code = ACTION_START.equals(action) ? 1 : (ACTION_PAUSE.equals(action) ? 2 : 3);
            view.setOnClickPendingIntent(R.id.widget_primary, pending(context,id,action,code));
        } else {
            view.setOnClickPendingIntent(R.id.widget_primary, launch(context,id));
        }
        view.setOnClickPendingIntent(R.id.widget_finish,pending(context,id,ACTION_FINISH,4));
        view.setOnClickPendingIntent(R.id.widget_title,launch(context,id));
        return view;
    }

    private static PendingIntent launch(Context context,int id) {
        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context,id+20000,launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName component = new ComponentName(context,WorkTimeWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(component);
        for (int id:ids) manager.updateAppWidget(id,build(context,id));
    }
}
