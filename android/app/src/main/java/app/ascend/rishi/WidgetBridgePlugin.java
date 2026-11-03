package app.ascend.rishi;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;

/**
 * The app's side of the widgets (task 10.2–10.3): the app writes the today snapshot here after
 * every change, and reads (then clears) the taps queued on a widget. JS: src/app/widgetBridge.ts.
 */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        WidgetStore.setSnapshot(getContext(), json);
        AscendWidget.refreshAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void peekPending(PluginCall call) {
        JSObject result = new JSObject();
        result.put("taps", WidgetStore.pending(getContext()).toString());
        call.resolve(result);
    }

    @PluginMethod
    public void removePending(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null) {
            call.reject("ids is required");
            return;
        }
        try {
            WidgetStore.removePending(getContext(), WidgetStore.toSet(new org.json.JSONArray(ids.toString())));
        } catch (JSONException e) {
            call.reject("ids must be a list of strings");
            return;
        }
        call.resolve();
    }
}
