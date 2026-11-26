package lu.marcio.worktimepro.preview;

import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Interface authentication only. No biometric templates or credentials are read. */
@CapacitorPlugin(name = "WorkTimeBiometric")
public class WorkTimeBiometricPlugin extends Plugin {
    private boolean authenticating = false;

    private boolean available() {
        if (Build.VERSION.SDK_INT < 30) return false;
        BiometricManager manager = (BiometricManager) getContext().getSystemService(Context.BIOMETRIC_SERVICE);
        return manager != null && manager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", available());
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (authenticating) { call.reject("Autenticação em curso."); return; }
            if (!available()) { call.reject("Biometria forte indisponível. Usa o PIN."); return; }
            authenticating = true;
            try {
                BiometricPrompt prompt = new BiometricPrompt.Builder(getActivity())
                    .setTitle("WorkTime Pro")
                    .setSubtitle("Confirma a tua identidade")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .setNegativeButton("Usar PIN", getActivity().getMainExecutor(), (dialog, which) -> {})
                    .build();
                prompt.authenticate(new CancellationSignal(), getActivity().getMainExecutor(),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            authenticating = false;
                            JSObject response = new JSObject();
                            response.put("authenticated", true);
                            call.resolve(response);
                        }

                        @Override
                        public void onAuthenticationError(int code, CharSequence message) {
                            authenticating = false;
                            call.reject("Autenticação cancelada ou indisponível. Usa o PIN.");
                        }
                    });
            } catch (Exception error) {
                authenticating = false;
                call.reject("Não foi possível abrir a autenticação biométrica.", error);
            }
        });
    }
}
