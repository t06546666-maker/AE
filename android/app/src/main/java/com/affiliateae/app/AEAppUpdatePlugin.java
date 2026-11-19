package com.affiliateae.app;

import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AEAppUpdate")
public class AEAppUpdatePlugin extends Plugin {
    @PluginMethod
    public void openStore(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            String appId = getContext().getPackageName();
            try {
                Intent store = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + appId));
                store.setPackage("com.android.vending");
                getActivity().startActivity(store);
                call.resolve();
            } catch (ActivityNotFoundException noPlayStore) {
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=" + appId)));
                    call.resolve();
                } catch (Exception unavailable) {
                    call.reject("Unable to open Google Play.");
                }
            } catch (Exception unavailable) {
                call.reject("Unable to open Google Play.");
            }
        });
    }
}
