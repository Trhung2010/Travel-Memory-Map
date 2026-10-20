package expo.modules.lumawidget

import android.net.Uri
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class LumaWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LumaWidget")
    AsyncFunction("setLatest") { uri: String, label: String ->
      val context = requireNotNull(appContext.reactContext)
      val source = File(requireNotNull(Uri.parse(uri).path))
      require(source.isFile && source.length() > 0) { "Widget photo does not exist" }
      val target = LumaWidgetProvider.photoFile(context)
      val temporary = File(context.filesDir, "luma_widget_pending.jpg")
      source.copyTo(temporary, overwrite = true)
      if (target.exists()) target.delete()
      check(temporary.renameTo(target)) { "Cannot save widget photo" }
      LumaWidgetProvider.setLabel(context, label)
    }
    AsyncFunction("clear") {
      val context = requireNotNull(appContext.reactContext)
      LumaWidgetProvider.photoFile(context).delete()
      LumaWidgetProvider.setLabel(context, "LUMA · Mở để đồng bộ")
    }
  }
}
