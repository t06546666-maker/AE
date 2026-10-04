package com.affiliateae.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.installations.FirebaseInstallations;
import com.google.firebase.installations.InstallationTokenResult;
import com.google.android.gms.tasks.Task;
import java.util.Map;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) return;
        final Task<String> installationId = FirebaseInstallations.getInstance().getId();
        final Task<InstallationTokenResult> installationAuth = FirebaseInstallations.getInstance().getToken(false);
        traceTask("Installation ID", installationId);
        traceTask("Installation auth", installationAuth);
        Log.i("AEPushTrace", "Requesting native FCM token (token value never logged)");
        final com.google.android.gms.tasks.Task<String> task = FirebaseMessaging.getInstance().getToken();
        task.addOnCompleteListener(result -> {
            if (result.isSuccessful()) Log.i("AEPushTrace", "FCM token generated successfully");
            else Log.e("AEPushTrace", "FCM token request failed", result.getException());
        });
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Log.i("AEPushTrace", "FCM complete after 30s: " + task.isComplete());
            Log.i("AEPushTrace", "Installation ID complete after 30s: " + installationId.isComplete());
            Log.i("AEPushTrace", "Installation auth complete after 30s: " + installationAuth.isComplete());
            if (task.isComplete()) return;
            for (Map.Entry<Thread, StackTraceElement[]> entry : Thread.getAllStackTraces().entrySet()) {
                String name = entry.getKey().getName();
                boolean relevant = name.toLowerCase().contains("firebase");
                for (StackTraceElement frame : entry.getValue()) {
                    if (frame.getClassName().contains("com.google.firebase")) relevant = true;
                }
                if (!relevant) continue;
                Log.i("AEPushTrace", name + " state=" + entry.getKey().getState());
                for (StackTraceElement frame : entry.getValue()) Log.i("AEPushTrace", "  " + frame);
            }
        }, 30000);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Log.i("AEPushTrace", "90s status: installationId=" + installationId.isComplete()
                + ", installationAuth=" + installationAuth.isComplete() + ", messaging=" + task.isComplete());
        }, 90000);
    }

    private void traceTask(String label, Task<?> task) {
        task.addOnCompleteListener(result -> {
            if (result.isSuccessful()) Log.i("AEPushTrace", label + " succeeded (value withheld)");
            else Log.e("AEPushTrace", label + " failed", result.getException());
        });
    }
}
