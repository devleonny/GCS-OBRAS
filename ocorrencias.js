const telaInterna = document.querySelector('.telaInterna')
let empresas = {}
let tipos = {}
let sistemas = {}
let prioridades = {}

ativarCloneGCS(true)
const modeloTabela = (colunas) => {

    const ths = colunas
        .map(col => `<th>${col}</th>`).join('')

    const thead = (colunas && colunas.length > 0) ? `<thead>${ths}</thead>` : ''

    return `
    <div class="blocoTabela">
        <div class="painelBotoes">
            <div class="botoes">
                <div class="pesquisa">
                    <input oninput="pesquisar(this, 'body')" placeholder="Pesquisar" style="width: 100%;">
                    <img src="imagens/pesquisar2.png">
                </div>
            </div>
            <img class="atualizar" src="imagens/atualizar3.png" onclick="atualizarDados()">
        </div>
        <div class="recorteTabela">
            <table class="tabela">
                ${thead}
                <tbody id="body"></tbody>
            </table>
        </div>
        <div class="rodapeTabela"></div>
    </div>
`}

telaOcorrencias()

async function telaOcorrencias() {

    empresas = await recuperarDados('empresas')
    tipos = await recuperarDados('tipos')
    sistemas = await recuperarDados('sistemas')
    prioridades = await recuperarDados('prioridades')
    const dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const tabela = modeloTabela(['Chamado', 'Solicitante', 'Executor', 'Unidade', 'Prioridade'])
    telaInterna.innerHTML = tabela

    for(const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias)) criarLinhaOcorrencia(idOcorrencia, ocorrencia)

}

async function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'
    const linha = `
        <tr id="${idOcorrencia}">
            <td>${empresas[ocorrencia?.empresa]?.nome || '--'}</td>
            <td>${idOcorrencia}</td>
            <td>${status}</td>
            <td>${ocorrencia?.dataRegistro || ''}</td>
            <td>${ocorrencia?.dataLimiteExecucao}</td>
            <td>${ocorrencia?.solicitante || ''}</td>
            <td>${ocorrencia?.executor || ''}</td>
            <td>${tipos?.[ocorrencia?.tipo]?.nome || '...'}</td>
            <td>${dados_clientes?.[ocorrencia?.unidade]?.nome || '...'}</td>
            <td>${sistemas?.[ocorrencia?.sistema]?.nome || '...'}</td>
            <td>${prioridades?.[ocorrencia?.prioridade]?.nome || '...'}</td>
            <td>${ocorrencia?.descricao || '...'}</td>
        </tr>
    `

    const trExistente = document.getElementById(idOcorrencia)
    if (trExistente) return trExistente.innerHTML = linha

    document.getElementById('body').insertAdjacentHTML('beforeend', linha)
}

async function atualizarDados() {
    overlayAguarde()

    await sincronizarDados('empresas', true)
    await sincronizarDados('dados_composicoes', true)
    await sincronizarDados('tipos', true)
    await sincronizarDados('correcoes', true)
    await sincronizarDados('prioridades', true)
    await sincronizarDados('sistemas', true)

    await telaOcorrencias()
    removerOverlay()
}