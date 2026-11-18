package lu.marcio.worktimepro.preview;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.time.Instant;
import java.util.UUID;

/** Native widget events are durable until the WebView confirms their import.
 * A widget must never directly overwrite wt_entries or WebView localStorage.
 */
public final class WidgetStore {
    private static final String PREFS = "worktime_widget_prefs";
    private static final String KEY_EVENTS = "pending_events";
    private static final String KEY_STATE = "shift_state";
    private static final String KEY_STARTED = "shift_started";
    private static final String KEY_ENABLED = "widget_enabled";
    private static final String KEY_NOTIFICATIONS = "notifications_enabled";
    // Persist effective worked time independently of the WebView process.
    // The widget clock advances only while state == "working".
    private static final String KEY_WORKED_MS = "shift_worked_ms";
    private static final String KEY_WORKING_SINCE = "shift_working_since_ms";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static synchronized boolean isEnabled(Context context) {
        return prefs(context).getBoolean(KEY_ENABLED, false);
    }

    public static synchronized boolean notificationsEnabled(Context context) {
        return prefs(context).getBoolean(KEY_NOTIFICATIONS, false);
    }

    public static synchronized void setNotificationsEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_NOTIFICATIONS, enabled).commit();
    }

    public static synchronized String state(Context context) {
        return prefs(context).getString(KEY_STATE, "idle");
    }

    public static synchronized String started(Context context) {
        return prefs(context).getString(KEY_STARTED, "");
    }

    private static long parseStarted(Context context) {
        try { return Instant.parse(started(context)).toEpochMilli(); }
        catch (Exception ignored) { return 0L; }
    }

    private static long elapsedWorkedMillis(Context context, long now) {
        SharedPreferences data = prefs(context);
        long accumulated = data.getLong(KEY_WORKED_MS, -1L);
        if (accumulated < 0) {
            // Upgrade from older widget builds: if still working,
            // assume the old start was continuous until app sync restores pauses.
            long start = parseStarted(context);
            return "working".equals(state(context)) && start > 0
                ? Math.max(0L, now - start) : 0L;
        }
        long elapsed = Math.max(0L, accumulated);
        long since = data.getLong(KEY_WORKING_SINCE, 0L);
        if ("working".equals(state(context)) && since > 0L && now >= since)
            elapsed += now - since;
        return Math.max(0L, elapsed);
    }

    public static synchronized long workedMillis(Context context) {
        return elapsedWorkedMillis(context, System.currentTimeMillis());
    }

    public static synchronized void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(KEY_ENABLED, enabled).commit();
    }

    public static synchronized JSONArray pending(Context context) {
        try { return new JSONArray(prefs(context).getString(KEY_EVENTS, "[]")); }
        catch (JSONException ignored) { return new JSONArray(); }
    }

    public static synchronized boolean record(Context context, String action) {
        if (!isEnabled(context)) return false;
        String previous = state(context);
        String next;
        switch (action) {
            case "start": if (!"idle".equals(previous)) return false; next = "working"; break;
            case "pause": if (!"working".equals(previous)) return false; next = "paused"; break;
            case "resume": if (!"paused".equals(previous)) return false; next = "working"; break;
            case "finish": if ("idle".equals(previous)) return false; next = "idle"; break;
            default: return false;
        }
        JSONArray events = pending(context);
        // Never discard pending work time events when the queue fills.
        if (events.length() >= 512) return false;
        long nowMillis = System.currentTimeMillis();
        String now = Instant.ofEpochMilli(nowMillis).toString();
        long elapsedBeforeAction = elapsedWorkedMillis(context, nowMillis);
        try {
            JSONObject event = new JSONObject();
            event.put("id", UUID.randomUUID().toString());
            event.put("at", now);
            event.put("action", action);
            events.put(event);
            SharedPreferences.Editor edit = prefs(context).edit()
                .putString(KEY_EVENTS, events.toString())
                .putString(KEY_STATE, next);
            if ("start".equals(action)) {
                edit.putString(KEY_STARTED, now);
                edit.putLong(KEY_WORKED_MS, 0L);
                edit.putLong(KEY_WORKING_SINCE, nowMillis);
            } else if ("pause".equals(action)) {
                edit.putLong(KEY_WORKED_MS, elapsedBeforeAction);
                edit.remove(KEY_WORKING_SINCE);
            } else if ("resume".equals(action)) {
                edit.putLong(KEY_WORKED_MS, elapsedBeforeAction);
                edit.putLong(KEY_WORKING_SINCE, nowMillis);
            } else if ("finish".equals(action)) {
                edit.remove(KEY_STARTED);
                edit.remove(KEY_WORKED_MS);
                edit.remove(KEY_WORKING_SINCE);
            }
            boolean saved = edit.commit();
            if (saved) WorkTimeNotification.update(context);
            return saved;
        } catch (JSONException ignored) { return false; }
    }

    public static synchronized void acknowledge(Context context, String throughId) {
        if (throughId == null || throughId.isEmpty()) return;
        JSONArray before = pending(context);
        int lastIndex = -1;
        for (int i = 0; i < before.length(); i++) {
            if (throughId.equals(before.optJSONObject(i) != null ?
                 before.optJSONObject(i).optString("id") : "")) lastIndex = i;
        }
        if (lastIndex < 0) return;
        JSONArray rest = new JSONArray();
        for (int i = lastIndex + 1; i < before.length(); i++) rest.put(before.opt(i));
        prefs(context).edit().putString(KEY_EVENTS, rest.toString()).commit();
    }

    public static synchronized void setState(Context context, String state, String started,
                                              long workedMillis) {
        if (pending(context).length() > 0) return; // Native actions must be replayed first.
        if (!"idle".equals(state) && !"working".equals(state) && !"paused".equals(state)) return;
        SharedPreferences.Editor edit = prefs(context).edit().putString(KEY_STATE, state);
        if ("idle".equals(state) || started == null || started.isEmpty()) {
            edit.remove(KEY_STARTED);
            edit.remove(KEY_WORKED_MS);
            edit.remove(KEY_WORKING_SINCE);
        } else {
            edit.putString(KEY_STARTED, started);
            edit.putLong(KEY_WORKED_MS, Math.max(0L, workedMillis));
            if ("working".equals(state))
                edit.putLong(KEY_WORKING_SINCE, System.currentTimeMillis());
            else
                edit.remove(KEY_WORKING_SINCE);
        }
        edit.commit();
    }
}
