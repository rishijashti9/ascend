package app.ascend.rishi;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Screen time (task 11.7): what the native side needs while ASCEND itself isn't running.
 * The app writes the rules snapshot (src/core/screentime/snapshot.ts) after every change; the
 * service and alarms only read it. Breaks taken from the notification are counted here too
 * (and queued for the app through the widget queue, so they reach the database and sync).
 */
final class ScreenStore {
    private static final String PREFS = "ascend_screen";
    private static final String SNAPSHOT = "snapshot";
    private static final String BREAK_UNTIL = "break_until";
    private static final String BREAK_DAY = "break_day";
    private static final String BREAK_COUNT = "break_count";

    private ScreenStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static synchronized void setSnapshot(Context context, String json) {
        prefs(context).edit().putString(SNAPSHOT, json).apply();
    }

    /** The rules, or null before screen time was ever set up on this phone. */
    static synchronized JSONObject snapshot(Context context) {
        String json = prefs(context).getString(SNAPSHOT, null);
        if (json == null) return null;
        try {
            return new JSONObject(json);
        } catch (JSONException e) {
            return null;
        }
    }

    /** When the current break ends (ms): the later of a break taken here or in the app. */
    static synchronized long breakUntil(Context context, JSONObject snap) {
        long here = prefs(context).getLong(BREAK_UNTIL, 0);
        long app = snap == null ? 0 : snap.optLong("breakUntilMs", 0);
        return Math.max(here, app);
    }

    /** Breaks used on `day` (YYYY-MM-DD): the higher of this phone's count and the app's. */
    static synchronized int breaksOn(Context context, JSONObject snap, String day) {
        int here = day.equals(prefs(context).getString(BREAK_DAY, "")) ? prefs(context).getInt(BREAK_COUNT, 0) : 0;
        int app = snap != null && day.equals(snap.optString("breaksDay")) ? snap.optInt("breaksCount", 0) : 0;
        return Math.max(here, app);
    }

    static synchronized void recordBreak(Context context, String day, int countAfter, long untilMs) {
        prefs(context)
            .edit()
            .putLong(BREAK_UNTIL, untilMs)
            .putString(BREAK_DAY, day)
            .putInt(BREAK_COUNT, countAfter)
            .apply();
    }
}
