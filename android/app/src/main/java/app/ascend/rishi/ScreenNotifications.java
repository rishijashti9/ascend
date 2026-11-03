package app.ascend.rishi;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Screen-time notifications (task 11.7) — on their own channels, separate from the wake-up and
 * the other reminders (SPEC 6.8):
 * - "Screen time reminders" (high): the one reminder, updated in place every minute.
 * - "Screen time running" (low, silent): the foreground service's required notification.
 */
final class ScreenNotifications {
    static final String REMINDER_CHANNEL = "screen_time";
    static final String SERVICE_CHANNEL = "screen_time_service";
    static final int REMINDER_ID = 4101;
    static final int SERVICE_ID = 4102;

    private ScreenNotifications() {}

    static void ensureChannels(Context context) {
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(REMINDER_CHANNEL) == null) {
            NotificationChannel c = new NotificationChannel(REMINDER_CHANNEL, "Screen time reminders", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("A calm reminder when you're past your entertainment limit or it's wind-down time. Never blocks anything.");
            c.enableVibration(true);
            nm.createNotificationChannel(c);
        }
        if (nm.getNotificationChannel(SERVICE_CHANNEL) == null) {
            NotificationChannel s = new NotificationChannel(SERVICE_CHANNEL, "Screen time running", NotificationManager.IMPORTANCE_MIN);
            s.setDescription("Shown only while a screen-time reminder is active (Android requires it).");
            s.setShowBadge(false);
            nm.createNotificationChannel(s);
        }
    }

    /** ASCEND's notifications are allowed at all. */
    static boolean notificationsEnabled(Context context) {
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    /** The screen-time reminder channel isn't switched off in system settings. */
    static boolean channelEnabled(Context context) {
        ensureChannels(context);
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return false;
        NotificationChannel c = nm.getNotificationChannel(REMINDER_CHANNEL);
        return c != null && c.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private static PendingIntent openFocus(Context context) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("app.ascend.rishi://open/focus"));
        i.setPackage(context.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, 41, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent takeBreak(Context context) {
        Intent i = new Intent(context, ScreenReceiver.class).setAction(ScreenReceiver.ACTION_BREAK);
        return PendingIntent.getBroadcast(context, 42, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Shows or updates the one reminder. `silent` in quiet hours (no sound or vibration). */
    static void showReminder(Context context, String title, String body, boolean silent, boolean breakLeft) {
        ensureChannels(context);
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, REMINDER_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_ascend)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOnlyAlertOnce(false)
            .setSilent(silent)
            .setAutoCancel(false)
            .setContentIntent(openFocus(context))
            .addAction(0, "Start focus", openFocus(context));
        if (breakLeft) b.addAction(0, "I'm on a break", takeBreak(context));
        try {
            NotificationManagerCompat.from(context).notify(REMINDER_ID, b.build());
        } catch (SecurityException ignored) {
            // Notifications not allowed: the app shows the banner (integrity check) instead.
        }
    }

    static void clearReminder(Context context) {
        NotificationManagerCompat.from(context).cancel(REMINDER_ID);
    }

    /** The service's own quiet notification, e.g. "ASCEND: wind-down time". */
    static Notification serviceNotification(Context context, String c) {
        ensureChannels(context);
        String text = ScreenLogic.OVER_LIMIT.equals(c) ? "ASCEND: past today's entertainment limit" : "ASCEND: wind-down time";
        return new NotificationCompat.Builder(context, SERVICE_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_ascend)
            .setContentTitle(text)
            .setContentText("Screen-time reminders are on until this ends.")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(openFocus(context))
            .build();
    }
}
