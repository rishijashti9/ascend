package app.ascend.rishi;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The reminder rules on the phone (task 11.7) — the same rules as src/core/screentime/reminders.ts
 * (keep both in step; the TypeScript side is the one with the tests). Only entertainment apps,
 * only over the daily limit or after the wind-down time; YouTube doesn't count during focus.
 */
final class ScreenLogic {
    static final long REALERT_MS = 60_000L;
    static final long BREAK_MS = 20 * 60_000L;
    static final int MAX_BREAKS = 2;

    static final String OVER_LIMIT = "over_limit";
    static final String WIND_DOWN = "wind_down";

    private ScreenLogic() {}

    static ZoneId zone(JSONObject snap) {
        try {
            return ZoneId.of(snap.optString("tz", ZoneId.systemDefault().getId()));
        } catch (Exception e) {
            return ZoneId.systemDefault();
        }
    }

    /** Start of the ASCEND day containing `now` (the day-start hour, e.g. 03:00). */
    static long dayStart(JSONObject snap, long now) {
        ZoneId z = zone(snap);
        int startHour = snap.optInt("dayStartHour", 3);
        ZonedDateTime t = Instant.ofEpochMilli(now).atZone(z);
        LocalDate date = t.getHour() < startHour ? t.toLocalDate().minusDays(1) : t.toLocalDate();
        return date.atTime(startHour, 0).atZone(z).toInstant().toEpochMilli();
    }

    static String dayString(JSONObject snap, long now) {
        return Instant.ofEpochMilli(dayStart(snap, now)).atZone(zone(snap)).toLocalDate().toString();
    }

    private static int minutes(String hhmm) {
        String[] p = hhmm.split(":");
        return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
    }

    private static int localMinutes(JSONObject snap, long now) {
        ZonedDateTime t = Instant.ofEpochMilli(now).atZone(zone(snap));
        return t.getHour() * 60 + t.getMinute();
    }

    static boolean inWindow(int m, int start, int end) {
        return start <= end ? m >= start && m < end : m >= start || m < end;
    }

    static boolean isWindDown(JSONObject snap, long now) {
        return inWindow(localMinutes(snap, now), minutes(snap.optString("windDown", "21:00")), snap.optInt("dayStartHour", 3) * 60);
    }

    static boolean inQuietHours(JSONObject snap, long now) {
        JSONObject q = snap.optJSONObject("quiet");
        if (q == null) return false;
        return inWindow(localMinutes(snap, now), minutes(q.optString("start", "22:00")), minutes(q.optString("end", "05:00")));
    }

    /** When today's wind-down starts (ms). */
    static long windDownStart(JSONObject snap, long now) {
        ZoneId z = zone(snap);
        LocalDate date = Instant.ofEpochMilli(dayStart(snap, now)).atZone(z).toLocalDate();
        LocalTime wd = LocalTime.of(minutes(snap.optString("windDown", "21:00")) / 60, minutes(snap.optString("windDown", "21:00")) % 60);
        long t = date.atTime(wd).atZone(z).toInstant().toEpochMilli();
        // A wind-down before the day-start hour (e.g. 01:00) belongs to the next calendar day.
        return t < dayStart(snap, now) ? t + 24 * 3_600_000L : t;
    }

    /** Reminders can run at all: switched on, reminders on, and the limit set (observe week over). */
    static boolean armedRules(JSONObject snap) {
        return snap != null && snap.optBoolean("enabled") && snap.optBoolean("remindersOn") && !snap.isNull("limitMin") && snap.has("limitMin");
    }

    static boolean focusActive(JSONObject snap, long now) {
        return now < snap.optLong("focusUntilMs", 0);
    }

    static Set<String> set(JSONArray a) {
        Set<String> out = new HashSet<>();
        for (int i = 0; a != null && i < a.length(); i++) out.add(a.optString(i));
        return out;
    }

    static boolean isEntertainment(Context context, JSONObject snap, String pkg) {
        if (pkg == null) return false;
        if (set(snap.optJSONArray("removed")).contains(pkg)) return false;
        if (set(snap.optJSONArray("packages")).contains(pkg)) return true;
        String label = UsageReader.label(context, pkg).trim().toLowerCase(Locale.ROOT);
        return set(snap.optJSONArray("labels")).contains(label) || UsageReader.isGame(context, pkg);
    }

    static boolean isYouTube(JSONObject snap, String pkg) {
        return set(snap.optJSONArray("youtube")).contains(pkg);
    }

    /** Today's entertainment seconds, computed on the phone from usage events. */
    static long entertainmentSeconds(Context context, JSONObject snap, long now) {
        Map<String, Long> totals = UsageReader.foregroundMs(context, dayStart(snap, now), now);
        long focusFrom = snap.optLong("focusStartMs", 0);
        long focusUntil = Math.min(now, snap.optLong("focusUntilMs", 0));
        Map<String, Long> inFocus = focusUntil > focusFrom && focusFrom > 0
            ? UsageReader.foregroundMs(context, Math.max(focusFrom, dayStart(snap, now)), focusUntil)
            : null;
        long ms = 0;
        for (Map.Entry<String, Long> e : totals.entrySet()) {
            if (!isEntertainment(context, snap, e.getKey())) continue;
            long v = e.getValue();
            if (inFocus != null && isYouTube(snap, e.getKey())) {
                Long f = inFocus.get(e.getKey());
                v = Math.max(0, v - (f == null ? 0 : f));
            }
            ms += v;
        }
        // Earlier focus sessions today (sent by the app) also don't count for YouTube.
        ms -= Math.min(ms, snap.optLong("youtubeFocusSec", 0) * 1000L);
        return ms / 1000L;
    }

    /** Which reminder case applies now (null = none). Over the limit wins. */
    static String activeCase(Context context, JSONObject snap, long now, long entertainmentSec) {
        if (!armedRules(snap)) return null;
        if (now < ScreenStore.breakUntil(context, snap)) return null;
        if (entertainmentSec >= snap.optLong("limitMin") * 60L) return OVER_LIMIT;
        if (isWindDown(snap, now)) return WIND_DOWN;
        return null;
    }

    /** When to look again while no case is active (earliest the limit could be reached, or wind-down). */
    static long nextCheck(Context context, JSONObject snap, long now, long entertainmentSec) {
        long next = Long.MAX_VALUE;
        long breakUntil = ScreenStore.breakUntil(context, snap);
        if (breakUntil > now) next = Math.min(next, breakUntil);
        long wind = windDownStart(snap, now);
        if (wind > now) next = Math.min(next, wind);
        long remainingMs = (snap.optLong("limitMin") * 60L - entertainmentSec) * 1000L;
        if (remainingMs > 0) next = Math.min(next, now + remainingMs);
        // A new day starts a fresh allowance and a new wind-down evening.
        long nextDay = dayStart(snap, now) + 24 * 3_600_000L;
        next = Math.min(next, nextDay + 60_000L);
        return next;
    }

    static String minutesText(long min) {
        if (min < 60) return min + " min";
        return (min / 60) + "h " + String.format(Locale.ROOT, "%02d", min % 60) + "m";
    }

    /** Calm, never shaming — the same words as reminderText() in reminders.ts. */
    static String[] text(String c, String app, boolean first, long stretchMin, long overMin, String windDown) {
        if (OVER_LIMIT.equals(c)) {
            if (first) return new String[] { "You’ve reached today’s entertainment limit", app + " is still open. A good moment to switch to something else?" };
            return new String[] { minutesText(stretchMin) + " on " + app, minutesText(overMin) + " past today’s limit. Ready to switch?" };
        }
        if (first) return new String[] { "It’s wind-down time", "It’s past " + windDown + ". Putting " + app + " away now protects tomorrow’s early start." };
        return new String[] { minutesText(stretchMin) + " on " + app, "Wind-down started at " + windDown + ". Sleep is what makes the morning easy." };
    }
}
