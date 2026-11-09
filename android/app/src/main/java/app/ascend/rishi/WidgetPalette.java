package app.ascend.rishi;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * The widget's colours (Phase 12, task 12A.25): the current theme's palette from the app's
 * snapshot, or the built-in ELEVATE colours (res/values/widget.xml) when there is none. Text
 * colours apply on every Android version; the background and bar tints need Android 12+
 * (older phones keep the built-in background).
 */
final class WidgetPalette {
    final int bg;
    final int text;
    final int muted;
    final int accent;
    final int onAccent;

    private WidgetPalette(int bg, int text, int muted, int accent, int onAccent) {
        this.bg = bg;
        this.text = text;
        this.muted = muted;
        this.accent = accent;
        this.onAccent = onAccent;
    }

    static WidgetPalette from(Context context, JSONObject snap) {
        JSONObject p = snap == null ? null : snap.optJSONObject("palette");
        return new WidgetPalette(
                colour(p, "bg", context.getColor(R.color.widget_bg)),
                colour(p, "text", context.getColor(R.color.widget_text)),
                colour(p, "muted", context.getColor(R.color.widget_muted)),
                colour(p, "accent", context.getColor(R.color.widget_accent)),
                colour(p, "onAccent", context.getColor(R.color.widget_on_accent)));
    }

    private static int colour(JSONObject p, String key, int fallback) {
        if (p == null) return fallback;
        try {
            return Color.parseColor(p.optString(key, ""));
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    /** Colours the fixed parts of the layout (rows are coloured as they are filled). */
    void applyBase(RemoteViews views) {
        views.setTextColor(R.id.level, text);
        views.setTextColor(R.id.day_label, muted);
        views.setTextColor(R.id.xp_label, muted);
        views.setTextColor(R.id.message, text);
        views.setTextColor(R.id.footer, muted);
        views.setTextColor(R.id.focus, onAccent);
        for (int id : new int[] {R.id.title0, R.id.title1, R.id.title2, R.id.title3}) {
            views.setTextColor(id, text);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            views.setColorStateList(R.id.root, "setBackgroundTintList", ColorStateList.valueOf(bg));
            views.setColorStateList(
                    R.id.focus, "setBackgroundTintList", ColorStateList.valueOf(accent));
            views.setColorStateList(
                    R.id.xp_bar, "setProgressTintList", ColorStateList.valueOf(accent));
        }
    }
}
