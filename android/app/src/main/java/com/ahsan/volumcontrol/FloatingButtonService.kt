package com.ahsan.volumcontrol

import android.animation.ObjectAnimator
import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.*
import android.graphics.drawable.GradientDrawable
import android.media.AudioManager
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.*
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.core.app.NotificationCompat

class FloatingButtonService : Service() {

    companion object {
        var isRunning = false
        var currentVolumeType = "music"
    }

    private lateinit var windowManager: WindowManager
    private var floatingView: View? = null
    private lateinit var params: WindowManager.LayoutParams

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false

    // Current settings
    private var btnColor    = "#3B82F6"
    private var btnOpacity  = 1.0f
    private var btnSize     = 60        // dp
    private var btnPosition = "left"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        startForegroundNotification()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val color    = intent?.getStringExtra("color")              ?: btnColor
        val opacity  = intent?.getFloatExtra("opacity", btnOpacity) ?: btnOpacity
        val size     = intent?.getIntExtra("size", btnSize)         ?: btnSize
        val position = intent?.getStringExtra("position")           ?: btnPosition
        val volType  = intent?.getStringExtra("volumeType")         ?: currentVolumeType

        btnColor           = color
        btnOpacity         = opacity
        btnSize            = size
        btnPosition        = position
        currentVolumeType  = volType

        when (intent?.action) {
            "UPDATE" -> updateButton()
            else -> {
                if (floatingView == null) createFloatingButton()
                else updateButton()
            }
        }
        return START_STICKY
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun dpToPx(dp: Int): Int =
        (dp * resources.displayMetrics.density).toInt()

    private fun startForegroundNotification() {
        val channelId = "volume_control_channel"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId, "Volume Controller",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps the floating volume button active"
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java)
                .createNotificationChannel(channel)
        }
        val notification = NotificationCompat.Builder(this, channelId)
            .setContentTitle("Volume Master Active")
            .setContentText("Tap floating button to control volume")
            .setSmallIcon(android.R.drawable.ic_lock_silent_mode_off)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
            
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, notification)
        }
    }

    private fun parseColor(hex: String, opacity: Float): Int {
        return try {
            val base  = Color.parseColor(hex)
            val alpha = (opacity * 255).toInt().coerceIn(30, 255)
            Color.argb(alpha, Color.red(base), Color.green(base), Color.blue(base))
        } catch (e: Exception) {
            Color.argb((opacity * 255).toInt(), 59, 130, 246)
        }
    }

    private fun makeDarker(hex: String): Int {
        return try {
            val base = Color.parseColor(hex)
            Color.rgb(
                (Color.red(base)   * 0.65f).toInt(),
                (Color.green(base) * 0.65f).toInt(),
                (Color.blue(base)  * 0.65f).toInt()
            )
        } catch (e: Exception) {
            Color.parseColor("#1D4ED8")
        }
    }

    private fun buildBackground(): GradientDrawable =
        GradientDrawable(
            GradientDrawable.Orientation.TL_BR,
            intArrayOf(parseColor(btnColor, btnOpacity), makeDarker(btnColor))
        ).apply {
            shape = GradientDrawable.OVAL
            setStroke(dpToPx(2), Color.argb(80, 255, 255, 255))
        }

    // ─── Create ───────────────────────────────────────────────────────────────

    private fun createFloatingButton() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
            !Settings.canDrawOverlays(this)
        ) { stopSelf(); return }

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val overlayType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

        val sizePx      = dpToPx(btnSize)
        val screenWidth = resources.displayMetrics.widthPixels
        val startX      = if (btnPosition == "right") screenWidth - sizePx - dpToPx(16) else dpToPx(16)

        params = WindowManager.LayoutParams(
            sizePx, sizePx, overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = startX
            y = dpToPx(280)
        }

        val container = FrameLayout(this).apply {
            background = buildBackground()
            elevation   = dpToPx(8).toFloat()
        }

        val iconView = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_lock_silent_mode_off)
            imageTintList = android.content.res.ColorStateList.valueOf(Color.WHITE)
            scaleType     = ImageView.ScaleType.CENTER_INSIDE
            val p = dpToPx(14)
            setPadding(p, p, p, p)
        }
        container.addView(iconView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        floatingView = container
        floatingView!!.clipToOutline = true
        floatingView!!.outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setOval(0, 0, view.width, view.height)
            }
        }

        floatingView!!.setOnTouchListener { view, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX      = params.x; initialY      = params.y
                    initialTouchX = event.rawX; initialTouchY = event.rawY
                    isDragging = false
                    view.animate().scaleX(0.88f).scaleY(0.88f).setDuration(80).start()
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                        isDragging = true
                        params.x = initialX + dx
                        params.y = initialY + dy
                        windowManager.updateViewLayout(floatingView, params)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    view.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                    if (isDragging) {
                        snapToEdge()
                    } else {
                        showVolumePanel()
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    view.animate().scaleX(1f).scaleY(1f).setDuration(120).start()
                    true
                }
                else -> false
            }
        }

        windowManager.addView(floatingView, params)
    }

    // ─── Edge snap ────────────────────────────────────────────────────────────

    private fun snapToEdge() {
        val view   = floatingView ?: return
        val screen = resources.displayMetrics.widthPixels
        val mid    = screen / 2
        val targetX = if (params.x + dpToPx(btnSize) / 2 < mid) dpToPx(12)
                      else screen - dpToPx(btnSize) - dpToPx(12)

        val animator = ObjectAnimator.ofInt(params.x, targetX)
        animator.duration = 250
        animator.interpolator = DecelerateInterpolator(1.5f)
        animator.addUpdateListener { anim ->
            params.x = anim.animatedValue as Int
            try { windowManager.updateViewLayout(view, params) } catch (_: Exception) {}
        }
        animator.start()
    }

    // ─── Update ──────────────────────────────────────────────────────────────

    private fun updateButton() {
        floatingView?.let { view ->
            val sizePx = dpToPx(btnSize)
            view.background  = buildBackground()
            params.width     = sizePx
            params.height    = sizePx
            try { windowManager.updateViewLayout(view, params) } catch (_: Exception) {}
        }
    }

    // ─── Volume panel ────────────────────────────────────────────────────────

    private fun showVolumePanel() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val stream = when (currentVolumeType) {
                "ring"         -> AudioManager.STREAM_RING
                "alarm"        -> AudioManager.STREAM_ALARM
                "notification" -> AudioManager.STREAM_NOTIFICATION
                else           -> AudioManager.STREAM_MUSIC
            }
            am.adjustStreamVolume(stream, AudioManager.ADJUST_SAME, AudioManager.FLAG_SHOW_UI)
        } catch (e: Exception) { e.printStackTrace() }
    }

    // ─── Destroy ─────────────────────────────────────────────────────────────

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        floatingView?.let {
            try { windowManager.removeView(it) } catch (_: Exception) {}
        }
        floatingView = null
    }
}
