let canvas = null
let ctx = null
let drawing = false;
let last = { x: 0, y: 0 };
const strokeColor = "#000000";
const lineWidth = 3;

function fitCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.scale(ratio, ratio);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
}

function pos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) e = e.touches[0];
    return { x: (e.clientX - rect.left), y: (e.clientY - rect.top) };
}

function start(e) {
    e.preventDefault();
    drawing = true;
    last = pos(e);
}

function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last = p;
}

function end() {
    drawing = false;
}

function downloadDataURL(dataURL, filename) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function iniciarAuxiliares() {

    canvas = document.getElementById('sig');
    ctx = canvas.getContext('2d');

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('mousemove', move);
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchend', end);

    window.addEventListener('resize', fitCanvas);
    fitCanvas();

}

function limparTela() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

async function salvarAssinatura(idOcorrencia) {

    overlayAguarde()

    try {
        const data = canvas.toDataURL('image/png')

        const dados = await importarAnexos({ foto: data })

        let ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

        ocorrencia.assinatura = dados[0].link

        enviar(`dados_ocorrencias/${idOcorrencia}/assinatura`, dados[0].link)

        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')

        removerPopup()

        await telaOcorrencias()

    } catch (err) {
        popup(mensagem(`Falha ao salvar: ${err}`), 'Alerta', true)
    }

}

async function coletarAssinatura(idOcorrencia) {

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 0.5rem;">
        
            <div class="canvas-wrap">
                <canvas id="sig"></canvas>
            </div>

        </div>

        <div class="botoes-flutuantes">
            <button class="small" onclick="limparTela()">Limpar</button>
            <button class="small" onclick="salvarAssinatura('${idOcorrencia}')">Salvar</button>
        </div>
    `
    popup(acumulado, `Assinatura do Cliente - ${idOcorrencia}`, true)

    iniciarAuxiliares()

}