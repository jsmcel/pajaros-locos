package com.jsmcel.pajaroslocos;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.IOException;

/**
 * Pájaros Locos — el juego es una página web dentro de un WebView.
 * Lo único que añade Android es el puente para que el botón
 * "📸 HACER FOTO" abra la cámara de verdad.
 */
public class MainActivity extends Activity {

    private static final int PETICION_ARCHIVO = 7001;
    private static final String ORIGEN = "https://appassets.androidplatform.net/assets/index.html";

    private WebView web;
    private ValueCallback<Uri[]> respuestaArchivo;
    private Uri fotoUri;
    private File fotoArchivo;
    private long ultimoAtras = 0;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF5BB3E0);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);            // hace falta para guardar los niveles
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        // Servimos los archivos de assets/ bajo un origen https real:
        // así localStorage funciona igual que en la web.
        final WebViewAssetLoader cargador = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView vista, WebResourceRequest peticion) {
                return cargador.shouldInterceptRequest(peticion.getUrl());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> callback,
                                             FileChooserParams parametros) {
                return abrirSelectorDeFoto(callback);
            }
        });

        setContentView(web);
        pantallaCompleta();
        web.loadUrl(ORIGEN);
    }

    /** Abre un selector con la cámara y la galería. */
    private boolean abrirSelectorDeFoto(ValueCallback<Uri[]> callback) {
        if (respuestaArchivo != null) respuestaArchivo.onReceiveValue(null);
        respuestaArchivo = callback;
        fotoUri = null;
        fotoArchivo = null;

        Intent camara = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (camara.resolveActivity(getPackageManager()) != null) {
            try {
                fotoArchivo = crearArchivoTemporal();
                fotoUri = FileProvider.getUriForFile(
                        this, getPackageName() + ".fileprovider", fotoArchivo);
                camara.putExtra(MediaStore.EXTRA_OUTPUT, fotoUri);
                camara.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                        | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception e) {
                camara = null;
                fotoUri = null;
                fotoArchivo = null;
            }
        } else {
            camara = null;
        }

        Intent galeria = new Intent(Intent.ACTION_GET_CONTENT);
        galeria.addCategory(Intent.CATEGORY_OPENABLE);
        galeria.setType("image/*");

        Intent selector = new Intent(Intent.ACTION_CHOOSER);
        selector.putExtra(Intent.EXTRA_INTENT, galeria);
        selector.putExtra(Intent.EXTRA_TITLE, getString(R.string.elige_foto));
        if (camara != null) {
            selector.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camara});
        }

        try {
            startActivityForResult(selector, PETICION_ARCHIVO);
            return true;
        } catch (Exception e) {
            respuestaArchivo = null;
            Toast.makeText(this, "No he podido abrir la cámara", Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    private File crearArchivoTemporal() throws IOException {
        File carpeta = new File(getCacheDir(), "fotos");
        if (!carpeta.exists() && !carpeta.mkdirs()) throw new IOException("sin carpeta");
        return File.createTempFile("dibujo_", ".jpg", carpeta);
    }

    @Override
    protected void onActivityResult(int peticion, int resultado, Intent datos) {
        if (peticion != PETICION_ARCHIVO) {
            super.onActivityResult(peticion, resultado, datos);
            return;
        }
        Uri[] uris = null;
        if (resultado == RESULT_OK) {
            if (datos != null && datos.getData() != null) {
                uris = new Uri[]{datos.getData()};                       // vino de la galería
            } else if (fotoUri != null && fotoArchivo != null && fotoArchivo.length() > 0) {
                uris = new Uri[]{fotoUri};                               // vino de la cámara
            }
        }
        if (respuestaArchivo != null) {
            respuestaArchivo.onReceiveValue(uris);
            respuestaArchivo = null;
        }
    }

    /** Modo inmersivo: sin barras que molesten a los peques. */
    private void pantallaCompleta() {
        View decoracion = getWindow().getDecorView();
        decoracion.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean tieneFoco) {
        super.onWindowFocusChanged(tieneFoco);
        if (tieneFoco) pantallaCompleta();
    }

    /** Dos toques para salir, así no se sale sin querer. */
    @Override
    public void onBackPressed() {
        long ahora = System.currentTimeMillis();
        if (ahora - ultimoAtras < 2000) {
            super.onBackPressed();
        } else {
            ultimoAtras = ahora;
            Toast.makeText(this, R.string.salir, Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
