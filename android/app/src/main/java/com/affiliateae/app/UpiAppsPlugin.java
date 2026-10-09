package com.affiliateae.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "UpiApps")
public class UpiAppsPlugin extends Plugin {
    private static final String[] PACKAGES = {"com.google.android.apps.nbu.paisa.user", "com.phonepe.app", "net.one97.paytm", "in.org.npci.upiapp"};
    private static final String[] NAMES = {"Google Pay", "PhonePe", "Paytm", "BHIM"};
    @PluginMethod public void list(PluginCall call) {
        JSArray apps = new JSArray();
        for (int i = 0; i < PACKAGES.length; i++) {
            if (getContext().getPackageManager().getLaunchIntentForPackage(PACKAGES[i]) != null) {
                JSObject app = new JSObject(); app.put("id", PACKAGES[i]); app.put("name", NAMES[i]); apps.put(app);
            }
        }
        JSObject result = new JSObject(); result.put("apps", apps); call.resolve(result);
    }
    @PluginMethod public void open(PluginCall call) {
        String id = call.getString("id", "");
        boolean allowed = false; for (String pkg : PACKAGES) if (pkg.equals(id)) allowed = true;
        if (!allowed) { call.reject("Unsupported app"); return; }
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(id);
        if (intent == null) { call.reject("App is not installed"); return; }
        try { getActivity().startActivity(intent); call.resolve(); }
        catch (Exception e) { call.reject("Could not open UPI app"); }
    }
}
