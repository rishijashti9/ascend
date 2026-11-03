package app.ascend.rishi;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

/**
 * No background checking (task 11.7, SPEC 6.8): while no reminder case is active, ASCEND only
 * sets ONE alarm — at the wind-down time, or at the earliest moment the remaining allowance could
 * run out (it only runs out while entertainment is on screen), whichever comes first. When it
 * fires, this looks again: a case applies → the service starts; otherwise the next alarm is set.
 */
final class ScreenScheduler {
    private ScreenScheduler() {}

    private static PendingIntent alarmIntent(Context context) {
        Intent i = new Intent(context, ScreenReceiver.class).setAction(ScreenReceiver.ACTION_ALARM);
        return PendingIntent.getBroadcast(context, 43, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void cancel(Context context) {
        AlarmManager am = context.getSystemService(AlarmManager.class);
        if (am != null) am.cancel(alarmIntent(context));
    }

    static void plan(Context context) {
        JSONObject snap = ScreenStore.snapshot(context);
        if (!ScreenLogic.armedRules(snap) || !UsageReader.hasAccess(context)) {
            cancel(context);
            return;
        }
        long now = System.currentTimeMillis();
        long ent = ScreenLogic.entertainmentSeconds(context, snap, now);
        String c = ScreenLogic.activeCase(context, snap, now, ent);
        if (c != null) {
            cancel(context);
            ScreenTimeService.start(context, c);
            return;
        }
        set(context, ScreenLogic.nextCheck(context, snap, now, ent));
    }

    /** Android didn't let the service start (rare): look again in a minute. */
    static void retrySoon(Context context) {
        set(context, System.currentTimeMillis() + 60_000L);
    }

    private static void set(Context context, long at) {
        AlarmManager am = context.getSystemService(AlarmManager.class);
        if (am == null) return;
        PendingIntent pi = alarmIntent(context);
        boolean exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms();
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
    }
}
