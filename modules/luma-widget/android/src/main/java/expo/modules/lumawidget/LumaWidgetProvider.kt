package expo.modules.lumawidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import java.io.File

class LumaWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { update(context, manager, it) }
  }

  companion object {
    private const val PHOTO = "luma_widget_photo.jpg"
    private const val PREFS = "luma_widget"
    fun refresh(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, LumaWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { update(context, manager, it) }
    }
    fun photoFile(context: Context) = File(context.filesDir, PHOTO)
    fun setLabel(context: Context, label: String) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("label", label.take(80)).apply()
      refresh(context)
    }
    private fun update(context: Context, manager: AppWidgetManager, id: Int) {
      val views = RemoteViews(context.packageName, R.layout.luma_widget)
      val file = photoFile(context)
      if (file.exists()) {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, options)
        var sample = 1
        while (options.outWidth / sample > 512 || options.outHeight / sample > 512) sample *= 2
        val bitmap = BitmapFactory.decodeFile(file.absolutePath, BitmapFactory.Options().apply { inSampleSize = sample })
        views.setImageViewBitmap(R.id.luma_photo, bitmap)
      } else {
        views.setImageViewBitmap(R.id.luma_photo, null)
      }
      val label = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("label", null)
      views.setTextViewText(R.id.luma_label, label ?: "LUMA · Mở để đồng bộ")
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      if (launch != null) {
        val pending = PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        views.setOnClickPendingIntent(R.id.luma_photo, pending)
      }
      manager.updateAppWidget(id, views)
    }
  }
}
