package app.ascend.rishi;

import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

/**
 * The small foreground service (task 11.7, SPEC 6.8) that runs ONLY while a reminder case is
 * active (over the limit, or wind-down). Once a minute it looks at which app is in front; on an
 * entertainment app it shows the reminder (first gently, then updated every minute). It does
 * nothing while the screen is off, and stops itself as soon as no case applies.
 */
public class ScreenTimeService extends Service {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private long stretchStart = 0;
    private long lastAlert = 0;
    private boolean screenOn = true;

    private final Runnable tick = this::check;

    private final BroadcastReceiver screen = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                screenOn = false;
                handler.removeCallbacks(tick);
            } else {
                screenOn = true;
                handler.removeCallbacks(tick);
                handler.post(tick);
            }
        }
    };

    static void start(Context context, String c) {
        Intent i = new Intent(context, ScreenTimeService.class).putExtra("case", c);
        try {
            ContextCompat.startForegroundService(context, i);
        } catch (RuntimeException e) {
            // Android refused to start it from the background; the next alarm tries again.
            ScreenScheduler.retrySoon(context);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_SCREEN_ON);
        f.addAction(Intent.ACTION_USER_PRESENT);
        ContextCompat.registerReceiver(this, screen, f, ContextCompat.RECEIVER_NOT_EXPORTED);
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        screenOn = pm == null || pm.isInteractive();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String c = intent != null ? intent.getStringExtra("case") : null;
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, ScreenNotifications.SERVICE_ID, ScreenNotifications.serviceNotification(this, c), type);
        handler.removeCallbacks(tick);
        if (screenOn) handler.post(tick);
        return START_NOT_STICKY;
    }

    private void check() {
        JSONObject snap = ScreenStore.snapshot(this);
        long now = System.currentTimeMillis();
        if (snap == null || !UsageReader.hasAccess(this)) {
            finish();
            return;
        }
        long ent = ScreenLogic.entertainmentSeconds(this, snap, now);
        String c = ScreenLogic.activeCase(this, snap, now, ent);
        if (c == null) {
            finish();
            return;
        }
        String fg = UsageReader.foregroundNow(this, now);
        boolean onEnt = ScreenLogic.isEntertainment(this, snap, fg)
            && !(ScreenLogic.focusActive(snap, now) && ScreenLogic.isYouTube(snap, fg));
        if (!onEnt) {
            if (stretchStart != 0) ScreenNotifications.clearReminder(this);
            stretchStart = 0;
            lastAlert = 0;
        } else {
            boolean first = stretchStart == 0;
            if (first) stretchStart = now;
            if (first || now - lastAlert >= ScreenLogic.REALERT_MS - 2_000) {
                lastAlert = now;
                long stretchMin = (now - stretchStart) / 60_000L;
                long overMin = Math.max(0, ent / 60 - snap.optLong("limitMin"));
                String[] t = ScreenLogic.text(c, UsageReader.label(this, fg), first, stretchMin, overMin, snap.optString("windDown", "21:00"));
                String day = ScreenLogic.dayString(snap, now);
                boolean breakLeft = ScreenStore.breaksOn(this, snap, day) < ScreenLogic.MAX_BREAKS;
                ScreenNotifications.showReminder(this, t[0], t[1], ScreenLogic.inQuietHours(snap, now), breakLeft);
            }
        }
        handler.postDelayed(tick, ScreenLogic.REALERT_MS);
    }

    private void finish() {
        handler.removeCallbacks(tick);
        ScreenNotifications.clearReminder(this);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
        ScreenScheduler.plan(this);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(tick);
        try {
            unregisterReceiver(screen);
        } catch (IllegalArgumentException ignored) {
            // already unregistered
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
