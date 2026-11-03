package app.ascend.rishi;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Process;

import java.util.HashMap;
import java.util.Map;

/**
 * Reads Android's usage events (task 11.6). Only how long each app was in front is computed —
 * never anything about what happened inside it. Needs "Usage access" (granted by Rishi in
 * Settings; ASCEND can only open that screen).
 */
final class UsageReader {
    /** How far back to look for an app that was already open when the range starts. */
    private static final long LOOKBACK_MS = 3 * 60 * 60 * 1000L;

    private UsageReader() {}

    @SuppressWarnings("deprecation")
    static boolean hasAccess(Context context) {
        AppOpsManager ops = (AppOpsManager) context.getSystemService(Context.APP_OPS_SERVICE);
        if (ops == null) return false;
        String op = AppOpsManager.OPSTR_GET_USAGE_STATS;
        int uid = Process.myUid();
        String pkg = context.getPackageName();
        int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ops.unsafeCheckOpNoThrow(op, uid, pkg)
            : ops.checkOpNoThrow(op, uid, pkg);
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    /** Milliseconds each app was in the foreground between `start` and `end`. */
    static Map<String, Long> foregroundMs(Context context, long start, long end) {
        Map<String, Long> totals = new HashMap<>();
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null || end <= start) return totals;
        UsageEvents events = usm.queryEvents(start - LOOKBACK_MS, end);
        if (events == null) return totals;
        Map<String, Long> openSince = new HashMap<>();
        UsageEvents.Event e = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            String pkg = e.getPackageName();
            long t = e.getTimeStamp();
            int type = e.getEventType();
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                if (!openSince.containsKey(pkg)) openSince.put(pkg, t);
            } else if (type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED) {
                Long since = openSince.remove(pkg);
                if (since != null) add(totals, pkg, since, t, start, end);
            } else if (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE || type == UsageEvents.Event.DEVICE_SHUTDOWN) {
                for (Map.Entry<String, Long> open : openSince.entrySet()) add(totals, open.getKey(), open.getValue(), t, start, end);
                openSince.clear();
            }
        }
        for (Map.Entry<String, Long> open : openSince.entrySet()) add(totals, open.getKey(), open.getValue(), end, start, end);
        return totals;
    }

    private static void add(Map<String, Long> totals, String pkg, long from, long to, long start, long end) {
        long a = Math.max(from, start);
        long b = Math.min(to, end);
        if (b > a) {
            Long old = totals.get(pkg);
            totals.put(pkg, (old == null ? 0 : old) + (b - a));
        }
    }

    /** The app in front right now, or null (screen off, or nothing known). */
    static String foregroundNow(Context context, long now) {
        UsageStatsManager usm = (UsageStatsManager) context.getSystemService(Context.USAGE_STATS_SERVICE);
        if (usm == null) return null;
        UsageEvents events = usm.queryEvents(now - LOOKBACK_MS, now);
        if (events == null) return null;
        String current = null;
        UsageEvents.Event e = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            int type = e.getEventType();
            if (type == UsageEvents.Event.ACTIVITY_RESUMED) {
                current = e.getPackageName();
            } else if ((type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED)
                && e.getPackageName().equals(current)) {
                current = null;
            } else if (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                current = null;
            }
        }
        return current;
    }

    static String label(Context context, String pkg) {
        try {
            PackageManager pm = context.getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            return String.valueOf(pm.getApplicationLabel(info));
        } catch (PackageManager.NameNotFoundException e) {
            return pkg;
        }
    }

    /** Apps Android marks as games count as entertainment (SPEC 6.8). */
    @SuppressWarnings("deprecation")
    static boolean isGame(Context context, String pkg) {
        try {
            ApplicationInfo info = context.getPackageManager().getApplicationInfo(pkg, 0);
            return info.category == ApplicationInfo.CATEGORY_GAME || (info.flags & ApplicationInfo.FLAG_IS_GAME) != 0;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
}
