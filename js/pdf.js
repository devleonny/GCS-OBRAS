// Página de prévia do orçamento (pdf.html). A montagem fica em pdf_orcamento.js,
// a mesma usada para baixar o PDF direto do sistema principal.

function voltar() {
    window.history.back();
}

const idOrcamentoPagina = new URLSearchParams(window.location.search).get('id')

montarPdfOrcamento(idOrcamentoPagina)

function excel() {
    irExcelOrcamento(idOrcamentoPagina)
}

// Usa o que já está na tela; montar de novo aqui disputaria o HTML com o envio.
async function gerarPDF() {
    const orcamentoBase = await recuperarDado('dados_orcamentos', idOrcamentoPagina) || {}

    await pdf({
        html: htmlPdfOrcamento(document),
        estilos: ESTILOS_PDF_ORCAMENTO,
        nome: await nomeArquivoPdfOrcamento(orcamentoBase)
    })
}
