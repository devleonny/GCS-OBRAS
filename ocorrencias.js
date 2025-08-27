const telaInterna = document.querySelector('.telaInterna')
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

    const dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const tabela = modeloTabela(['Chamado', 'Solicitante', 'Executor', 'Unidade', 'Prioridade'])
    telaInterna.innerHTML = tabela

    for(const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias)) criarLinhaOcorrencia(idOcorrencia, )

}

async function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'
    const linha = `
        <tr id="${idOcorrencia}">
            
            <td style="background-color: white;">
              
                <div style="${vertical}; gap: 5px; width: 100%; position: relative;">

                    <div style="${horizontal}; width: 90%; gap: 5px; padding: 5px;">
                        ${botao('INCLUIR CORREÇÃO', `formularioCorrecao('${idOcorrencia}')`, '#e47a00')}
                        ${botaoImg('lapis', `formularioOcorrencia('${idOcorrencia}')`)}
                        ${botaoImg('fechar', `confirmarExclusao('${idOcorrencia}')`)}
                    </div>

                    ${modeloCampos('Empresa', empresas[ocorrencia?.empresa]?.nome || '--')}
                    ${modeloCampos('Número', idOcorrencia)}
                    ${modeloCampos('Última Correção', status)}
                    ${modeloCampos('Data Registro', ocorrencia?.dataRegistro || '')}
                    ${modeloCampos('Data Limite', dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao))}
                    ${modeloCampos('Solicitante', ocorrencia?.solicitante || '')}
                    ${modeloCampos('Executor', ocorrencia?.executor || '')}
                    ${modeloCampos('Tipo', tipos?.[ocorrencia?.tipo]?.nome || '...')}
                    ${modeloCampos('Unidade', dados_clientes?.[ocorrencia?.unidade]?.nome || '...')}
                    ${modeloCampos('Sistema', sistemas?.[ocorrencia?.sistema]?.nome || '...')}
                    ${modeloCampos('Prioridade', prioridades?.[ocorrencia?.prioridade]?.nome || '...')}
                    ${modeloCampos('Descrição ', ocorrencia?.descricao || '...')}
                    <br>
                </div>

            </td>
            
            ${ocorrencia.correcoes
            ? `<td style="background-color: white;">${await gerarCorrecoes(idOcorrencia, ocorrencia.correcoes)}</td>`
            : `<td style="background-color: #0000005e">
                    <img src="imagens/BG.png" class="img-logo-td">
                </td>`}
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