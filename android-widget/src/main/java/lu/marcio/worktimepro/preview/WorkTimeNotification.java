package lu.marcio.worktimepro.preview;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** Optional notification for an ongoing shift.
 * It only mirrors the native widget state and does not create any work entries.
 * Actions use the same journaled receiver as the home widget.
 */
public final class WorkTimeNotification {
    private static final String CHANNEL_ID = "worktime_active_shift";
    private static final int NOTIFICATION_ID = 1409;

    private WorkTimeNotification() {}

    public static boolean systemAllowed(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || !manager.areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < 33 ||
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent broadcast(Context context, String action, int requestId) {
        Intent intent = new Intent(context, WorkTimeWidgetProvider.class).setAction(action);
        return PendingIntent.getBroadcast(context, requestId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static synchronized void update(Context context) {
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(manager==null)return;
        if(!WidgetStore.notificationsEnabled(context) || !WidgetStore.isEnabled(context)
             || "idle".equals(WidgetStore.state(context))) {
            manager.cancel(NOTIFICATION_ID);
            return;
        }
        if(!systemAllowed(context))return;

        if(Build.VERSION.SDK_INT>=26) {
            NotificationChannel channel=new NotificationChannel(CHANNEL_ID,
                "WorkTime Pro — Turno em curso", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Mostra o turno ativo e os botões de pausa e saída");
            channel.enableLights(false);
            channel.enableVibration(false);
            manager.createNotificationChannel(channel);
        }
        String state=WidgetStore.state(context);
        boolean paused="paused".equals(state);
        String start=WidgetStore.started(context),time="";
        try {
            if(start!=null && !start.isEmpty())
                time=DateTimeFormatter.ofPattern("HH:mm")
                    .withZone(ZoneId.systemDefault()).format(Instant.parse(start));
        }catch(Exception ignored){}
        Intent open = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent launch=PendingIntent.getActivity(context,1199,open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification.Builder builder=Build.VERSION.SDK_INT>=26 ?
            new Notification.Builder(context,CHANNEL_ID) : new Notification.Builder(context);
        builder.setSmallIcon(android.R.drawable.ic_menu_recent_history)
            .setContentTitle(paused?"WorkTime Pro — Em pausa":"WorkTime Pro — Turno ativo")
            .setContentText(time.isEmpty()?"Abre o ponto para consultar as horas":"Entrada às "+time)
            .setContentIntent(launch)
            .setOngoing(true)
            .setAutoCancel(false)
            .setShowWhen(false)
            .setColor(Color.rgb(61,124,223))
            .addAction(android.R.drawable.ic_media_pause,paused?"Retomar":"Pausa",
                broadcast(context,paused?WorkTimeWidgetProvider.ACTION_RESUME:
                    WorkTimeWidgetProvider.ACTION_PAUSE,1200))
            .addAction(android.R.drawable.ic_menu_save,"Terminar",
                broadcast(context,WorkTimeWidgetProvider.ACTION_FINISH,1201));
        manager.notify(NOTIFICATION_ID,builder.build());
    }
}
