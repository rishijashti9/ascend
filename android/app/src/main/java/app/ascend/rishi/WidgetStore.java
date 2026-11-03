package app.ascend.rishi;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.UUID;

/**
 * What the home-screen widgets share with the app (task 10.2–10.3), kept in SharedPreferences:
 * the "today snapshot" the app writes, and the queue of taps made on a widget. The widget
 * never touches the app's database — the app runs queued taps through its normal pipeline
 * when it opens or comes back to the front.
 */
final class WidgetStore {
    private static final String PREFS = "ascend_widget";
    private static final String SNAPSHOT = "snapshot";
    private static final String PENDING = "pending";

    private WidgetStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void setSnapshot(Context context, String json) {
        prefs(context).edit().putString(SNAPSHOT, json).apply();
    }

    /** The snapshot, or null if the app hasn't written one yet (or it can't be read). */
    static synchronized JSONObject snapshot(Context context) {
        String json = prefs(context).getString(SNAPSHOT, null);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return null;
        }
    }

    static synchronized JSONArray pending(Context context) {
        try {
            return new JSONArray(prefs(context).getString(PENDING, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    /** Queues a tap with its real time, and marks the quest done in the snapshot right away. */
    static synchronized void addTap(Context context, String type, String instanceId) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("instanceId", instanceId);
            if ("quest.complete".equals(type)) payload.put("version", "full");
            JSONObject tap = new JSONObject();
            tap.put("id", "w-" + UUID.randomUUID());
            tap.put("type", type);
            tap.put("payload", payload);
            tap.put("occurred_at", isoNow());
            JSONArray queue = pending(context);
            queue.put(tap);
            SharedPreferences.Editor edit = prefs(context).edit().putString(PENDING, queue.toString());

            JSONObject snap = snapshot(context);
            if (snap != null) {
                JSONArray quests = snap.optJSONArray("quests");
                int done = snap.optInt("doneCount", 0);
                for (int i = 0; quests != null && i < quests.length(); i++) {
                    JSONObject q = quests.getJSONObject(i);
                    if (instanceId.equals(q.optString("id")) && !q.optBoolean("done")) {
                        q.put("done", true);
                        q.put("detail", "Done");
                        snap.put("doneCount", done + 1);
                    }
                }
                edit.putString(SNAPSHOT, snap.toString());
            }
            edit.apply();
        } catch (JSONException ignored) {
            // A tap that can't be written is simply not queued; the app still works.
        }
    }

    /** Removes taps the app has safely copied into its own database. */
    static synchronized void removePending(Context context, Set<String> ids) {
        JSONArray queue = pending(context);
        JSONArray kept = new JSONArray();
        for (int i = 0; i < queue.length(); i++) {
            JSONObject tap = queue.optJSONObject(i);
            if (tap != null && !ids.contains(tap.optString("id"))) kept.put(tap);
        }
        prefs(context).edit().putString(PENDING, kept.toString()).apply();
    }

    static Set<String> toSet(JSONArray array) {
        Set<String> out = new HashSet<>();
        for (int i = 0; array != null && i < array.length(); i++) out.add(array.optString(i));
        return out;
    }

    private static String isoNow() {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }
}
