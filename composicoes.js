let filtrosAtivos = {}
let filtroAgrupamentos = {}
let divComposicoes = document.getElementById('composicoes')
let cabecalhos = []
const usuariosPermitidosParaEditar = ['log', 'editor', 'adm', 'gerente', 'diretoria', 'coordenacao'];

const alerta = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
    `

function criar_lpu() {
    popup(`
        <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
            <label style="font-size: 1.2em;">Digite o nome da nova LPU:</label>
            <input id="nome-lpu" type="text" placeholder="Ex: LPU Novo" style="padding: 10px; width: 80%; border-radius: 5px;">
            <label id="texto-aviso" style="display: none; color: red;"></label>
            <button onclick="salvarNovaLPU()" style="background-color: #026CED; color: white; padding: 10px; border: none; cursor: pointer; width: 80%;">Salvar</button>
        </div>
    `, 'Nova LPU');
}

carregarTabelaComposicoes()

async function recuperar_composicoes() {

    overlayAguarde()
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let nuvem = await receber('dados_composicoes')

    let dadosMescladosComposicoes = {
        ...dados_composicoes,
        ...nuvem
    }

    await inserirDados(dadosMescladosComposicoes, 'dados_composicoes')
    await carregarTabelaComposicoes()
    removerPopup()
}

async function carregarTabelaComposicoes() {

    if (document.title !== 'COMPOSIÇÕES') return

    let adicionar_item = document.getElementById('adicionar_item')
    let permitidos = ['adm', 'editor', 'gerente', 'diretoria', 'coordenacao']

    adicionar_item.style.display = permitidos.includes(acesso.permissao) ? 'flex' : 'none'

    const dados_composicoes = await recuperarDados('dados_composicoes') || {};

    if (Object.keys(dados_composicoes).length == 0) return await recuperar_composicoes();

    let thead = '';
    let tbody = '';
    let tsearch = '';
    cabecalhos = [
        ...new Set(
            Object.values(dados_composicoes)
                .flatMap(obj => Object.keys(obj).filter(k => !["timestamp", "id", "categoria de equipamento", "descricaocarrefour"].includes(k)))
        )
    ];

    let modoClone = JSON.parse(sessionStorage.getItem('modoClone')) || false
    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    let modo = modoClone ? 'clone' : 'antigos'
    if (!colunasComposicoes[modo]) {
        colunasComposicoes[modo] = []
    }

    let colunas = colunasComposicoes[modo]

    if (!divComposicoes) return
    divComposicoes.innerHTML = '';

    let ths = {};
    let tsc = {};

    cabecalhos.forEach(cab => {
        ths[cab] = `<th style="position: relative; cursor: pointer; text-align: left;">${inicialMaiuscula(cab)}</th>`
        tsc[cab] = `
            <th style="background-color: white;">
                <div style="display: flex; align-items: center; justify-content: center;">
                    <input>
                    <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                </div>
            </th>`
    });

    colunas.forEach(col => {
        thead += ths[col];
        tsearch += tsc[col];
    });

    let composicoesOrdenadas = Object.entries(dados_composicoes).sort((a, b) => b[1].timestamp - a[1].timestamp)
    const camposFlexiveis = ['imagem', 'sistema'] // Mesmo que não existam, devem aparecer;
    for (let [codigo, produto] of composicoesOrdenadas) {
        let tds = {};

        for (const chave of colunas) {

            if (!produto[chave] && !camposFlexiveis.includes(chave) && !chave.includes('lpu')) {
                tds[chave] = `<td></td>`
                continue
            }

            let conteudo = produto[chave] || '';
            let alinhamento = 'left';

            if (chave == 'imagem') {
                alinhamento = 'center';
                conteudo = `
                <img src="${conteudo || logo}" style="width: 4vw; cursor: pointer;" name="${codigo}"
                ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? `onclick="abrirImagem('${codigo}')"` : ''}>`;

            } else if (chave.includes('lpu')) {
                let preco_final = 0;
                if (dicionario(produto[chave]) && produto[chave].historico && Object.keys(produto[chave].historico).length > 0 && produto[chave].ativo) {
                    let ativo = produto[chave].ativo;
                    preco_final = produto[chave].historico?.[ativo]?.valor || 0;
                }

                conteudo = `
                    <label class="labelAprovacao" style="background-color: ${preco_final > 0 ? 'green' : '#B12425'};" 
                    ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? `onclick="abrirHistoricoPrecos('${codigo}', '${chave}')"` : ''}> 
                    ${dinheiro(conversor(preco_final))}</label>`;

            } else if (chave == 'agrupamentos') {

                let info_agrupamentos = ''

                if (produto[chave]) {
                    let agrupamentos = produto[chave]

                    for (item in agrupamentos) {

                        let tipo = dados_composicoes[item]?.tipo || '??'

                        info_agrupamentos += `
                            <div style="display: flex; gap: 3px; align-items: center; justify-content: left;">
                                <label class="numero" style="width: 20px; height: 20px; padding: 3px; background-color: ${tipo == 'VENDA' ? 'green' : '#B12425'}">${agrupamentos[item]}</label>
                                <label style="font-size: 0.6em; text-align: left;">${String(dados_composicoes[item]?.descricao || '??').slice(0, 10)}...</label>
                            </div>
                            `
                    }
                }

                conteudo = `
                    <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                        <img src="imagens/construcao.png" style="width: 2vw; cursor: pointer;" onclick="abrir_agrupamentos('${codigo}')">
                        <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; gap: 2px;">
                            ${info_agrupamentos}
                        </div>
                    </div>
                    `
                alinhamento = 'center';

            } else if (chave == 'sistema' || chave == 'categoria de equipamento' || chave == 'tipo') {

                let opcoes = ''

                esquemas[chave].forEach(op => {
                    opcoes += `<option ${produto?.[chave] == op ? 'selected' : ''}>${op}</option>`
                })

                conteudo = `
                <select 
                    class="opcoesSelect" 
                    onchange="alterarChave('${codigo}', '${chave}', this)"
                    ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? '' : 'disabled'}>
                    ${opcoes}
                </select>
                `
            }

            tds[chave] = `<td style="text-align: ${alinhamento}; max-width: 200px;">${conteudo}</td>`;
        }

        tds.editar = `<td style="width: 70px;">
                        <img 
                            src="imagens/editar.png" 
                            style="width: 2vw; cursor: pointer;" 
                            ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? `onclick="cadastrar_editar_item('${codigo}')"` : ''}
                        >
                    </td>`;

        let celulas = '';
        colunas.forEach(col => {
            if (tds[col] !== undefined) {
                celulas += tds[col];
            }
        });

        tbody += `<tr id="tr_${codigo}">${celulas}</tr>`;
    }

    let acumulado = `
        <div style="display: flex; gap: 10px;">
            <div style="resize: both; overflow: auto; height: max-content; max-height: 70vh; width: max-content; max-width: 92.5vw; background-color: #d2d2d2; border-radius: 3px;">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${thead}</tr>
                        <tr>${tsearch}</tr>
                    </thead>
                    <tbody id="linhasComposicoes">
                        ${tbody}
                    </tbody>
                </table>
            </div>
        </div>`;

    divComposicoes.innerHTML = acumulado;

    atribuirFuncoesCabecalho()

}

async function retomarPaginacao() {

    if (document.title == 'Criar Orçamento') return await tabelaProdutos()

    await carregarTabelaComposicoes()

    if (Object.keys(filtrosAtivos).length == 0) return

    try {
        let tabela = document.getElementById('tabela_composicoes')
        let thead = tabela.querySelector('thead')
        let tsearch = thead.querySelectorAll('tr')[1]
        let ths = tsearch.querySelectorAll('th')

        for (col in filtrosAtivos) {
            ths[col].querySelector('input').value = filtrosAtivos[col]
            pesquisarGenerico(col, filtrosAtivos[col], filtrosAtivos, 'linhasComposicoes')
        }
    } catch {
        popup(`Não foi possível retomar a paginação`)
    }
}

function atribuirFuncoesCabecalho() {

    // Inclusão do evento click nos cabeçalhos;
    let tabela = document.getElementById('tabela_composicoes')
    let thead = tabela.querySelector('thead')
    let trs = thead.querySelectorAll('tr')

    for (let i = 0; i <= 1; i++) {

        let tr = trs[i]
        let ths = tr.querySelectorAll('th')

        ths.forEach((th, j) => {

            if (i == 0) { // Primeiro cabeçalho
                th.addEventListener('click', function () {
                    filtrar_tabela(j, 'tabela_composicoes', this)
                })

            } else { // Segundo, com Inputs;
                th.querySelector('input').addEventListener('input', function () {
                    pesquisarGenerico(j, this.value, filtrosAtivos, 'linhasComposicoes')
                })

            }
        })
    }
}

async function abrirFiltros() {

    let acumulado = ''
    let modoClone = JSON.parse(sessionStorage.getItem('modoClone')) || false
    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    let modo = modoClone ? 'clone' : 'antigos'
    if (!colunasComposicoes[modo]) {
        colunasComposicoes[modo] = []
    }

    let colunas = colunasComposicoes[modo]
    let opcoes = ''

    cabecalhos.sort() // Alfabética;
    cabecalhos.forEach(cabecalho => {
        opcoes += `
        <label>
            <input type="checkbox" value="${cabecalho}" ${colunas.includes(cabecalho) ? 'checked' : ''}> ${inicialMaiuscula(cabecalho)}
        </label>
        `
    })

    acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

            <div style="margin-left: 1vw; ${horizontal}; background-color: white; border-radius: 5px; padding-left: 1vw; padding-right: 1vw;">
                <input oninput="filtrarColunas(this.value)" placeholder="Pesquisar colunas" style="width: 100%;">
                <img src="imagens/pesquisar2.png" style="width: 1.5vw; padding: 0.5vw;">
            </div>

            <br>

            <div style="${horizontal}; gap: 10px;">
                <input class="todos" type="checkbox" onchange="marcarTodos(this)">
                <span>Selecionar Todos</span>
            </div>

            <br>

            <div id="filtrosColunas" class="lista-filtros">
                ${opcoes}
            </div>

            <hr style="width: 100%;">

            ${botao('Salvar', 'aplicarFiltros()', '#4CAF50')}

        </div>
    `

    popup(acumulado, 'Filtrar Itens')

}

function filtrarColunas(termo) {

    termo = String(termo).toLowerCase()
    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let texto = label.textContent.toLowerCase()
        texto.includes(termo) ? label.style.display = 'flex' : label.style.display = 'none'
    })

}

function marcarTodos(inputTodos) {

    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let input = label.querySelector('input')
        input.checked = inputTodos.checked
    })

}

async function aplicarFiltros() {

    let colunas = []
    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let input = label.querySelector('input')
        if (input.checked) {
            colunas.push(input.value)
        }
    })

    let modoClone = JSON.parse(sessionStorage.getItem('modoClone')) || false
    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    let modo = modoClone ? 'clone' : 'antigos'
    if (!colunasComposicoes[modo]) {
        colunasComposicoes[modo] = []
    }

    colunasComposicoes[modo] = colunas

    localStorage.setItem('colunasComposicoes', JSON.stringify(colunasComposicoes))
    removerPopup()

    await carregarTabelaComposicoes()

}

async function alterarChave(codigo, chave, select) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let produto = dados_composicoes[codigo]

    produto[chave] = select.value

    enviar(`dados_composicoes/${codigo}/${chave}`, select.value)

    await inserirDados(dados_composicoes, 'dados_composicoes')

    if (document.title == 'Criar Orçamento') await carregarTabelas()
}

async function atualizar_status_material(codigo, elemento) {

    var resposta = elemento.checked
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}
    dados_composicoes[codigo]['material infra'] = resposta
    await inserirDados(dados_composicoes, 'dados_composicoes')

    await enviar(`dados_composicoes/${codigo}/material infra`, resposta)

    carregarTabelaComposicoes()

}

async function abrir_agrupamentos(codigo) {

    let acumulado = ''
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]
    let linhas = ''

    for (item in dados_composicoes) {
        let checked = ''

        if (produto.agrupamentos && produto.agrupamentos[item]) {
            checked = 'checked'
        }
        let tr = `
        <tr>
            <td style="white-space: normal; text-align: center;"><input type="checkbox" style="width: 4vw;" onclick="incluir_agrupamento(this)" ${checked}></td>
            <td style="white-space: normal;">${item}</td>
            <td style="white-space: normal;">${dados_composicoes[item].descricao}</td>
            <td style="white-space: normal;">${dados_composicoes[item].modelo}</td>
            <td style="white-space: normal;">${dados_composicoes[item].unidade}</td>
            <td style="white-space: normal;">${dados_composicoes[item].tipo}</td>
        </tr>
        `
        linhas += tr
    }

    let ths = ''
    let campos = ['Código', 'Descrição', 'Modelo', 'Unidade', 'Tipo']

    campos.forEach((campo, i) => {
        i++
        ths += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" placeholder="${campo}" oninput="pesquisarGenerico(${i}, this.value, filtroAgrupamentos, 'linhas_agrupamentos')">
            </th>
        `
    })

    acumulado += `

        <div class="agrupamentos">
            <div style="display: flex; gap: 10px; align-items: center; justify-content: left;">
                <img src="${produto?.imagem || logo}" style="width: 100px">
                <h2>${produto.descricao}</h2>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-evenly; gap: 10px;">
                <div id="div_agrupamentos" style="display: flex; flex-direction: column; align-items: start; justify-content: left;">
                </div>
                <label class="contorno_botoes" style="background-color: #026CED;" onclick="salvar_agrupamentos('${codigo}')">Salvar Agrupamentos</label>
            </div>

            <hr style="width: 100%; margin: 10px;">

                <table class="tabela" style="border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th>Marcação</th>
                            <th>Código</th>
                            <th>Descrição</th>
                            <th>Modelo</th>
                            <th>Unidade</th>
                            <th>Tipo</th>
                        <tr>
                    </thead>
                    <thead>
                        <tr>
                            <th style="background-color: white; position: relative; border-radius: 0px;">
                                <select onchange="checked_inputs(this)">
                                    <option>Todos</todos>
                                    <option>Marcados</todos>
                                    <option>Não Marcados</todos>
                                </select>
                            </th>
                            ${ths}
                        <tr>
                    </thead>
                    <tbody id="linhas_agrupamentos">
                        ${linhas}
                    </tbody>
                </table>


        </div>    
    `
    popup(acumulado, 'Agrupamentos')

    if (produto.agrupamentos) {
        var div_agrupamentos = document.getElementById('div_agrupamentos')
        if (div_agrupamentos) {
            for (item in produto.agrupamentos) {
                incluir_agrupamento(undefined, item, produto.agrupamentos[item])
            }
        }
    }

}

async function salvar_agrupamentos(codigo) {

    var div_agrupamentos = document.getElementById('div_agrupamentos')
    var agrupamentos = div_agrupamentos.querySelectorAll('.agrupado')
    var dados_composicoes = await recuperarDados('dados_composicoes') || {}

    if (dados_composicoes[codigo]) {

        let produto = dados_composicoes[codigo]
        produto.agrupamentos = {}

        agrupamentos.forEach(agrupamento => {
            var codigo_agrupamento = agrupamento.querySelectorAll('label')[0].textContent
            produto.agrupamentos[codigo_agrupamento] = Number(agrupamento.querySelector('input').value)

        })

        await inserirDados(dados_composicoes, 'dados_composicoes')

        await enviar(`dados_composicoes/${codigo}/agrupamentos`, produto.agrupamentos)

        removerPopup()

        await retomarPaginacao()
    }

    if (document.title == 'Criar Orçamento') f5()

}

function checked_inputs(filtro) {
    var linhas_agrupamentos = document.getElementById('linhas_agrupamentos')
    var filtrar = filtro.value

    if (linhas_agrupamentos) {

        var trs = linhas_agrupamentos.querySelectorAll('tr')

        trs.forEach(tr => {

            var tds = tr.querySelectorAll('td')

            var mostrar_linha = false

            var check = tds[0].querySelector('input').checked

            if (filtrar == 'Todos') {

                mostrar_linha = true

            } else if (filtrar == 'Marcados') {

                if (check) {
                    mostrar_linha = true
                } else {
                    mostrar_linha = false
                }

            } else if (filtrar == 'Não Marcados') {

                if (!check) {
                    mostrar_linha = true
                } else {
                    mostrar_linha = false
                }
            }

            if (mostrar_linha) {
                tr.style.display = 'table-row'
            } else {
                tr.style.display = 'none'
            }

        })
    }
}

async function incluir_agrupamento(elemento, cod, qtde) {

    var codigo = ''
    var descricao = ''
    var modelo = ''
    var unidade = ''
    var tipo = ''
    var quantidade = 0

    if (cod !== undefined) {
        var dados_composicoes = await recuperarDados('dados_composicoes') || {}
        var produto = dados_composicoes[cod]
        codigo = cod
        descricao = produto.descricao
        modelo = produto.modelo
        unidade = produto.unidade
        tipo = produto.tipo
        quantidade = qtde
    }

    var div_agrupamentos = document.getElementById('div_agrupamentos')

    if (div_agrupamentos) {

        if ((elemento !== undefined && elemento.checked) || cod !== undefined) {

            if (elemento !== undefined && elemento.checked) {
                var tr = elemento.parentElement.parentElement
                codigo = tr.querySelectorAll('td')[1].textContent
                descricao = tr.querySelectorAll('td')[2].textContent
                modelo = tr.querySelectorAll('td')[3].textContent
                unidade = tr.querySelectorAll('td')[4].textContent
                tipo = tr.querySelectorAll('td')[5].textContent
            }

            var cor = 'green'
            if (tipo == 'VENDA') {
                cor = '#B12425'
            }

            var item = `
            <div class="agrupado" style="border: solid 1px ${cor};">
                <img src="imagens/excluir.png" style="width: 4vw; cursor: pointer;" onclick="remover_item(this)">
                <label>${codigo}</label>
                <label>${descricao} - ${modelo} - ${unidade}</label>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label>Quantidade</label>
                    <input style="padding: 5px; background-color: green; color: white; border-radius: 3px; width: 100px; text-align: center;" type="number" value="${quantidade}">
                </div>
            </div>
            `
            div_agrupamentos.insertAdjacentHTML('beforeend', item)
        }
    }
}

function remover_item(elemento) {
    elemento.parentElement.remove()
}

async function abrirHistoricoPrecos(codigo, tabela) {

    let marcado = ''
    let acumulado = ''
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]

    if (!produto[tabela]) {
        produto[tabela] = {}
    }

    if (!produto[tabela].historico) {
        produto[tabela].historico = {}
    }

    let historico = produto[tabela].historico
    let linhas = ''

    for (cotacao in historico) {
        produto[tabela].ativo == cotacao ? marcado = 'checked' : marcado = ''

        linhas += `
        <tr>
            <td>${dinheiro(historico[cotacao]?.custo || 0)}</td>
            <td>${dinheiro(historico[cotacao]?.valor_custo || historico[cotacao]?.custo)}</td>
            <td style="text-align: center;">${historico[cotacao].margem}</td>
            <td>${dinheiro(historico[cotacao].valor)}</td>
            <td>${historico[cotacao].data}</td>
            <td>${historico[cotacao].usuario}</td>
            <td>${historico[cotacao].fornecedor}</td>

            <td>
                <input type="radio" name="preco" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvar_preco_ativo('${codigo}', '${cotacao}', '${tabela}')" ${marcado}>
            </td>
            
            <td><textarea style="border: none;" readOnly>${historico[cotacao]?.comentario || ''}</textarea></td>
            <td style="text-align: center;">
                <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer;" onclick="excluir_cotacao('${codigo}', '${tabela}', '${cotacao}')">
            </td>
            <td style="text-align: center;">
                <img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="adicionarCotacao('${codigo}', '${tabela}', '${cotacao}')">
            </td>
        </tr>
        `
    }

    acumulado = `

    <div style="min-width: 40vw; display: flex; justify-content: left; align-items: start; flex-direction: column; background-color: white; padding: 5px; border-radius: 5px; color: #222;">
        <div id="historico_preco" style="display: flex; flex-direction: column; align-items: start; justify-content: center; position: relative; width: 100%;">
            
            <div style="display: flex; justify-content: left; align-items: center; gap: 5px;">
                <img style="width: 7vw;" src="${dados_composicoes[codigo]?.imagem || logo}">
                <div style="color: #222; display: flex; flex-direction: column; justify-content: start; align-items: start;">
                    <label style="font-size: 0.8vw;">Descrição</label>
                    <label>${dados_composicoes[codigo].descricao}</label>
                </div>
            </div>

            <div style="position: absolute; top: 3px; right: 3px; display: flex; align-items: start; justify-content: center; flex-direction: column;">

                <div onclick="adicionarCotacao('${codigo}', '${tabela}')" class="bot_adicionar">
                    <img src="imagens/preco.png">
                    <label>Adicionar Preço</label>
                </div>

            </div>

            <label>Histórico de Preços</label>

            <hr style="width: 100%;">

            <div id="tabela_historico" style="display: ${linhas == '' ? 'none' : 'flex'}; border-radius: 3px; padding: 3px; justify-content: center; align-items: center;">
                <table class="tabela">
                    <thead>
                        <th>Preço Unitário</th>
                        <th>Valor de Custo</th>
                        <th>Margem %</th>
                        <th>Pr. Venda</th>
                        <th>Data</th>
                        <th>Usuário</th>
                        <th>Fornecedor</th>
                        <th>Ativo</th>
                        <th>Comentário</th>
                        <th>Excluir</th>
                        <th>Detalhes</th>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
        </div>
    </div>
    `

    popup(acumulado, 'Valores de Venda')

}

async function salvar_preco_ativo(codigo, id_preco, lpu) {

    overlayAguarde()

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]

    if (!produto[lpu]) produto[lpu] = {}
    produto[lpu].ativo = id_preco

    try {
        let preco_atual = produto[lpu]?.historico?.[id_preco]?.valor;
        let precoFormatado = parseFloat(preco_atual).toFixed(2)
        let comentario = `O usuário ${acesso.usuario} atualizou o preço para ${precoFormatado}`
        registrarAlteracao('dados_composicoes', codigo, comentario)
    } catch {
        console.log('Ouvinte no registro de ativação de preço falhou.');
    }

    await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, id_preco)
    await inserirDados(dados_composicoes, 'dados_composicoes')
    removerOverlay()

    if (document.title == 'Criar Orçamento') return await total(), await tabelaProdutos() // Caso esteja na tela de Orçamentos;

    await retomarPaginacao()

}

async function excluir_cotacao(codigo, lpu, cotacao) {

    overlayAguarde()

    let historico_preco = document.getElementById('historico_preco');
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};

    if (historico_preco) {

        if (dados_composicoes[codigo] && dados_composicoes[codigo][lpu]) {
            let cotacoes = dados_composicoes[codigo][lpu];

            if (cotacoes.ativo == cotacao) {
                cotacoes.ativo = "";
                await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, "");
            }

            let precoExcluido = cotacoes.historico?.[cotacao]?.valor
            let comentario = `O usuário ${acesso.usuario} excluiu o preço de ID: ${cotacao} e valor: ${parseFloat(precoExcluido).toFixed(2)}`
            delete cotacoes.historico[cotacao];

            await inserirDados(dados_composicoes, 'dados_composicoes')
            deletar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`)
            registrarAlteracao('dados_composicoes', codigo, comentario)
        }

        removerPopup()
        await abrirHistoricoPrecos(codigo, lpu);

    }
}

function gerarTabelas(objeto) {

    let acumulado = {}

    for ([chave, campos] of Object.entries(objeto)) {

        let titulos = {
            camposIniciais: 'Campos Iniciais',
            presuncoes: 'Presunções',
            impostos: 'Impostos',
            resultados: 'Resultados',
            complementares: 'Complemetares'
        }

        let linhas = ''

        campos.forEach(campo => {

            let tdInicial = `<td>${campo.label}</td>`
            let tdFinal = `<td id="${campo?.id || ''}""></td>`
            if (chave == 'camposIniciais' || chave == 'complementares') {
                tdFinal = `
                <td style="background-color: ${campo?.cor || ''};">
                    <input 
                    id="${campo?.id || ''}" 
                    autocomplete="off" 
                    type="number" 
                    oninput="calcular('${campo?.id}')"
                    style="text-align: center; width: max-content; background-color: transparent;" 
                    value="${campo?.valor || ''}"
                    ${campo.readOnly ? 'readOnly' : ''}
                    >
                </td>`

            }

            if (chave == 'resultados') {
                tdFinal = `<td><label style="font-size: 0.9vw;" id="${campo?.id || ''}"></label></td>`
            }

            if (campo.label == 'NF de Compra') {
                tdFinal = `
                <td style="text-align: left; background-color: ${campo?.cor || ''};">
                    <input style="text-align: left; background-color: transparent;" id="${campo.id}" value="${campo?.valor || ''}">
                </td>`
            }

            if (campo.label == 'Fornecedor') {
                tdFinal = `
                <td style="text-align: left; background-color: ${campo?.cor || ''};">
                    <input style="text-align: left; background-color: transparent;" id="${campo.id}" value="${campo?.valor || ''}">
                </td>`
            }

            if (campo.label == 'Comentário') {
                tdFinal = `
                <td style="text-align: left; background-color: ${campo?.cor || ''};">
                    <textarea style="background-color: transparent; border: none; padding: 0px;" id="${campo.id}">${campo?.valor || ''}</textarea>
                </td>`
            }

            if (campo.opcoes) {
                let opcoes = ''
                campo.opcoes.forEach(op => { opcoes += `<option ${campo?.valorSelect == op ? 'selected' : ''}>${op}</option>` })
                tdInicial = `
                    <td>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 1vw;">
                            ${campo.label}
                            <select id="${campo.id}_select" onchange="calcular('${campo.id}_select')" class="opcoesSelect" style="width: max-content;">
                                ${opcoes}
                            </select>
                        </div>
                    </td>`
            }

            linhas += `
                <tr>
                    ${tdInicial}
                    ${tdFinal}
                </tr>
                `
        })

        if (chave == 'impostos') {
            linhas += `
            <tr>
                <td style="text-align: right;">Total</td>
                <td id="total_impostos"></td>
            </tr>
            `}

        let tabelaHtml = `
            <div style="display: flex; justify-content: center; align-items: center; flex-direction: column;">
                <br>
                <table class="tabela" style="width: 40vw;">
                    <thead style="background-color: #d2d2d2; position: relative;">
                        <th style="color: black;">${titulos[chave]}</th>
                        <th style="color: black;">Valores</th>
                    </thead>
                    <tbody>
                        ${linhas}
                    </tbody>
                </table>
            </div>
        `

        if (!acumulado[chave]) {
            acumulado[chave] = ''
        }

        acumulado[chave] += tabelaHtml

    }

    return acumulado
}

function modelos(produto) {

    let blocos = {
        'VENDA': {
            camposIniciais: [
                { label: 'Preço Unitário (R$)', cor: '#91b7d9', id: 'custo', valor: produto?.custo || '' },
                { label: 'Frete de Compra (2%)', readOnly: true, id: 'frete' },
                { label: 'ICMS Creditado em nota (%)', valorSelect: produto?.icms_creditado_select, opcoes: ['IMPORTADO', 'NACIONAL', 'BAHIA', '7%'], cor: '#91b7d9', id: 'icms_creditado', valor: produto?.icms_creditado || '' },
                { label: 'Aliquota ICMS (Bahia) (20.5%)', readOnly: true, id: 'icms_aliquota', valor: 20.5 },
                { label: 'ICMS a ser pago (DIFAL) (%)', readOnly: true, id: 'difal', valor: '' },
                { label: 'Valor do ICMS de Entrada (R$)', readOnly: true, id: 'icms_entrada' },
                { label: 'Valor de Custo (R$)', readOnly: true, id: 'valor_custo', valor: produto?.valor_custo || '' },
                { label: 'Margem de Acréscimo (%)', cor: '#91b7d9', id: 'margem', valor: produto?.margem || '' },
                { label: 'Preço de Venda (R$)', cor: '#91b7d9', id: 'preco_venda', valor: produto?.valor || '' },
                { label: 'Frete de Venda (5%)', readOnly: true, id: 'frete_venda' }
            ],
            presuncoes: [
                { label: 'Aliquota do Lucro Presumido Comercio (8%)', id: 'porc_LP' },
                { label: 'Alíquota da Presunção CSLL (12%)', id: 'porc_CSLL' }
            ],
            impostos: [
                { label: 'IRPJ (15%)', id: 'irpj' },
                { label: 'Adicional IRPJ (10%)', id: 'adicional_irpj' },
                { label: 'CSLL (9%)', id: 'csll' },
                { label: 'PIS (0,65%)', id: 'pis' },
                { label: 'COFINS (3%)', id: 'cofins' },
                { label: 'ICMS (%)', id: 'icms_saida', opcoes: ['20,5%', '12%', '4%'] }
            ]
        },
        'SERVIÇO': {
            camposIniciais: [
                { label: 'Preço do Serviço', cor: '#91b7d9', id: 'preco_venda', valor: produto?.valor || '' }
            ],
            presuncoes: [
                { label: 'Aliquota do Lucro Presumido Serviço (32%)', id: 'aliq_presumido' },
                { label: 'Alíquota da Presunção CSLL (32%)', id: 'presuncao_csll' }
            ],
            impostos: [
                { label: 'IRPJ (15%)', id: 'irpj' },
                { label: 'Adicional IRPJ (10%)', id: 'adicional_irpj' },
                { label: 'CSLL (9%)', id: 'presuncao_csll_pagar' },
                { label: 'PIS (0,65%)', id: 'pis' },
                { label: 'COFINS (3%)', id: 'cofins' },
                { label: 'ISS (5%)', id: 'iss' }
            ]
        },
        'USO E CONSUMO': {
            camposIniciais: [
                { label: 'Preço Unitário (R$)', cor: '#91b7d9', id: 'custo', valor: produto?.custo || '' },
                { label: 'Frete de Compra (2%)', readOnly: true, id: 'frete' },
                { label: 'ICMS Creditado em nota (%)', opcoes: ['IMPORTADO', 'NACIONAL', 'BAHIA'], cor: '#91b7d9', id: 'icms_creditado', valorSelect: produto?.icms_creditado_select, valor: produto?.icms_creditado || '' },
                { label: 'Aliquota ICMS (Bahia) (20.5%)', readOnly: true, id: 'icms_aliquota', valor: 20.5 },
                { label: 'ICMS a ser pago (DIFAL) (%)', readOnly: true, id: 'difal', valor: '' },
                { label: 'Valor do ICMS de Entrada (R$)', readOnly: true, id: 'icms_entrada' },
                { label: 'Valor de Custo (R$)', readOnly: true, id: 'valor_custo', valor: produto?.valor_custo || '' },
                { label: 'Margem de Acréscimo (%)', cor: '#91b7d9', id: 'margem', valor: produto?.margem || '' },
                { label: 'Preço de Venda (R$)', cor: '#91b7d9', id: 'preco_venda', valor: produto?.valor || '' },
                { label: 'Frete de Venda (5%)', readOnly: true, id: 'frete_venda' }
            ],
            presuncoes: [
                { label: 'Aliquota do Lucro Presumido Serviço (32%)', id: 'aliq_presumido' },
                { label: 'Alíquota da Presunção CSLL (32%)', id: 'presuncao_csll' }
            ],
            impostos: [
                { label: 'IRPJ (15%)', id: 'irpj' },
                { label: 'Adicional IRPJ (10%)', id: 'adicional_irpj' },
                { label: 'CSLL (9%)', id: 'presuncao_csll_pagar' },
                { label: 'PIS (0,65%)', id: 'pis' },
                { label: 'COFINS (3%)', id: 'cofins' },
                { label: 'ISS (5%)', id: 'iss' }
            ]
        }
    }

    let geral = {
        complementares: [
            { label: 'NF de Compra', id: 'nota', cor: '#91b7d9', valor: produto?.nota || '' },
            { label: 'Fornecedor', id: 'fornecedor', cor: '#91b7d9', valor: produto?.fornecedor || '' },
            { label: 'Comentário', id: 'comentario', cor: '#91b7d9', valor: produto?.comentario || '' }
        ],
        resultados: [
            { label: 'LUCRO LÍQUIDO', id: 'lucro_liquido' },
            { label: 'PERCENTUAL DE LUCRO', id: 'lucro_porcentagem' }
        ]
    }

    blocos[produto.tipo] = {
        ...blocos[produto.tipo],
        ...geral
    }

    return blocos[produto.tipo]
}

async function adicionarCotacao(codigo, lpu, cotacao) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]
    let funcao = cotacao ? `salvarPreco('${codigo}', '${lpu}', '${cotacao}')` : `salvarPreco('${codigo}', '${lpu}')`

    if (lpu && cotacao) {
        produto = {
            ...produto,
            ...produto[lpu].historico[cotacao]
        }
    }

    let tabelas = gerarTabelas(modelos(produto))

    let acumulado = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: start; font-size: 0.7vw; background-color: #d2d2d2; padding: 5px;">
        
        <label style="font-size: 1.5vw;" id="modalidadeCalculo"><strong>${produto.tipo}</strong></label>

        <div style="display: flex;">
            <div id="historico_preco" class="gavetaTabelas">
                ${tabelas.camposIniciais}
                ${tabelas.complementares}
            </div>

            <div id="historico_preco" class="gavetaTabelas">
                ${tabelas.resultados}
                ${tabelas.presuncoes}
                ${tabelas.impostos}
            </div>
        </div>
        <button onclick="${funcao}" style="background-color: #4CAF50;">Salvar Preço</button>

    </div>
    `

    popup(acumulado, 'Gestão de Preço', true)
    calcular()

}

function getElementById(id, valorRetorno) {
    const el = document.getElementById(id);

    if (!el) return '';

    if (valorRetorno !== undefined) {
        if ('value' in el) {
            el.value = valorRetorno;
        } else {
            el.textContent = valorRetorno;
        }
        return;
    }

    let valor = 'value' in el ? el.value : el.textContent;

    if (el.type === 'number') {
        valor = conversor(Number(valor));
    }

    return valor;
}

function calcular(campo, dadosCalculo = null) {

    let modalidadeCalculo = dadosCalculo?.modalidadeCalculo || document.getElementById('modalidadeCalculo').textContent

    let tabelaIcmsSaida = {
        'IMPORTADO': 4,
        'NACIONAL': 12,
        'BAHIA': 20.5,
        '7%': 7
    }

    let lucroLiquido = 0

    function atualizarLucro(valorReferencia, totalImpostos, custoFinal = 0, extras = {}) {
        lucroLiquido = valorReferencia - (totalImpostos + custoFinal)
        let porcentagem = lucroLiquido / valorReferencia * 100
        if (isNaN(porcentagem)) porcentagem = 0

        if (dadosCalculo) {
            return {
                lucroLiquido,
                lucroPorcentagem: porcentagem,
                totalImpostos,
                ...extras
            }
        }

        getElementById('lucro_liquido', dinheiro(lucroLiquido))
        getElementById('lucro_porcentagem', `${porcentagem.toFixed(2)}%`)
        let estilo = lucroLiquido > 0 ? 'lucroPositivo' : 'lucroNegativo'
        document.getElementById('lucro_liquido').classList = estilo
        document.getElementById('lucro_porcentagem').classList = estilo
    }

    if (modalidadeCalculo == 'SERVIÇO') {

        let precoVenda = dadosCalculo?.valor || getElementById('preco_venda')
        let aliqLp = precoVenda * 0.32
        let presuncaoCsll = precoVenda * 0.32
        let irpj = aliqLp * 0.15
        let adicionalIrpj = aliqLp * 0.10
        let presuncaoCsllAPagar = presuncaoCsll * 0.09
        let pis = precoVenda * 0.0065
        let cofins = precoVenda * 0.03
        let iss = precoVenda * 0.05
        let totalImpostos = irpj + adicionalIrpj + presuncaoCsllAPagar + pis + cofins + iss

        if (!dadosCalculo) {
            getElementById('aliq_presumido', dinheiro(aliqLp))
            getElementById('presuncao_csll', dinheiro(presuncaoCsll))
            getElementById('irpj', dinheiro(irpj))
            getElementById('adicional_irpj', dinheiro(adicionalIrpj))
            getElementById('presuncao_csll_pagar', dinheiro(presuncaoCsllAPagar))
            getElementById('pis', dinheiro(pis))
            getElementById('cofins', dinheiro(cofins))
            getElementById('iss', dinheiro(iss))
            getElementById('total_impostos', dinheiro(totalImpostos))
        }

        return atualizarLucro(precoVenda, totalImpostos, 0, {
            freteCompra: 0,
            freteVenda: 0,
            difal: 0,
            margem: 0
        })

    } else if (modalidadeCalculo == 'VENDA') {

        let icmsCreditadoSelect = getElementById('icms_creditado_select')
        let icmsCreditado = dadosCalculo?.icms_creditado || tabelaIcmsSaida[icmsCreditadoSelect]
        let precoCompra = dadosCalculo?.custo || getElementById('custo')
        let frete = precoCompra * 0.02
        let icmsAliquota = 20.5
        let difal = icmsAliquota - icmsCreditado
        let icmsEntrada = difal / 100 * precoCompra
        let valorCusto = icmsEntrada + precoCompra + frete
        let margem = getElementById('margem')
        let precoVenda = (1 + margem / 100) * valorCusto

        if (campo == 'preco_venda' || dadosCalculo) {
            precoVenda = dadosCalculo?.valor || getElementById('preco_venda')
            margem = ((precoVenda / valorCusto - 1) * 100).toFixed(2)
            getElementById('margem', margem)
        } else {
            getElementById('preco_venda', precoVenda.toFixed(2))
        }

        let freteVenda = precoVenda * 0.05
        let porcLP = 0.08
        let porcCSLL = 0.12
        let lucroPresumido = precoVenda * porcLP
        let presuncaoCsll = precoVenda * porcCSLL
        let irpj = lucroPresumido * 0.15
        let adicionalIrpj = lucroPresumido * 0.1
        let csll = presuncaoCsll * 0.09
        let pis = precoVenda * 0.0065
        let cofins = precoVenda * 0.03

        let icmsSaidaSelect = conversor(getElementById('icms_saida_select')) / 100

        let icmsSaida = dadosCalculo?.icmsSaida / 100 || icmsSaidaSelect
        let icms = precoVenda * icmsSaida
        let totalImpostos = irpj + adicionalIrpj + csll + pis + cofins + icms

        if (!dadosCalculo) {
            getElementById('icms_creditado', icmsCreditado)
            getElementById('frete_venda', freteVenda.toFixed(2))
            getElementById('porc_LP', dinheiro(lucroPresumido))
            getElementById('porc_CSLL', dinheiro(presuncaoCsll))
            getElementById('icms_saida_select', icmsSaidaSelect == 0.12 ? '12%' : '20,5%')
            getElementById('icms_saida', dinheiro(icms.toFixed(0)))
            getElementById('frete', frete.toFixed(2))
            getElementById('difal', difal)
            getElementById('icms_entrada', icmsEntrada.toFixed(2))
            getElementById('valor_custo', valorCusto.toFixed(2))
            getElementById('irpj', dinheiro(irpj))
            getElementById('adicional_irpj', dinheiro(adicionalIrpj))
            getElementById('csll', dinheiro(csll))
            getElementById('pis', dinheiro(pis))
            getElementById('cofins', dinheiro(cofins))
            getElementById('total_impostos', dinheiro(totalImpostos))
        }

        return atualizarLucro(precoVenda, totalImpostos, valorCusto + freteVenda, {
            freteCompra: frete,
            freteVenda,
            difal,
            margem: Number(margem)
        })


    } else if (modalidadeCalculo == 'USO E CONSUMO') {

        let icmsCreditadoSelect = getElementById('icms_creditado_select')
        let icmsCreditado = dadosCalculo?.icms_creditado || tabelaIcmsSaida[icmsCreditadoSelect]
        let precoCompra = dadosCalculo?.custo || getElementById('custo')
        let frete = precoCompra * 0.02
        let icmsAliquota = 20.5
        let difal = icmsAliquota - icmsCreditado
        let icmsEntrada = difal / 100 * precoCompra
        let valorCusto = icmsEntrada + precoCompra + frete
        let margem = getElementById('margem')
        let precoVenda = (1 + margem / 100) * valorCusto

        if (campo == 'preco_venda' || dadosCalculo) {
            precoVenda = dadosCalculo?.valor || getElementById('preco_venda')
            margem = ((precoVenda / valorCusto - 1) * 100).toFixed(2)
            getElementById('margem', margem)
        } else {
            getElementById('preco_venda', precoVenda.toFixed(2))
        }

        let freteVenda = precoVenda * 0.05
        let aliqLp = precoVenda * 0.32
        let presuncaoCsll = precoVenda * 0.32
        let irpj = aliqLp * 0.15
        let adicionalIrpj = aliqLp * 0.10
        let presuncaoCsllAPagar = presuncaoCsll * 0.09
        let pis = precoVenda * 0.0065
        let cofins = precoVenda * 0.03
        let iss = precoVenda * 0.05
        let totalImpostos = irpj + adicionalIrpj + presuncaoCsllAPagar + pis + cofins + iss

        if (!dadosCalculo) {
            getElementById('icms_creditado', icmsCreditado)
            getElementById('frete_venda', freteVenda.toFixed(2))
            getElementById('aliq_presumido', dinheiro(aliqLp))
            getElementById('presuncao_csll', dinheiro(presuncaoCsll))
            getElementById('frete', frete.toFixed(2))
            getElementById('difal', difal)
            getElementById('icms_entrada', icmsEntrada.toFixed(2))
            getElementById('valor_custo', valorCusto.toFixed(2))
            getElementById('irpj', dinheiro(irpj))
            getElementById('adicional_irpj', dinheiro(adicionalIrpj))
            getElementById('presuncao_csll_pagar', dinheiro(presuncaoCsllAPagar))
            getElementById('pis', dinheiro(pis))
            getElementById('cofins', dinheiro(cofins))
            getElementById('iss', dinheiro(iss))
            getElementById('total_impostos', dinheiro(totalImpostos))
        }

        return atualizarLucro(precoVenda, totalImpostos, valorCusto + freteVenda, {
            freteCompra: frete,
            freteVenda,
            difal,
            margem: Number(margem)
        })

    }
}


async function salvarPreco(codigo, lpu, cotacao) {

    overlayAguarde()

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let produto = dados_composicoes[codigo]
    let historico = produto[lpu]?.historico || {}
    let preco_venda = getElementById('preco_venda')
    let custo = getElementById('custo')
    let icms_creditado = getElementById('icms_creditado')
    let icms_creditado_select = getElementById('icms_creditado_select')
    let nota = getElementById('nota')
    let comentario = getElementById('comentario')
    let margem = getElementById('margem')
    let fornecedor = getElementById('fornecedor')
    let valor_custo = getElementById('valor_custo')
    let id = cotacao || ID5digitos();
    let modalidade_icms = getElementById('modalidade_icms_select')
    let icms_saida = getElementById('icms_saida')

    // Ouvinte de alterações na composição;
    let comentarioAlteracao = ''
    const entradas = Object.entries(historico)

    if (entradas.length === 0) {
        comentarioAlteracao = `Preço definido para ${dinheiro(preco_venda)}`;
    } else {
        const ordenado = entradas.sort((a, b) => new Date(b[1].data) - new Date(a[1].data));
        const ultimaEntrada = ordenado[0];

        if (ultimaEntrada[0] === id) {
            const precoAnterior = parseFloat(ultimaEntrada[1].valor);
            comentarioAlteracao = `O usuário ${acesso.usuario} alterou o preço de ${precoAnterior.toFixed(2)} para ${dinheiro(preco_venda)}`;
        } else {
            comentarioAlteracao = `O usuário ${acesso.usuario} adicionou novo preço: ${dinheiro(preco_venda)} `
        }
    }
    // Fim do Ouvinte;

    historico[id] = {
        valor: preco_venda,
        data: obterDatas('completa'),
        usuario: acesso.usuario,
        nota: nota || '',
        comentario: comentario || '',
        margem: margem,
        fornecedor: fornecedor || '',
        custo: custo,
        valor_custo: valor_custo,
        icms_creditado: icms_creditado,
        icms_creditado_select: icms_creditado_select,
        modalidade_icms: modalidade_icms,
        icms_saida: icms_saida
    };

    // Verificar antes se a porcentagem é aceitável;
    let resultado = calcular(undefined, historico[id])
    if (resultado.lucroPorcentagem < 10 && acesso.permissao !== 'diretoria') return popup(alerta('Percentual de lucro não pode ser menor que 10%'), 'ALERTA', true)

    produto[lpu] = produto[lpu] || { historico: {} };
    produto[lpu].historico = historico;

    await inserirDados(dados_composicoes, 'dados_composicoes')
    removerPopup()
    await abrirHistoricoPrecos(codigo, lpu);

    enviar(`dados_composicoes/${codigo}/${lpu}/historico/${id}`, historico[id])
    registrarAlteracao('dados_composicoes', codigo, comentarioAlteracao)
}

function remover_esta_linha(elemento) {
    let tr = elemento.closest('tr')
    tr.remove()
}

async function cadastrar_editar_item(codigo) {

    let colunas = ['descricao', 'fabricante', 'modelo', 'unidade', 'ncm', 'tipo', 'omie']

    let modoClone = JSON.parse(sessionStorage.getItem('modoClone')) || false
    if (!modoClone) colunas.push('descricaocarrefour')

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}
    let dados = dados_composicoes[codigo] || {}

    let funcao = codigo ? `salvarServidor('${codigo}')` : `salvarServidor()`
    let elementos = ''

    colunas.forEach(col => {
        let valor = codigo !== undefined ? dados?.[col] : ''
        let campo = `<input style="background-color: #a2d7a4; padding: 5px; border-radius: 3px;" value="${valor}">`

        if (col.includes('desc')) {
            campo = `
            <textarea rows="3" style="color: #222; background-color: #a2d7a4; width: 95%; border: none;">${valor}</textarea>
            `
        } else if (col == 'tipo') {

            let opcoes = ''
            esquemas.tipo.forEach(op => {
                opcoes += `<option ${op == valor ? 'selected' : ''}>${op}</option>`
            })

            campo = `
            <div>
                <select style="width: 100%; cursor: pointer; background-color: #a2d7a4; border-radius: 3px; padding: 3px;">
                    ${opcoes}
                </select>
            </div>
            `
        }

        if (
            !col.includes('lpu')
            &&
            col !== 'codigo' &&
            col !== 'imagem' &&
            col !== 'agrupamentos' &&
            col !== 'material infra' &&
            col !== 'parceiro') {
            elementos += `
            <div style="display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: start;">
                <label>${col}</label>
                ${campo}
            </div>
            `
        }
    })

    var acumulado = `
    
    ${codigo ? `
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px; position: absolute; bottom: 5px; right: 15px; ">
        <label style="font-size: 0.7em;">${codigo}</label>
        <img src="imagens/cancel.png" style="width: 15px; cursor: pointer;" onclick="confirmarExclusao_item('${codigo}')">
    </div>` : ''}

    <div id="cadastrar_item" style="width: 30vw; background-color: white; color: #222; padding: 5px; border-radius: 5px; margin: 1vw;">

        <div id="elementos">
            ${elementos}
        </div>

        <br>

        <button style="background-color: #4CAF50; margin: 0px;" onclick="${funcao}">Salvar</buttton>
    </div>
    `
    popup(acumulado, 'Dados do Item')
}

async function confirmarExclusao_item(codigo) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    removerPopup()

    popup(`
        <div style="padding: 2vw; background-color: #d2d2d2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                <img src="gifs/alerta.gif">
                <label>Tem certeza que deseja excluir este item?</label>
            </div>
            <label style="font-size: 0.7em;">${dados_composicoes[codigo].descricao}</label>
            <button onclick="exclusao_item('${codigo}')">Confirmar</button>
        </div>
        `, 'Tem certeza?')

}

async function exclusao_item(codigo) {

    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    if (dados_composicoes[codigo]) {

        let comentario = `O item ${codigo}, descrição ${dados_composicoes[codigo].descricao} foi excluído`
        registrarAlteracao('dados_composicoes', codigo, comentario)

        delete dados_composicoes[codigo]

        deletar(`dados_composicoes/${codigo}`)
        await inserirDados(dados_composicoes, 'dados_composicoes')

        const trProduto = document.getElementById(`tr_${codigo}`)

        if (trProduto) trProduto.remove()

        removerPopup()
    }

}

async function salvarServidor(codigo) {

    overlayAguarde()
    let novoCadastro = false
    let dados_composicoes = await recuperarDados('dados_composicoes') || {};
    let comentario = ''
    let descricaoProduto = ''

    if (!codigo) {
        novoCadastro = true

        let resposta = await verificarCodigoExistente();

        if (resposta.status == 'Falha') {
            let mensagem = `
            <div id="aviso_campo_branco" style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Não foi possível cadastrar o item... tente novamente</label>
            </div>
            `
            return popup(mensagem, 'Aviso')
        }

        codigo = resposta.status // Aqui é retornado o último número sequencial +1 para cadasto;
    }

    if (!dados_composicoes[codigo]) dados_composicoes[codigo] = {};

    let elementos = document.getElementById('elementos')
    let dadosAtualizados = {};
    let divs = elementos.querySelectorAll('div');

    divs.forEach(div => {
        let item = div.querySelector('label');
        let valor = div.querySelector('input') || div.querySelector('textarea') || div.querySelector('select');
        if (item?.textContent == 'descricao') valor.value = String(valor.value).toUpperCase()
        if (item && valor) dadosAtualizados[item.textContent] = valor.value;

    });

    descricaoProduto = dadosAtualizados.descricao

    if (novoCadastro) {
        comentario = `Produto cadastrado com código ${codigo} e descrição: ${descricaoProduto}`
    } else {
        comentario = `Produto alterado com código ${codigo} e descrição: ${descricaoProduto}`
    }

    dadosAtualizados.codigo = codigo;

    dados_composicoes[codigo] = { ...dados_composicoes[codigo], ...dadosAtualizados };

    await inserirDados(dados_composicoes, 'dados_composicoes')

    await retomarPaginacao()
    removerPopup()

    if (document.title == 'Criar Orçamento') await tabelaProdutos()

    await enviar(`dados_composicoes/${codigo}`, dados_composicoes[codigo]);
    registrarAlteracao('dados_composicoes', codigo, comentario)

}

async function verificarCodigoExistente() {
    return new Promise((resolve, reject) => {

        let modoClone = JSON.parse(sessionStorage.getItem('modoClone')) || false

        fetch("https://leonny.dev.br/codigo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clone: modoClone })
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
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

function salvarNovaLPU() {
    let inputLPU = document.getElementById("nome-lpu");
    let nomeLPU = inputLPU.value.trim();
    let texto_aviso = document.getElementById("texto-aviso")

    if (nomeLPU === "") {
        return popup('Digite um nome válido para a LPU!', 'Aviso', true);
    }

    nomeLPU = nomeLPU.toLowerCase(); // Converte para maiúsculas

    // Recupera LPUs já salvas ou cria um array vazio
    let lpusCriadas = JSON.parse(localStorage.getItem("lpus_criadas")) || [];

    if (lpusCriadas.includes(nomeLPU)) {
        texto_aviso.style.display = "flex"
        texto_aviso.textContent = "Essa LPU já existe!!!"
        return;
    }

    if (!nomeLPU.includes("lpu")) {
        texto_aviso.style.display = "flex"
        texto_aviso.textContent = "É necessário ter LPU no nome!!!"
        return;
    }

    // Adiciona a nova LPU e salva no localStorage
    lpusCriadas.push(nomeLPU);
    localStorage.setItem("lpus_criadas", JSON.stringify(lpusCriadas));

    removerPopup();
}

async function para_excel() {
    const tabela = document.getElementById('tabela_composicoes');
    if (!tabela) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Preços');

    const trs = tabela.querySelectorAll('tr');

    for (let rowIndex = 0; rowIndex < trs.length; rowIndex++) {
        const tr = trs[rowIndex];
        const tds = tr.querySelectorAll('td, th');
        let row = [];

        for (let colIndex = 0; colIndex < tds.length; colIndex++) {
            const td = tds[colIndex];
            const img = td.querySelector('img');

            if (img) {
                try {
                    const response = await fetch(img.src);
                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();

                    const extension = img.src.includes('.png') ? 'png' : 'jpeg';
                    const imageId = workbook.addImage({
                        buffer: arrayBuffer,
                        extension: extension
                    });

                    worksheet.addImage(imageId, {
                        tl: { col: colIndex, row: rowIndex },
                        ext: { width: img.width || 100, height: img.height || 100 }
                    });

                    row.push(null);
                } catch (e) {
                    row.push(''); // imagem ignorada silenciosamente
                }
            } else {
                const select = td.querySelector('select');
                const input = td.querySelector('input');

                if (select) {
                    row.push(select.value);
                } else if (input) {
                    row.push(input.value);
                } else {
                    row.push(td.textContent.trim());
                }
            }
        }

        worksheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lpu-com-imagens.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
