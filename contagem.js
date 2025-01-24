
function iniciar_sensor() {
    let resultados = document.getElementById('resultados')
    Quagga.init({
        inputStream: {
            type: "LiveStream",
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment" // Usa a câmera traseira
            },
            target: document.querySelector("#interactive") // Elemento onde o vídeo aparece
        },
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader"] // Tipos de código de barras
        }
    }, function (err) {
        if (err) {
            console.error("Erro ao inicializar o Quagga:", err);
            return;
        }
        Quagga.start();
    });

    let detectedCodes = new Map();

    Quagga.onDetected(function (data) {
        if (data && data.codeResult && data.codeResult.code) {
            let code = data.codeResult.code;
            let now = Date.now();

            // Verifica se o código foi detectado recentemente (ex.: 2 segundos)
            if (!detectedCodes.has(code) || (now - detectedCodes.get(code)) > 2000) {
                detectedCodes.set(code, now);
                console.log("Código detectado:", code);

                // Vibração
                if (navigator.vibrate) {
                    navigator.vibrate(200); // Vibra por 200ms
                }

                // Reproduzir som
                let audio = new Audio('path/to/sound.mp3'); // Insira o caminho para o som
                audio.play();

                // Atualizar UI
                let linha = `
                <label class="contorno_botoes" style="background-color: #4CAF50;">${code}</label>
                `;
                resultados.insertAdjacentHTML('beforebegin', linha);
            }
        } else {
            console.log("Nenhum código válido detectado.");
        }
    });

}