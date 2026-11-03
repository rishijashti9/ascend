package app.ascend.rishi;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin for the home-screen widgets (task 10.2).
        registerPlugin(WidgetBridgePlugin.class);
        // Screen time (Phase 11): usage totals, reminder rules, the screen-time channel.
        registerPlugin(ScreenTimePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
