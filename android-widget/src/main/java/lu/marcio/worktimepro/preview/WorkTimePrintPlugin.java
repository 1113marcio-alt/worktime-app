package lu.marcio.worktimepro.preview;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android PrintManager integration. It opens the system print dialog where the
 * user can choose "Save as PDF" or an installed printer. It does not claim
 * that the user saved the PDF; that action is completed in the Android UI.
 */
@CapacitorPlugin(name = "WorkTimePrint")
public class WorkTimePrintPlugin extends Plugin {
    private WebView reportView;

    @PluginMethod
    public void print(PluginCall call) {
        final String html = call.getString("html", "");
        final String jobName = call.getString("jobName", "WorkTime Pro — relatório");
        if (html == null || html.isEmpty() || html.length() > 250000) {
            call.reject("Relatório em branco ou demasiado longo.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (reportView != null) {
                call.reject("Já existe um relatório de impressão aberto.");
                return;
            }
            try {
                final WebView view = new WebView(getActivity());
                reportView = view;
                view.getSettings().setJavaScriptEnabled(false);
                view.getSettings().setAllowFileAccess(false);
                view.getSettings().setBlockNetworkLoads(true);
                view.setWebViewClient(new WebViewClient() {
                    private boolean started = false;

                    @Override
                    public void onPageFinished(WebView loaded, String url) {
                        if (started) return;
                        started = true;
                        loaded.post(() -> {
                            try {
                                PrintManager manager = (PrintManager) getActivity()
                                    .getSystemService(Context.PRINT_SERVICE);
                                if (manager == null) {
                                    reportView = null;
                                    loaded.destroy();
                                    call.reject("Serviço de impressão Android indisponível.");
                                    return;
                                }
                                final PrintDocumentAdapter delegate =
                                    loaded.createPrintDocumentAdapter(jobName);
                                final PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                                    @Override
                                    public void onStart() { delegate.onStart(); }

                                    @Override
                                    public void onLayout(PrintAttributes oldAttributes,
                                            PrintAttributes newAttributes,
                                            CancellationSignal signal,
                                            LayoutResultCallback callback, Bundle extras) {
                                        delegate.onLayout(oldAttributes,newAttributes,signal,callback,extras);
                                    }

                                    @Override
                                    public void onWrite(PageRange[] pages,
                                            ParcelFileDescriptor destination,
                                            CancellationSignal signal,
                                            WriteResultCallback callback) {
                                        delegate.onWrite(pages,destination,signal,callback);
                                    }

                                    @Override
                                    public void onFinish() {
                                        delegate.onFinish();
                                        loaded.post(() -> {
                                            if (reportView == loaded) reportView = null;
                                            loaded.destroy();
                                        });
                                    }
                                };
                                manager.print(jobName,adapter,
                                    new PrintAttributes.Builder()
                                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                        .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                        .build());
                                call.resolve();
                            } catch (Exception err) {
                                if (reportView == loaded) reportView = null;
                                loaded.destroy();
                                call.reject("Não foi possível abrir a impressão Android.",err);
                            }
                        });
                    }
                });
                // The HTML is generated from escaped local report values.
                // No remote resources, no JS, no storage and no file access.
                view.loadDataWithBaseURL(null,html,"text/html","UTF-8",null);
            } catch (Exception err) {
                if (reportView != null) {
                    reportView.destroy();
                    reportView = null;
                }
                call.reject("Não foi possível preparar o relatório.",err);
            }
        });
    }
}
