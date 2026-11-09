package app.ascend.rishi;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Home-screen widget (SPEC 6.4, task 10.2). It only draws the app's today snapshot: level,
 * XP bar, streak and up to four of today's quests. Tapping a "check" quest (or "I'm up")
 * queues the action with its real tap time and shows it done at once; the app counts it the
 * next time it opens. Quests that need a number open the app. A snapshot from an earlier day
 * shows "Open ASCEND to start today" instead of stale quests. Colours follow the app's theme
 * (WidgetPalette, Phase 12).
 */
public abstract class AscendWidget extends AppWidgetProvider {
    static final String ACTION_TAP = "app.ascend.rishi.WIDGET_TAP";
    static final String EXTRA_TYPE = "type";
    static final String EXTRA_INSTANCE = "instanceId";

    private static final int[] ROWS = {R.id.row0, R.id.row1, R.id.row2, R.id.row3};
    private static final int[] TITLES = {R.id.title0, R.id.title1, R.id.title2, R.id.title3};
    private static final int[] ACTIONS = {R.id.action0, R.id.action1, R.id.action2, R.id.action3};

    /** The medium widget adds a "Start focus" button. */
    abstract boolean showFocus();

    /** Quest rows (44 dp each, task 10.5): 2 on the small widget, 4 on the medium one. */
    int maxRows() {
        return showFocus() ? 4 : 2;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_TAP.equals(intent.getAction())) {
            String type = intent.getStringExtra(EXTRA_TYPE);
            String instance = intent.getStringExtra(EXTRA_INSTANCE);
            if (type != null && instance != null) {
                WidgetStore.addTap(context, type, instance);
                refreshAll(context);
            }
            return;
        }
        super.onReceive(context, intent);
    }

    /** Redraws every ASCEND widget (after the app writes a new snapshot, or after a tap). */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        Class<?>[] kinds = {AscendWidgetSmall.class, AscendWidgetMedium.class};
        for (Class<?> kind : kinds) {
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, kind));
            if (ids.length == 0) continue;
            Intent update = new Intent(context, kind);
            update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(update);
        }
    }

    private RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_ascend);
        PendingIntent open = openApp(context, null, widgetId);
        views.setOnClickPendingIntent(R.id.header, open);
        views.setOnClickPendingIntent(R.id.message, open);
        views.setViewVisibility(R.id.focus, showFocus() ? View.VISIBLE : View.GONE);
        if (showFocus()) {
            views.setOnClickPendingIntent(R.id.focus, openApp(context, "focus", widgetId));
        }

        JSONObject snap = WidgetStore.snapshot(context);
        WidgetPalette palette = WidgetPalette.from(context, snap);
        palette.applyBase(views);
        long now = System.currentTimeMillis();
        if (snap == null) {
            return message(views, "Level —", "Open ASCEND once to set up the widget.");
        }
        views.setTextViewText(R.id.level, "Level " + snap.optInt("level"));
        views.setTextViewText(R.id.day_label, snap.optString("dayLabel"));
        views.setProgressBar(R.id.xp_bar, 100, snap.optInt("progress"), false);
        int streak = snap.optInt("streak");
        views.setTextViewText(
                R.id.xp_label,
                snap.optString("xpLabel") + (streak > 0 ? " · " + streak + "-day streak" : ""));

        if (now >= snap.optLong("validUntil")) {
            return message(views, null, "Open ASCEND to start today.");
        }
        JSONArray quests = snap.optJSONArray("quests");
        int count = quests == null ? 0 : quests.length();
        if (count == 0) return message(views, null, "No quests today.");

        views.setViewVisibility(R.id.message, View.GONE);
        long wakeUntil = snap.optLong("wakeUntil", 0);
        for (int i = 0; i < ROWS.length; i++) {
            JSONObject q = i < count && i < maxRows() ? quests.optJSONObject(i) : null;
            if (q == null) {
                views.setViewVisibility(ROWS[i], View.GONE);
                continue;
            }
            views.setViewVisibility(ROWS[i], View.VISIBLE);
            String id = q.optString("id");
            String kind = q.optString("kind");
            boolean done = q.optBoolean("done");
            views.setTextViewText(TITLES[i], q.optString("title"));
            String label;
            PendingIntent click;
            if (done) {
                label = "✓ " + q.optString("detail", "Done");
                click = open;
            } else if ("check".equals(kind)) {
                label = "Done?";
                click = tap(context, "quest.complete", id, widgetId, i);
            } else if ("wake".equals(kind) && wakeUntil > 0 && now <= wakeUntil) {
                label = "I'm up";
                click = tap(context, "quest.wakeCheckin", id, widgetId, i);
            } else if ("wake".equals(kind)) {
                label = "Closed";
                click = open;
            } else {
                label = q.optString("detail");
                click = open;
            }
            views.setTextViewText(ACTIONS[i], label);
            views.setTextColor(
                    ACTIONS[i],
                    done || "open".equals(kind) || "Closed".equals(label)
                            ? palette.muted
                            : palette.accent);
            views.setOnClickPendingIntent(ROWS[i], click);
        }
        views.setTextViewText(
                R.id.footer, snap.optInt("doneCount") + " / " + snap.optInt("total") + " done");
        views.setViewVisibility(R.id.footer, View.VISIBLE);
        return views;
    }

    private RemoteViews message(RemoteViews views, String level, String text) {
        if (level != null) views.setTextViewText(R.id.level, level);
        views.setTextViewText(R.id.message, text);
        views.setViewVisibility(R.id.message, View.VISIBLE);
        for (int row : ROWS) views.setViewVisibility(row, View.GONE);
        views.setViewVisibility(R.id.footer, View.GONE);
        return views;
    }

    private PendingIntent tap(Context context, String type, String instance, int widgetId, int row) {
        Intent intent = new Intent(context, getClass());
        intent.setAction(ACTION_TAP);
        intent.putExtra(EXTRA_TYPE, type);
        intent.putExtra(EXTRA_INSTANCE, instance);
        // A distinct data URI keeps each row's intent separate.
        intent.setData(Uri.parse("ascend-widget://tap/" + widgetId + "/" + row + "/" + instance));
        return PendingIntent.getBroadcast(
                context, widgetId * 10 + row, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private PendingIntent openApp(Context context, String path, int widgetId) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (path != null) {
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("app.ascend.rishi://open/" + path));
        }
        return PendingIntent.getActivity(
                context, widgetId * 10 + (path == null ? 8 : 9), intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
