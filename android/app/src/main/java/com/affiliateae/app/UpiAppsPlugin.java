package com.affiliateae.app;

import android.content.Intent;
import android.net.Uri;
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
        String url = call.getString("url", "");
        if (!url.isEmpty()) {
            try {
                Uri uri = Uri.parse(url);
                String amount = uri.getQueryParameter("am");
                String recipient = uri.getQueryParameter("pa");
                if (!"upi".equals(uri.getScheme()) || !"pay".equals(uri.getHost()) || recipient == null || !recipient.matches("[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}") || !"INR".equals(uri.getQueryParameter("cu")) || amount == null || !amount.matches("[0-9]+\\.[0-9]{2}") || Double.parseDouble(amount)<=0) {
                    call.reject("Invalid UPI payment details"); return;
                }
                boolean allowed = id.isEmpty(); for (String pkg : PACKAGES) if (pkg.equals(id)) allowed = true;
                if (!allowed) { call.reject("Unsupported app"); return; }
                Intent payment = new Intent(Intent.ACTION_VIEW, uri);
                if (!id.isEmpty()) payment.setPackage(id);
                getActivity().startActivity(id.isEmpty() ? Intent.createChooser(payment, "Choose UPI app") : payment);
                call.resolve(); return;
            } catch (Exception e) { call.reject("This UPI app could not open the payment. Try another app."); return; }
        }
        boolean allowed = false; for (String pkg : PACKAGES) if (pkg.equals(id)) allowed = true;
        if (!allowed) { call.reject("Unsupported app"); return; }
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(id);
        if (intent == null) { call.reject("App is not installed"); return; }
        try { getActivity().startActivity(intent); call.resolve(); }
        catch (Exception e) { call.reject("Could not open UPI app"); }
    }
}
