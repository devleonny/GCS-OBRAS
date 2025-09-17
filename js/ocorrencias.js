let empresas = {}
let tipos = {}
let sistemas = {}
let correcoes = {}
let prioridades = {}
let filtroOcorrencias = {}

const modeloTabela = (colunas) => {

    const ths = colunas
        .map(col => `<th>${col}</th>`).join('')

    const pesquisa = colunas
        .map((col, i) => `<th oninput="pesquisarGenerico('${i}',  this.textContent, filtroOcorrencias, 'body')" style="background-color: white; text-align: left;" contentEditable="true"></th>`)
        .join('')

    return `
    <div class="fundo">
        <div class="blocoTabela" style="width: 100%;">
            <div class="painelBotoes"></div>
            <div class="recorteTabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    <thead>
                    <tbody id="body"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    </div>`

}

telaOcorrencias()

async function telaOcorrencias() {

    overlayAguarde()

    dados_clientes = await recuperarDados('dados_clientes')
    empresas = await recuperarDados('empresas')
    tipos = await recuperarDados('tipos')
    sistemas = await recuperarDados('sistemas')
    correcoes = await recuperarDados('correcoes')
    prioridades = await recuperarDados('prioridades')
    const dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const tabela = modeloTabela(
        [
            '',
            'Empresa',
            'Chamado',
            'Status',
            'Abertura',
            'Data Limite',
            'Solicitante',
            'Executor',
            'Tipo Correção',
            'Loja',
            'Sistema',
            'Prioridade'
        ]
    )

    tela.innerHTML = tabela
    criarMenus('ocorrencias')
    removerOverlay()

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) criarLinhaOcorrencia(idOcorrencia, ocorrencia)

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '--'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}


async function criarLinhaOcorrencia(idOcorrencia, ocorrencia) {

    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'

    const tds = `
        <td><img src="imagens/pesquisar2.png" style="width: 1.5rem; cursor: pointer;" onclick="abrirCorrecoes('${idOcorrencia}')"></td>
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
    `

    const trExistente = document.getElementById(idOcorrencia)
    if (trExistente) return trExistente.innerHTML = linha

    document.getElementById('body').insertAdjacentHTML('beforeend', `<tr id="${idOcorrencia}">${tds}</tr>`)
}

async function atualizarDados() {
    overlayAguarde()

    const nuvem = await baixarOcorrencias()
    await inserirDados(nuvem, 'dados_ocorrencias')

    await sincronizarDados('empresas', true)
    await sincronizarDados('dados_composicoes', true)
    await sincronizarDados('tipos', true)
    await sincronizarDados('correcoes', true)
    await sincronizarDados('prioridades', true)
    await sincronizarDados('sistemas', true)

    await telaOcorrencias()
    removerOverlay()
}

async function baixarOcorrencias() {

    const timestampOcorrencia = await maiorTimestamp('dados_ocorrencias')

    async function maiorTimestamp(nomeBase) {

        let timestamp = 0
        const dados = await recuperarDados(nomeBase)
        for (const [id, objeto] of Object.entries(dados)) {
            if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
        }

        return timestamp
    }

    return new Promise((resolve, reject) => {
        fetch(`${api}/ocorrencias`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario: acesso.usuario, timestampOcorrencia })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(error => reject(error));

    })
}

async function abrirCorrecoes(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)

    const correcoesOC = ocorrencia?.correcoes || {}
    const thead = ['Executor', 'Tipo Correção', 'Descrição', 'Localização', 'Imagens']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for (let [idCorrecao, correcao] of Object.entries(correcoesOC)) {
        const st = correcoes[correcao.tipoCorrecao].nome
        let registros = ''

        console.log(correcao);

        const imagens = Object.entries(correcao?.fotos || {})
            .map(([link, foto]) => `<img name="foto" id="${link}" src="${api}/uploads/GCS/${link}" onclick="ampliarImagem(this, '${link}')">`)
            .join('')


        for (let [dt, dado] of Object.entries(correcao.datas)) {

            let rastreio = 'Processando localização...'
            if (dado.geolocalizacao) {
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
                <td>
                    ${imagens !== '' ? `<div class="fotos">${imagens}</div>` : 'Sem Imagens'}
                </td>
            </tr>
        `
    }

    const loja = dados_clientes?.[ocorrencia?.unidade] || {}

    const acumulado = `
        <div style="${vertical}; padding: 1rem; background-color: #efefefff;">

            <span style="font-size: 1.2rem;"><b>Dados da Loja</b></span>
            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: left; gap: 1rem;">
                <div style="${vertical}">
                    ${modelo('Loja', loja?.nome || '...')}
                    ${modelo('Endereço', loja?.bairro || '...')}
                </div>

                <div style="${vertical}">
                    ${modelo('Cidade', loja?.cidade || '...')}
                    ${modelo('Cep', loja?.cep || '...')}
                </div>
            </div>

            <hr style="width: 100%;">
            <span style="font-size: 1.2rem;"><b>Correções</b></span>
            <div class="blocoTabela">
                <div class="painelBotoes"></div>
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


function ampliarImagem(img) {

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 0.5rem;">

            <img src="${img.src}" style="width: 100%;">

        </div>
    `

    popup(acumulado, 'Imagem', true)

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
