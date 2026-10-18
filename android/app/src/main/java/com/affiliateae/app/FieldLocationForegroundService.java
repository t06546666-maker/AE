package com.affiliateae.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class FieldLocationForegroundService extends Service implements LocationListener {
    static final String ACTION_START = "com.affiliateae.app.FIELD_LOCATION_START";
    static final String ACTION_STOP = "com.affiliateae.app.FIELD_LOCATION_STOP";
    static final String EXTRA_ACCESS_TOKEN = "accessToken";
    static final String EXTRA_REFRESH_TOKEN = "refreshToken";
    static final String PREFS = "ae_field_location_service";
    static final String PREF_RUNNING = "running";
    private static final String PREF_ACCESS = "access";
    private static final String PREF_REFRESH = "refresh";
    private static final String CHANNEL_ID = "ae_workday_location";
    private static final int NOTIFICATION_ID = 4107;
    private static final String API = "https://www.affiliateae.co.in";
    private static final long UPDATE_MS = 45_000L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private LocationManager locationManager;
    private boolean stopped;
    private long lastSentAt;
    private final Runnable attendanceCheck = new Runnable() {
        @Override public void run() {
            if (stopped) return;
            worker.execute(() -> {
                try {
                    JSONObject status = authorizedRequest("GET", "/api/field/location/status", null);
                    if (!status.optBoolean("active", false)) {
                        pauseOnServer();
                        stopOnMainThread();
                        return;
                    }
                } catch (Exception ignored) {
                    // A temporary network failure does not stop local sampling; retries are bounded to one per minute.
                }
                if (!stopped) handler.postDelayed(attendanceCheck, 60_000L);
            });
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        createNotificationChannel();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopOnMainThread();
            return START_NOT_STICKY;
        }
        if (intent != null && intent.hasExtra(EXTRA_ACCESS_TOKEN)) {
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                    .putString(PREF_ACCESS, intent.getStringExtra(EXTRA_ACCESS_TOKEN))
                    .putString(PREF_REFRESH, intent.getStringExtra(EXTRA_REFRESH_TOKEN))
                    .putBoolean(PREF_RUNNING, true).apply();
        }
        if (getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_ACCESS, null) == null) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        startLocationUpdates();
        handler.removeCallbacks(attendanceCheck);
        handler.post(attendanceCheck);
        return START_STICKY;
    }

    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopOnMainThread();
            return;
        }
        try {
            List<String> providers = locationManager.getProviders(true);
            for (String provider : providers) {
                if (LocationManager.GPS_PROVIDER.equals(provider) || LocationManager.NETWORK_PROVIDER.equals(provider)) {
                    locationManager.requestLocationUpdates(provider, UPDATE_MS, 0f, this, Looper.getMainLooper());
                }
            }
        } catch (SecurityException error) {
            stopOnMainThread();
        }
    }

    @Override public void onLocationChanged(Location location) {
        if (stopped || location == null || location.getTime() <= lastSentAt) return;
        lastSentAt = location.getTime();
        final double latitude = location.getLatitude();
        final double longitude = location.getLongitude();
        final float accuracy = location.hasAccuracy() ? location.getAccuracy() : 0f;
        final long capturedAt = location.getTime();
        worker.execute(() -> {
            try {
                JSONObject status = authorizedRequest("GET", "/api/field/location/status", null);
                if (!status.optBoolean("active", false)) {
                    pauseOnServer();
                    stopOnMainThread();
                    return;
                }
                JSONObject body = new JSONObject();
                body.put("latitude", latitude);
                body.put("longitude", longitude);
                body.put("accuracy_m", accuracy);
                java.text.SimpleDateFormat timestamp = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
                timestamp.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
                body.put("captured_at", timestamp.format(new java.util.Date(capturedAt)));
                authorizedRequest("POST", "/api/field/location", body);
            } catch (Exception ignored) {
                // The next location sample retries; no route history is queued on the device.
            }
        });
    }

    @Override public void onProviderDisabled(String provider) {}
    @Override public void onProviderEnabled(String provider) {}
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}

    private JSONObject authorizedRequest(String method, String path, JSONObject body) throws Exception {
        HttpResult result = request(method, path, body, currentAccessToken());
        if (result.code == HttpURLConnection.HTTP_UNAUTHORIZED) {
            refreshTokens();
            result = request(method, path, body, currentAccessToken());
        }
        if (result.code < 200 || result.code >= 300) throw new Exception("Location request failed");
        return result.body.isEmpty() ? new JSONObject() : new JSONObject(result.body);
    }

    private HttpResult request(String method, String path, JSONObject body, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(API + path).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(12_000);
        connection.setReadTimeout(15_000);
        connection.setRequestProperty("Authorization", "Bearer " + token);
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = connection.getResponseCode();
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        StringBuilder text = new StringBuilder();
        if (stream != null) try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
        }
        connection.disconnect();
        return new HttpResult(code, text.toString());
    }

    private String currentAccessToken() {
        return getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_ACCESS, "");
    }

    private void refreshTokens() throws Exception {
        String refreshToken = getSharedPreferences(PREFS, MODE_PRIVATE).getString(PREF_REFRESH, "");
        JSONObject payload = new JSONObject();
        payload.put("refreshToken", refreshToken);
        payload.put("customer", false);
        HttpResult response = request("POST", "/api/auth/refresh", payload, "");
        if (response.code < 200 || response.code >= 300) throw new Exception("Location session expired");
        JSONObject json = new JSONObject(response.body);
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(PREF_ACCESS, json.getString("accessToken"))
                .putString(PREF_REFRESH, json.optString("refreshToken", refreshToken)).apply();
    }

    private void pauseOnServer() {
        try { authorizedRequest("POST", "/api/field/location/pause", new JSONObject()); }
        catch (Exception ignored) {}
    }

    private void stopOnMainThread() {
        if (Looper.myLooper() == Looper.getMainLooper()) stopSelf();
        else handler.post(this::stopSelf);
    }

    @Override public void onDestroy() {
        stopped = true;
        handler.removeCallbacksAndMessages(null);
        try { locationManager.removeUpdates(this); } catch (SecurityException ignored) {}
        worker.execute(() -> {
            pauseOnServer();
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREF_RUNNING, false)
                    .remove(PREF_ACCESS).remove(PREF_REFRESH).apply();
        });
        worker.shutdown();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
        super.onDestroy();
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Workday location sharing", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shows when AE is sharing the Field Manager's workday location.");
            getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent stopIntent = new Intent(this, FieldLocationStopReceiver.class);
        PendingIntent stopAction = PendingIntent.getBroadcast(this, NOTIFICATION_ID, stopIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("AE workday location sharing")
                .setContentText("Sharing your latest position with authorised Admins while attendance is active.")
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .addAction(0, "Stop sharing", stopAction)
                .build();
    }

    private static final class HttpResult {
        final int code;
        final String body;
        HttpResult(int code, String body) { this.code = code; this.body = body; }
    }
}
