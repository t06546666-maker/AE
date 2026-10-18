package com.affiliateae.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class FieldLocationStopReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        Intent stop = new Intent(context, FieldLocationForegroundService.class);
        stop.setAction(FieldLocationForegroundService.ACTION_STOP);
        context.startService(stop);
    }
}
