package lu.marcio.worktimepro.preview;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/** Bundled on-device Latin-script OCR. Never stores the image or recognised text. */
@CapacitorPlugin(name = "WorkTimeReceipt")
public class WorkTimeReceiptPlugin extends Plugin {
    @PluginMethod
    public void recognize(PluginCall call) {
        String encoded = call.getString("image", "");
        if (encoded == null || encoded.isEmpty() || encoded.length() > 16000000) {
            call.reject("Imagem vazia ou demasiado grande."); return;
        }
        Bitmap bitmap;
        try {
            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
                call.reject("Formato de imagem inválido."); return;
            }
            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = 1;
            while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 3200)
                options.inSampleSize *= 2;
            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
            if (bitmap == null) { call.reject("Não foi possível abrir a fotografia."); return; }
        } catch (Exception error) {
            call.reject("Não foi possível abrir a fotografia."); return;
        }
        TextRecognizer recognizer = null;
        try {
            recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            final TextRecognizer engine = recognizer;
            engine.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(result -> {
                    JSObject data = new JSObject();
                    String text = result.getText();
                    data.put("text", text.length() > 60000 ? text.substring(0, 60000) : text);
                    call.resolve(data);
                })
                .addOnFailureListener(error -> call.reject("Não foi possível reconhecer o texto."))
                .addOnCompleteListener(task -> { engine.close(); bitmap.recycle(); });
        } catch (Exception error) {
            if (recognizer != null) recognizer.close();
            bitmap.recycle();
            call.reject("Não foi possível iniciar a leitura.");
        }
    }
}
