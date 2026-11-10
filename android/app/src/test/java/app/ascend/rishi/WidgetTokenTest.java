package app.ascend.rishi;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Hardening V-09: only widget taps carrying this install's secret are accepted. */
public class WidgetTokenTest {
    private static final String SECRET = "3f9a1c0e5b7d2468ace013579bdf2468ace013579bdf2468ace013579bdf24";

    @Test
    public void theRightTokenMatches() {
        assertTrue(WidgetStore.tokensMatch(SECRET, SECRET));
    }

    @Test
    public void aForgedBroadcastIsRejected() {
        assertFalse(WidgetStore.tokensMatch(SECRET, null)); // no token at all
        assertFalse(WidgetStore.tokensMatch(SECRET, "")); // empty
        assertFalse(WidgetStore.tokensMatch(SECRET, SECRET.substring(1))); // shorter
        assertFalse(WidgetStore.tokensMatch(SECRET, SECRET + "0")); // longer
        assertFalse(WidgetStore.tokensMatch(SECRET, SECRET.replace('3', '4'))); // different
    }

    @Test
    public void aMissingSecretNeverMatches() {
        assertFalse(WidgetStore.tokensMatch(null, null));
        assertFalse(WidgetStore.tokensMatch("", ""));
    }
}
