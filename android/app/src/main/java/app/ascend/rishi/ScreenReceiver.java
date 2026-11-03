package app.ascend.rishi;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import org.json.JSONObject;

/**
 * Screen-time alarms, the "I'm on a break" button, and re-planning after a restart (task 11.7).
 */
public class ScreenReceiver extends BroadcastReceiver {
    static final String ACTION_ALARM = "app.ascend.rishi.SCREEN_ALARM";
    static final String ACTION_BREAK = "app.ascend.rishi.SCREEN_BREAK";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (ACTION_BREAK.equals(action)) {
            takeBreak(context);
            return;
        }
        // The alarm, a restart, or an app update: look again.
        ScreenScheduler.plan(context);
    }

    /** Pauses reminders for 20 minutes (max 2 a day) and tells the app (widget queue). */
    private static void takeBreak(Context context) {
        JSONObject snap = ScreenStore.snapshot(context);
        if (snap == null) return;
        long now = System.currentTimeMillis();
        String day = ScreenLogic.dayString(snap, now);
        int used = ScreenStore.breaksOn(context, snap, day);
        if (used >= ScreenLogic.MAX_BREAKS) return;
        ScreenStore.recordBreak(context, day, used + 1, now + ScreenLogic.BREAK_MS);
        WidgetStore.addAction(context, "screen.takeBreak", new JSONObject());
        ScreenNotifications.clearReminder(context);
        context.stopService(new Intent(context, ScreenTimeService.class));
        ScreenScheduler.plan(context);
    }
}
