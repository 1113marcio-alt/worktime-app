package lu.marcio.worktimepro.preview;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Reports installed version and opens only the official Preview release page.
 * Android package installer performs signature checks on installation.
 */
@CapacitorPlugin(name = "WorkTimeUpdate")
public class WorkTimeUpdatePlugin extends Plugin {
    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0);
            JSObject data = new JSObject();
            data.put("versionName", info.versionName);
            data.put("versionCode", Build.VERSION.SDK_INT >= 28
                ? info.getLongVersionCode() : info.versionCode);
            data.put("packageName", getContext().getPackageName());
            data.put("debug", (getContext().getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0);
            call.resolve(data);
        } catch (Exception error) {
            call.reject("Não foi possível ler a versão instalada.");
        }
    }

    @PluginMethod
    public void openRelease(PluginCall call) {
        String tag = call.getString("tag", "");
        if (tag == null || !tag.matches("worktime-preview-v3-[1-9][0-9]{0,9}")) {
            call.reject("Versão inválida."); return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(
                "https://github.com/1113marcio-alt/worktime-app/releases/tag/" + tag));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Não foi possível abrir a versão no navegador.");
        }
    }
}
