package com.affiliateae.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FieldLocationService")
public class FieldLocationServicePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        String accessToken = call.getString("accessToken", "");
        String refreshToken = call.getString("refreshToken", "");
        if (accessToken.isEmpty() || refreshToken.isEmpty()) {
            call.reject("Please sign in again before starting workday sharing.");
            return;
        }
        if (!hasLocationPermission()) {
            call.reject("Allow location access before starting workday sharing.", "LOCATION_PERMISSION_REQUIRED");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Set AE location access to Allow all the time, then return and start sharing.", "BACKGROUND_LOCATION_PERMISSION_REQUIRED");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Allow notifications so Android can show the active location-sharing indicator.", "NOTIFICATION_PERMISSION_REQUIRED");
            return;
        }

        Intent intent = new Intent(getContext(), FieldLocationForegroundService.class);
        intent.setAction(FieldLocationForegroundService.ACTION_START);
        intent.putExtra(FieldLocationForegroundService.EXTRA_ACCESS_TOKEN, accessToken);
        intent.putExtra(FieldLocationForegroundService.EXTRA_REFRESH_TOKEN, refreshToken);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            JSObject result = new JSObject();
            result.put("running", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Could not start workday location sharing. Please keep AE open and try again.", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), FieldLocationForegroundService.class);
        intent.setAction(FieldLocationForegroundService.ACTION_STOP);
        getContext().startService(intent);
        JSObject result = new JSObject();
        result.put("running", false);
        call.resolve(result);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", getContext().getSharedPreferences(FieldLocationForegroundService.PREFS, 0)
                .getBoolean(FieldLocationForegroundService.PREF_RUNNING, false));
        call.resolve(result);
    }

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
}
