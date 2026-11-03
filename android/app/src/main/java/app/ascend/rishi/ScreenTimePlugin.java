package app.ascend.rishi;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;

/**
 * Screen time (tasks 11.6–11.8). JS: src/app/screenTime.ts. Only daily totals per app leave this
 * plugin — never what happened inside an app.
 */
@CapacitorPlugin(name = "ScreenTime")
public class ScreenTimePlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("usageAccess", UsageReader.hasAccess(getContext()));
        r.put("notifications", ScreenNotifications.notificationsEnabled(getContext()));
        r.put("channel", ScreenNotifications.channelEnabled(getContext()));
        call.resolve(r);
    }

    /** Opens Android's "Usage access" screen (ASCEND can't grant it itself). */
    @PluginMethod
    public void openUsageAccess(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (ActivityNotFoundException e) {
            // Some phones don't accept the package hint: open the list instead.
            Intent list = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(list);
        }
        call.resolve();
    }

    /** Opens the screen-time channel's settings (to switch it back on). */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        ScreenNotifications.ensureChannels(getContext());
        boolean appOn = ScreenNotifications.notificationsEnabled(getContext());
        Intent i = appOn
            ? new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_CHANNEL_ID, ScreenNotifications.REMINDER_CHANNEL)
            : new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Seconds per app in the foreground between `start` and `end` (ms), with names and games. */
    @PluginMethod
    public void totals(PluginCall call) {
        Long start = call.getLong("start");
        Long end = call.getLong("end");
        if (start == null || end == null) {
            call.reject("start and end are required");
            return;
        }
        if (!UsageReader.hasAccess(getContext())) {
            call.reject("no usage access", "NO_ACCESS");
            return;
        }
        Map<String, Long> ms = UsageReader.foregroundMs(getContext(), start, end);
        JSObject apps = new JSObject();
        JSObject labels = new JSObject();
        JSArray games = new JSArray();
        for (Map.Entry<String, Long> e : ms.entrySet()) {
            long sec = e.getValue() / 1000L;
            if (sec <= 0) continue;
            apps.put(e.getKey(), sec);
            labels.put(e.getKey(), UsageReader.label(getContext(), e.getKey()));
            if (UsageReader.isGame(getContext(), e.getKey())) games.put(e.getKey());
        }
        JSObject r = new JSObject();
        r.put("apps", apps);
        r.put("labels", labels);
        r.put("games", games);
        call.resolve(r);
    }

    /** The rules snapshot for the service and alarms; re-plans right away. */
    @PluginMethod
    public void setRules(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        ScreenStore.setSnapshot(getContext(), json);
        ScreenNotifications.ensureChannels(getContext());
        ScreenScheduler.plan(getContext());
        call.resolve();
    }
}
