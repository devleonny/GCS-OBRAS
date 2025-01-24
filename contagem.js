
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

    Quagga.onDetected(function (data) {
        let code = data.codeResult.code;
        let linha = `
        <label class="contorno_botoes" style="background-color: #4CAF50;">${code}</label>
        `
        resultados.insertAdjacentElement('beforebegin', linha)
    });
}