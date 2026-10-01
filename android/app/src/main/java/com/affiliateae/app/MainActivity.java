package com.affiliateae.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessaging;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) return;
        Log.i("AEPushTrace", "Requesting native FCM token (token value never logged)");
        final com.google.android.gms.tasks.Task<String> task = FirebaseMessaging.getInstance().getToken();
        task.addOnCompleteListener(result -> {
            if (result.isSuccessful()) Log.i("AEPushTrace", "FCM token generated successfully");
            else Log.e("AEPushTrace", "FCM token request failed", result.getException());
        });
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Log.i("AEPushTrace", "FCM complete after 30s: " + task.isComplete());
            if (task.isComplete()) return;
            for (Map.Entry<Thread, StackTraceElement[]> entry : Thread.getAllStackTraces().entrySet()) {
                String name = entry.getKey().getName();
                if (!name.toLowerCase().contains("firebase")) continue;
                Log.i("AEPushTrace", name + " state=" + entry.getKey().getState());
                for (StackTraceElement frame : entry.getValue()) Log.i("AEPushTrace", "  " + frame);
            }
        }, 30000);
    }
}
