const telaInterna = document.querySelector('.telaInterna')
let empresas = {}
let tipos = {}
let sistemas = {}
let correcoes = {}
let prioridades = {}
let dados_clientes = {}

ativarCloneGCS(true)
const modeloTabela = (colunas) => { 

    const botaoVoltar = acesso.permissao !== 'visitante' ? `<img class="atualizar" src="imagens/voltar_2.png" onclick="window.location.href = 'inicial.html'">` : ''

    const ths = colunas
        .map(col => `<th>${col}</th>`).join('')

    const thead = (colunas && colunas.length > 0) ? `<thead>${ths}</thead>` : ''

    return `
    <div class="fundo">
        <div class="titulo">
            <img src="imagens/LG.png">
            <span>Relatório de Ocorrências</span>
        </div>
        <br>
        <div class="blocoTabela">
            <div class="painelBotoes">
                <div class="botoes">
                    <div class="pesquisa">
                        <input oninput="pesquisar(this, 'body')" placeholder="Pesquisar" style="width: 100%;">
                        <img src="imagens/pesquisar2.png">
                    </div>
                </div>
                <div style="${horizontal}; gap: 5px;">
                    ${botaoVoltar}
                    <img class="atualizar" src="imagens/atualizar3.png" onclick="atualizarDados()">
                </div>
            </div>
            <div class="recorteTabela">
                <table class="tabela">
                    ${thead}
                    <tbody id="body"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    </div>
`}

telaOcorrencias()

async function telaOcorrencias() {

    dados_clientes = await recuperarDados('dados_clientes')
    empresas = await recuperarDados('empresas')
    tipos = await recuperarDados('tipos')
    sistemas = await recuperarDados('sistemas')
    correcoes = await recuperarDados('correcoes')
    prioridades = await recuperarDados('prioridades')
    const dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const tabela = modeloTabela(
        ['Empresa',
            'Chamado',
            'Status',
            'Abertura',
            'Data Limite',
            'Solicitante',
            'Executor',
            'Tipo Correção',
            'Loja',
            'Sistema',
            'Prioridade',
            ''
        ]
    )

    telaInterna.innerHTML = tabela

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) criarLinhaOcorrencia(idOcorrencia, ocorrencia)

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '--'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}


async function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'


    const linha = `
        <tr id="${idOcorrencia}">
            <td>${empresas[ocorrencia?.empresa]?.nome || '--'}</td>
            <td>${idOcorrencia}</td>
            <td>${status}</td>
            <td>${ocorrencia?.dataRegistro || ''}</td>
            <td>${dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao)}</td>
            <td>${ocorrencia?.solicitante || ''}</td>
            <td>${ocorrencia?.executor || ''}</td>
            <td>${tipos?.[ocorrencia?.tipo]?.nome || '...'}</td>
            <td>${dados_clientes?.[ocorrencia?.unidade]?.nome || '...'}</td>
            <td>${sistemas?.[ocorrencia?.sistema]?.nome || '...'}</td>
            <td>${prioridades?.[ocorrencia?.prioridade]?.nome || '...'}</td>
            <td>
                <img src="imagens/pesquisar2.png" style="width: 2vw;" onclick="abrirCorrecoes('${idOcorrencia}')">
            </td>
        </tr>
    `

    const trExistente = document.getElementById(idOcorrencia)
    if (trExistente) return trExistente.innerHTML = linha

    document.getElementById('body').insertAdjacentHTML('beforeend', linha)
}

async function atualizarDados() {
    overlayAguarde()

    await sincronizarDados('dados_ocorrencias', true)
    await sincronizarDados('empresas', true)
    await sincronizarDados('dados_composicoes', true)
    await sincronizarDados('tipos', true)
    await sincronizarDados('correcoes', true)
    await sincronizarDados('prioridades', true)
    await sincronizarDados('sistemas', true)

    await telaOcorrencias()
    removerOverlay()
}

async function abrirCorrecoes(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    const correcoesOC = ocorrencia?.correcoes || {}
    const thead = ['Executor', 'Tipo Correção', 'Descrição', 'Localização']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for(let [idCorrecao, correcao] of Object.entries(correcoesOC)) {
        const st = correcoes[correcao.tipoCorrecao].nome
        let registros = ''

        for(let [dt, dado] of Object.entries(correcao.datas)) {

            let rastreio = 'Processando localização...'
            if(dado.geolocalizacao) {
                rastreio = `
                    <span>${dado.geolocalizacao.address.road}</span>
                    <strong><span>${dado.geolocalizacao.address.city}</span></strong>
                    <span>${dado.geolocalizacao.address.postcode}</span>
                `
            }
            
            registros += `
                <div class="bloco">
                    <label>${new Date(Number(dt)).toLocaleString('pt-BR')}</label>
                    <div style="${vertical};">
                        ${rastreio}
                    </div>
                </div>
            `
        }

        linhas += `
            <tr>
                <td>${correcao.executor}</td>
                <td>${st}</td>
                <td>${correcao.descricao}</td>
                <td>
                    <div style="${vertical}; gap: 1px;">
                        ${registros}
                    </div>
                </td>
            </tr>
        `
    }

    const acumulado = `
        <div style="padding: 2vw; background-color: #efefefff;">
            <div class="blocoTabela">
                <div class="painelBotoes">
                    <div class="botoes">
                        <div class="pesquisa">
                            <input oninput="pesquisar(this, 'body')" placeholder="Pesquisar" style="width: 100%;">
                            <img src="imagens/pesquisar2.png">
                        </div>
                    </div>
                </div>
                <div class="recorteTabela">
                    <table class="tabela">
                        <thead>${thead}</thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>
        </div>
        `

    popup(acumulado, 'Correções')
}

function pesquisar(input, idTbody) {
    const termo = input.value.trim().toLowerCase();
    const tbody = document.getElementById(idTbody);
    const trs = tbody.querySelectorAll('tr');

    trs.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        let encontrou = false;

        tds.forEach(td => {
            let texto = td.textContent.trim().toLowerCase();

            const inputInterno = td.querySelector('input, textarea, select');
            if (inputInterno) {
                texto += ' ' + inputInterno.value.trim().toLowerCase();
            }

            if (termo && texto.includes(termo)) {
                encontrou = true;
            }
        });

        if (!termo || encontrou) {
            tr.style.display = ''; // mostra
        } else {
            tr.style.display = 'none'; // oculta
        }
    });
}
