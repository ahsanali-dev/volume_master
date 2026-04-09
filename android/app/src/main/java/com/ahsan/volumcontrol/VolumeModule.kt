package com.ahsan.volumcontrol

import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class VolumeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "VolumeModule"

    // ── Permission ────────────────────────────────────────────────────────────

    @ReactMethod
    fun checkPermission(promise: Promise) {
        try {
            val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactApplicationContext)
            } else {
                true
            }
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestPermission() {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${reactApplicationContext.packageName}")
            )
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // ── Service control ───────────────────────────────────────────────────────

    @ReactMethod
    fun isServiceRunning(promise: Promise) {
        promise.resolve(FloatingButtonService.isRunning)
    }

    @ReactMethod
    fun showFloatingButton(
        color: String,
        opacity: Double,
        size: Int,
        position: String,
        volumeType: String
    ) {
        val context = reactApplicationContext
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(context)
        ) return

        val intent = Intent(context, FloatingButtonService::class.java).apply {
            action = "SHOW"
            putExtra("color", color)
            putExtra("opacity", opacity.toFloat())
            putExtra("size", size)
            putExtra("position", position)
            putExtra("volumeType", volumeType)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun updateFloatingButton(
        color: String,
        opacity: Double,
        size: Int,
        position: String,
        volumeType: String
    ) {
        val context = reactApplicationContext
        val intent = Intent(context, FloatingButtonService::class.java).apply {
            action = "UPDATE"
            putExtra("color", color)
            putExtra("opacity", opacity.toFloat())
            putExtra("size", size)
            putExtra("position", position)
            putExtra("volumeType", volumeType)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    @ReactMethod
    fun hideFloatingButton() {
        val context = reactApplicationContext
        context.stopService(Intent(context, FloatingButtonService::class.java))
    }

    // ── Volume control ────────────────────────────────────────────────────────

    private fun streamFor(volumeType: String): Int = when (volumeType) {
        "ring"         -> AudioManager.STREAM_RING
        "alarm"        -> AudioManager.STREAM_ALARM
        "notification" -> AudioManager.STREAM_NOTIFICATION
        else           -> AudioManager.STREAM_MUSIC
    }

    @ReactMethod
    fun getVolumeLevel(volumeType: String, promise: Promise) {
        try {
            val am = reactApplicationContext
                .getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val stream  = streamFor(volumeType)
            val current = am.getStreamVolume(stream)
            val max     = am.getStreamMaxVolume(stream)
            val result  = WritableNativeMap().apply {
                putInt("current", current)
                putInt("max", max)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun setVolumeLevel(volumeType: String, level: Int, promise: Promise) {
        try {
            val am = reactApplicationContext
                .getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val stream = streamFor(volumeType)
            val max    = am.getStreamMaxVolume(stream)
            val safe   = level.coerceIn(0, max)
            am.setStreamVolume(stream, safe, AudioManager.FLAG_SHOW_UI)
            val result = WritableNativeMap().apply {
                putInt("current", safe)
                putInt("max", max)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun adjustVolume(volumeType: String, direction: String, promise: Promise) {
        try {
            val am = reactApplicationContext
                .getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val stream = streamFor(volumeType)
            val adjust = if (direction == "up") AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER
            am.adjustStreamVolume(stream, adjust, AudioManager.FLAG_SHOW_UI)
            val current = am.getStreamVolume(stream)
            val max     = am.getStreamMaxVolume(stream)
            val result  = WritableNativeMap().apply {
                putInt("current", current)
                putInt("max", max)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
