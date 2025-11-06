let filtrosAtivos = {}
let filtroAgrupamentos = {}
let dados_composicoes = null
let divComposicoes = document.getElementById('composicoes')
let cabecalhos = []
let colunas = []
const camposFlexiveis = ['imagem', 'sistema', 'editar']
const usuariosPermitidosParaEditar = ['log', 'editor', 'adm', 'gerente', 'diretoria', 'coordenacao']
let codigoMaster = null

const alerta = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
    `

async function atualizarComposicoes() {
    await sincronizarDados('dados_composicoes')
    await telaComposicoes(true)
}

async function telaComposicoes(recriar) {

    overlayAguarde()
    dados_composicoes = await recuperarDados('dados_composicoes')

    cabecalhos = [
        'editar',
        ...new Set(
            Object.values(dados_composicoes)
                .filter(produto => produto.origem == origem)
                .flatMap(obj =>
                    Object.keys(obj).filter(k =>
                        !['timestamp', 'status', 'grupo', 'refid', 'sapid', 'subgrupo', 'locacao', 'parceiro', 'partnumber', 'id', 'material infra', 'setor', 'origem', 'agrupamentos', 'categoria de equipamento', 'descricaocarrefour'].includes(k)
                    )
                )
        )
    ]

    let ths = ''
    let pesquisa = ''
    cabecalhos.forEach((cab, i) => {
        ths += `<th name="${cab}" data-indice="${i}"  onclick="filtrarAAZ('${i}', 'tabela_composicoes', this)" style="position: relative; cursor: pointer; text-align: left;">${inicialMaiuscula(cab)}</th>`
        pesquisa += `<th style="text-align: left; background-color: white;" oninput="pesquisarGenerico('${i}', this.textContent, filtrosAtivos, 'linhasComposicoes')" contentEditable="true"></th>`
    });

    const acumulado = `
        <div style="${vertical}; width: 95vw;">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="linhasComposicoes"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
        `

    const tabela_composicoes = document.getElementById('tabela_composicoes')
    if (recriar || !tabela_composicoes) tela.innerHTML = acumulado;

    let idsAtivos = []
    for (let [codigo, produto] of Object.entries(dados_composicoes).reverse()) {
        if (produto.origem !== origem) continue
        idsAtivos.push(codigo)
        criarLinhaComposicao(codigo, produto)
    }

    // Trecho para eleminar linhas incoerentes;
    const linhas = document.getElementById('linhasComposicoes')
    const trs = linhas.querySelectorAll('tr')
    const idsAtuais = Array.from(trs).map(tr => tr.id).filter(id => id)
    for (const idAtual of idsAtuais) {
        if (!idsAtivos.includes(idAtual)) document.getElementById(idAtual).remove()
    }

    criarMenus('composicoes')
    esconderColunas()
    removerOverlay()
}

function esconderColunas() {
    const visiveis = JSON.parse(localStorage.getItem('colunasComposicoes'))?.[origem] || 'novos';
    if (!visiveis) return

    const table = document.querySelector("#linhasComposicoes").closest("table");
    if (!table) return;

    for (const campo of cabecalhos) {
        const th = table.querySelector(`th[name="${campo}"]`);
        if (!th) continue;

        const idx = th.cellIndex;
        const mostrar = visiveis.includes(campo);

        th.style.display = mostrar ? "" : "none";

        table.querySelectorAll("tr").forEach(tr => {
            const cell = tr.cells[idx];
            if (cell && cell !== th) {
                cell.style.display = mostrar ? "" : "none";
            }
        });
    }
}

function criarLinhaComposicao(codigo, produto) {

    let tds = ''

    for (const chave of cabecalhos) {
        let conteudo = produto?.[chave] || '';
        let alinhamento = 'left';

        if (chave == 'editar') {
            alinhamento = 'center'
            conteudo = `
            <img src="imagens/editar.png" style="width: 2vw; cursor: pointer;" 
            ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? `onclick="cadastrarItem('${codigo}')"` : ''}>
            `
        } else if (chave === 'codigo') {

            conteudo = codigo

        } else if (chave === 'imagem') {
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
                <label class="label-estoque" style="background-color: ${preco_final > 0 ? '#4CAF50bf' : '#b36060bf'};" 
                ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? `onclick="abrirHistoricoPrecos('${codigo}', '${chave}')"` : ''}> 
                ${dinheiro(conversor(preco_final))}</label>`;

        } else if (chave === 'agrupamento') {

            let info = ''

            for (const [cod, dados] of Object.entries(conteudo || {})) {
                const tipo = dados_composicoes[cod]?.tipo || '??'
                info += `
                    <div style="${horizontal}; gap: 2px;">
                        <span class="balao-redondo-agrupamento" style="background-color: ${tipo == 'VENDA' ? '#B12425' : tipo == 'SERVIÇO' ? 'green' : '#24729d'}">${cod}</span>
                        <span class="balao-redondo-agrupamento">${dados.qtde}</span>
                        <span>${String(dados_composicoes?.[cod]?.descricao || '??').slice(0, 10)}...</span>
                    </div>`
            }

            conteudo = `
                <div style="display: flex; gap: 10px; justify-content: center; align-items: center;">
                    <img src="imagens/construcao.png" style="width: 1.5rem; cursor: pointer;" onclick="verAgrupamento('${codigo}')">
                    <div style="display: flex; flex-direction: column; align-items: start; justify-content: left; gap: 2px;">
                        ${info}
                    </div>
                </div>`;
            alinhamento = 'center';

        } else if (chave == 'sistema' || chave == 'categoria de equipamento' || chave == 'tipo') {

            const opcoes = esquemas[chave]
                .map(op => `<option ${produto?.[chave] == op ? 'selected' : ''}>${op}</option>`)
                .join('')

            conteudo = `
                <select class="opcoesSelect" 
                    onchange="alterarChave('${codigo}', '${chave}', this)"
                    ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? '' : 'disabled'}>
                    ${opcoes}
                </select>`;

        }

        tds += `<td style="text-align: ${alinhamento};">${conteudo}</td>`;

    }

    const linhaExistente = document.getElementById(codigo);
    if (linhaExistente) return linhaExistente.innerHTML = tds;

    document.getElementById('linhasComposicoes').insertAdjacentHTML('beforeend', `<tr id="${codigo}">${tds}</tr>`);
}

async function abrirFiltros() {

    const colunas = JSON.parse(localStorage.getItem('colunasComposicoes'))?.[origem] || []
    cabecalhos.sort()
    const opcoes = cabecalhos
        .map(cabecalho => `
        <label>
            <input type="checkbox" value="${cabecalho}" ${colunas.includes(cabecalho) ? 'checked' : ''}> ${inicialMaiuscula(cabecalho)}
        </label>
        `)
        .join('')

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

            <div style="margin-left: 1vw; ${horizontal}; background-color: white; border-radius: 5px; padding-left: 1vw; padding-right: 1vw;">
                <input oninput="filtrarCamposComposicoes(this.value)" placeholder="Pesquisar colunas" style="width: 100%;">
                <img src="imagens/pesquisar2.png" style="width: 1.5vw; padding: 0.5vw;">
            </div>

            <br>

            <div style="${horizontal}; gap: 10px;">
                <input class="todos" type="checkbox" onchange="marcarTodosComposicoes(this)">
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

function filtrarCamposComposicoes(termo) {

    termo = String(termo).toLowerCase()
    let divFiltros = document.getElementById('filtrosColunas')
    let labels = divFiltros.querySelectorAll('label')

    labels.forEach(label => {
        let texto = label.textContent.toLowerCase()
        texto.includes(termo) ? label.style.display = 'flex' : label.style.display = 'none'
    })

}

function marcarTodosComposicoes(inputTodos) {

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

    let colunasComposicoes = JSON.parse(localStorage.getItem('colunasComposicoes')) || {}
    if (!colunasComposicoes[origem]) colunasComposicoes[origem] = []
    colunasComposicoes[origem] = colunas

    localStorage.setItem('colunasComposicoes', JSON.stringify(colunasComposicoes))
    removerPopup()

    await telaComposicoes()

}

async function alterarChave(codigo, chave, select) {
    let dados_composicoes = await recuperarDados('dados_composicoes') || {}

    let produto = dados_composicoes[codigo]

    produto[chave] = select.value

    enviar(`dados_composicoes/${codigo}/${chave}`, select.value)

    await inserirDados(dados_composicoes, 'dados_composicoes')

    await continuar()

}

function checkedInputs(filtro) {
    const linhas = document.getElementById('linhas_agrupamentos')
    let filtrar = filtro.value

    if (!linhas) return

    const trs = linhas.querySelectorAll('tr')

    trs.forEach(tr => {

        var tds = tr.querySelectorAll('td')

        const mostrar = false

        var check = tds[0].querySelector('input').checked

        if (filtrar == 'Todos') {

            mostrar = true

        } else if (filtrar == 'Marcados') {

            if (check) {
                mostrar = true
            } else {
                mostrar = false
            }

        } else if (filtrar == 'Não Marcados') {

            if (!check) {
                mostrar = true
            } else {
                mostrar = false
            }
        }

        tr.style.display = mostrar_linha ? 'table-row' : 'none'

    })
}

async function abrirHistoricoPrecos(codigo, tabela) {

    const produto = await recuperarDado('dados_composicoes', codigo)
    let linhas = ''

    for (const [id, cotacao] of Object.entries(produto?.[tabela]?.historico || {})) {

        const marcado = produto[tabela]?.ativo == id

        linhas += `
        <tr>
            <td>${dinheiro(cotacao?.custo || 0)}</td>
            <td>${dinheiro(cotacao?.valor_custo || cotacao?.custo)}</td>
            <td style="text-align: center;">${cotacao?.margem}</td>
            <td>${dinheiro(cotacao?.valor)}</td>
            <td>${cotacao?.data}</td>
            <td>${cotacao?.usuario}</td>
            <td>${cotacao?.fornecedor}</td>

            <td>
                <input type="radio" name="preco" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvarPrecoAtivo('${codigo}', '${id}', '${tabela}')" ${marcado ? 'checked' : ''}>
            </td>
            
            <td><textarea style="border: none;" readOnly>${cotacao?.comentario || ''}</textarea></td>
            <td style="text-align: center;">
                <img src="imagens/cancel.png" style="width: 1.7rem; cursor: pointer;" onclick="excluirCotacao('${codigo}', '${tabela}', '${id}')">
            </td>
            <td style="text-align: center;">
                <img src="imagens/pesquisar2.png" style="width: 1.7rem; cursor: pointer;" onclick="adicionarCotacao('${codigo}', '${tabela}', '${id}')">
            </td>
        </tr>
        `
    }

    const colunas = [
        'Preço Unitário',
        'Preço Unitário',
        'Margem %',
        'Pr. Venda',
        'Data',
        'Usuário',
        'Fornecedor',
        'Ativo',
        'Comentário',
        'Excluir',
        'Detalhes'
    ]

    let acumulado = `
        <div style="${horizontal}; align-items: start; width: 100%; justify-content: space-between; gap 1vw;">
            <div style="${horizontal}; gap: 5px;">
                <img style="width: 7vw; border-radius: 5px;" src="${produto?.imagem || logo}">
                <div style="${vertical}">
                    <label><b>Descrição</b></label>
                    <label>${produto?.descricao || ''}</label>
                </div>
            </div>
        
            <div onclick="adicionarCotacao('${codigo}', '${tabela}')" class="bot_adicionar">
                <img src="imagens/preco.png">
                <label>Adicionar Preço</label>
            </div>
        </div>

        <hr style="width: 100%;">
        
        <div class="borda-tabela">
            <div class="topo-tabela">
                <span>Histórico de Preços</span>
            </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            ${colunas.map(op => `<th>${op}</th>`).join('')} 
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    if (produto.preco_estado) {

        const linhas = Object.entries(produto?.preco_estado || {})
            .map(([estado, preco]) => `
                <tr>
                    <td>${estado}</td>
                    <td>${dinheiro(preco)}</td>
                </tr>
            `).join('')

        acumulado += `
            <hr style="width: 100%;">
            
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span>Preços por Estado</span>
                </div>
                    <div class="div-tabela">
                        <table class="tabela">
                            <thead>
                                ${['Estado', 'Preço'].map(op => `<th>${op}</th>`).join('')}
                            </thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>
                <div class="rodapeTabela"></div>
            </div>
        `
    }

    const historicoPreco = document.querySelector('.historico-preco')
    if (historicoPreco) return historicoPreco.innerHTML = acumulado

    popup(`<div class="historico-preco">${acumulado}</div>`, 'Valores de Venda', true)

}

async function salvarPrecoAtivo(codigo, id_preco, lpu) {

    overlayAguarde()

    let produto = await recuperarDado('dados_composicoes', codigo)

    if (!produto[lpu]) produto[lpu] = {}
    produto[lpu].ativo = id_preco

    enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, id_preco)
    await inserirDados({ [codigo]: produto }, 'dados_composicoes')
    removerOverlay()

    await continuar()

}

async function excluirCotacao(codigo, lpu, cotacao) {

    overlayAguarde()

    const historicoPreco = document.querySelector('.historico-preco')
    if (!historicoPreco) return

    let produto = await recuperarDado('dados_composicoes', codigo) || {}
    let cotacoes = produto?.[lpu] || {}

    if (cotacoes?.ativo == cotacao) {
        cotacoes.ativo = ''
        await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, '')
    }

    const precoExcluido = cotacoes?.historico?.[cotacao]?.valor || '??'

    delete cotacoes?.historico?.[cotacao]
    deletar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`)
    await inserirDados({ [codigo]: produto }, 'dados_composicoes')

    removerPopup()
    await abrirHistoricoPrecos(codigo, lpu);
    await continuar()
}

function gerarTabelas(objeto) {

    let acumulado = {}

    for (const [chave, campos] of Object.entries(objeto)) {

        let titulos = {
            camposIniciais: 'Campos Iniciais',
            presuncoes: 'Presunções',
            impostos: 'Impostos',
            resultados: 'Resultados',
            complementares: 'Complemetares',
            maoObra: 'Mão de Obra'
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

        const tabelaHtml = `
            <div style="${vertical}; width: 100%;">
                <div class="painelBotoes"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            <th>${titulos[chave]}</th>
                            <th>Valores</th>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>
        `

        if (!acumulado[chave]) acumulado[chave] = ''

        acumulado[chave] += tabelaHtml

    }

    return acumulado
}

function modelos(produto) {

    const blocos = {
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
                { label: 'ICMS de Saída', opcoes: ['20,5%', '12%', '4%'], id: 'icms_saida' }
            ]
        },
        'SERVIÇO': {
            camposIniciais: [
                { label: 'Valor do Serviço', cor: '#91b7d9', id: 'preco_venda', valor: produto?.valor || '' }
            ],
            maoObra: [
                { label: 'Coeficiente de Mão de Obra (30%)', id: 'maoObra' }
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

    const geral = {
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

    return { ...blocos[produto.tipo], ...geral }
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

    const tabelas = gerarTabelas(modelos(produto))
    const gap = `gap: 0.5rem;`

    const acumulado = `
        <label style="font-size: 1.2rem;" id="modalidadeCalculo"><strong>${produto.tipo}</strong></label>

        <div style="${horizontal}; border-radius: 5px; background-color: #575757; padding: 0.5rem; align-items: start; ${gap}">

            <div style="${vertical}; ${gap}">
                ${tabelas.camposIniciais}
                ${tabelas.complementares}
                ${produto.tipo == 'SERVIÇO' ? tabelas.maoObra : ''}
            </div>

            <div style="${vertical}; ${gap}">
                ${tabelas.resultados}
                ${tabelas.presuncoes}
                ${tabelas.impostos}
            </div>

        </div>

        <button onclick="${funcao}">Salvar Preço</button>
    `

    const painelPrecos = document.querySelector('.painel-precos')
    if (painelPrecos) {
        painelPrecos.innerHTML = acumulado
    } else {
        popup(`<div class="painel-precos">${acumulado}</div>`, 'Gestão de Preço', true)
    }

    calcular()

}

function obValComp(id, valorRetorno) {
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
    if (el.type === 'number') valor = conversor(Number(valor));

    return valor;
}

function calcular(campo, dadosCalculo = null) {

    const modalidadeCalculo = dadosCalculo?.modalidadeCalculo || document.getElementById('modalidadeCalculo').textContent

    const tabelaIcmsSaida = {
        'IMPORTADO': 4,
        'NACIONAL': 12,
        'BAHIA': 20.5,
        '7%': 7
    }

    function atualizarLucro({ valRef = 0, totImp = 0, custoFinal = 0, coeficienteMaoObra = 0, extras = {} }) {
        const base = Number(valRef) || 0
        const totalCusto = (Number(totImp) || 0) + (Number(custoFinal) || 0) + (Number(coeficienteMaoObra) || 0)
        const lucroLiquido = base - totalCusto
        let porcentagem = base ? (lucroLiquido / base * 100) : 0

        if (dadosCalculo) {
            return { lucroLiquido, lucroPorcentagem: porcentagem, totalImpostos: totImp, ...extras }
        }

        obValComp('lucro_liquido', dinheiro(lucroLiquido))
        obValComp('lucro_porcentagem', `${porcentagem.toFixed(2)}%`)
        const estilo = lucroLiquido > 0 ? 'lucroPositivo' : 'lucroNegativo'
        document.getElementById('lucro_liquido').classList = estilo
        document.getElementById('lucro_porcentagem').classList = estilo
    }


    if (modalidadeCalculo == 'SERVIÇO') {

        const precoVenda = obValComp('preco_venda')
        const coeficienteMaoObra = precoVenda * 0.3
        const aliqLp = precoVenda * 0.32
        const presuncaoCsll = precoVenda * 0.32
        const irpj = aliqLp * 0.15
        const adicionalIrpj = aliqLp * 0.10
        const presuncaoCsllAPagar = presuncaoCsll * 0.09
        const pis = precoVenda * 0.0065
        const cofins = precoVenda * 0.03
        const iss = precoVenda * 0.05
        const totImp = irpj + adicionalIrpj + presuncaoCsllAPagar + pis + cofins + iss

        if (!dadosCalculo) {
            obValComp('maoObra', dinheiro(coeficienteMaoObra))
            obValComp('aliq_presumido', dinheiro(aliqLp))
            obValComp('presuncao_csll', dinheiro(presuncaoCsll))
            obValComp('irpj', dinheiro(irpj))
            obValComp('adicional_irpj', dinheiro(adicionalIrpj))
            obValComp('presuncao_csll_pagar', dinheiro(presuncaoCsllAPagar))
            obValComp('pis', dinheiro(pis))
            obValComp('cofins', dinheiro(cofins))
            obValComp('iss', dinheiro(iss))
            obValComp('total_impostos', dinheiro(totImp))
        }

        const extras = {
            coeficienteMaoObra
        }

        return atualizarLucro({ valRef: precoVenda, totImp, coeficienteMaoObra, extras })

    } else if (modalidadeCalculo == 'VENDA') {

        const icmsCreditadoSelect = obValComp('icms_creditado_select')
        const icmsCreditado = dadosCalculo?.icms_creditado || tabelaIcmsSaida[icmsCreditadoSelect]
        const precoCompra = dadosCalculo?.custo || obValComp('custo')
        const frete = precoCompra * 0.02
        const icmsAliquota = conversor(obValComp('icms_saida_select'))
        const difal = icmsAliquota - icmsCreditado
        const icmsEntrada = difal / 100 * precoCompra
        const valorCusto = icmsEntrada + precoCompra + frete
        let margem = obValComp('margem')
        let precoVenda = (1 + margem / 100) * valorCusto

        if (campo == 'preco_venda' || dadosCalculo) {
            precoVenda = dadosCalculo?.valor || obValComp('preco_venda')
            margem = ((precoVenda / valorCusto - 1) * 100).toFixed(2)
            obValComp('margem', margem)
        } else {
            obValComp('preco_venda', precoVenda.toFixed(2))
        }

        const freteVenda = precoVenda * 0.05
        const porcLP = 0.08
        const porcCSLL = 0.12
        const lucroPresumido = precoVenda * porcLP
        const presuncaoCsll = precoVenda * porcCSLL
        const irpj = lucroPresumido * 0.15
        const adicionalIrpj = lucroPresumido * 0.1
        const csll = presuncaoCsll * 0.09
        const pis = precoVenda * 0.0065
        const cofins = precoVenda * 0.03

        const icmsSaidaSelect = icmsAliquota / 100
        const icmsSaida = dadosCalculo?.icmsSaida / 100 || icmsSaidaSelect
        const icms = precoVenda * icmsSaida
        const totImp = irpj + adicionalIrpj + csll + pis + cofins + icms

        if (!dadosCalculo) {
            obValComp('icms_creditado', icmsCreditado)
            obValComp('frete_venda', freteVenda.toFixed(2))
            obValComp('porc_LP', dinheiro(lucroPresumido))
            obValComp('porc_CSLL', dinheiro(presuncaoCsll))
            obValComp('icms_saida', dinheiro(icms.toFixed(0)))
            obValComp('frete', frete.toFixed(2))
            obValComp('difal', difal)
            obValComp('icms_entrada', icmsEntrada.toFixed(2))
            obValComp('valor_custo', valorCusto.toFixed(2))
            obValComp('irpj', dinheiro(irpj))
            obValComp('adicional_irpj', dinheiro(adicionalIrpj))
            obValComp('csll', dinheiro(csll))
            obValComp('pis', dinheiro(pis))
            obValComp('cofins', dinheiro(cofins))
            obValComp('total_impostos', dinheiro(totImp))
        }

        const extras = {
            freteCompra: frete,
            freteVenda,
            difal,
            margem: Number(margem)
        }

        return atualizarLucro({ valRef: precoVenda, totImp, custoFinal: (valorCusto + freteVenda), extras })

    }


    if (modalidadeCalculo == 'USO E CONSUMO') {

        const icmsCreditadoSelect = obValComp('icms_creditado_select')
        const icmsCreditado = dadosCalculo?.icms_creditado || tabelaIcmsSaida[icmsCreditadoSelect]
        const precoCompra = Number(dadosCalculo?.custo || obValComp('custo') || 0)
        const frete = precoCompra * 0.02
        const icmsAliquota = 20.5
        const difal = icmsAliquota - icmsCreditado
        const icmsEntrada = (difal / 100) * precoCompra
        const valorCusto = icmsEntrada + precoCompra + frete

        let margem = Number(obValComp('margem') || 0)
        let precoVenda = (1 + margem / 100) * valorCusto

        if (campo == 'preco_venda' || dadosCalculo) {
            precoVenda = Number(dadosCalculo?.valor || obValComp('preco_venda') || 0)
            margem = valorCusto ? ((precoVenda / valorCusto - 1) * 100).toFixed(2) : 0
            obValComp('margem', margem)
        } else {
            obValComp('preco_venda', precoVenda.toFixed(2))
        }

        const freteVenda = precoVenda * 0.05
        const aliqLp = precoVenda * 0.32
        const presuncaoCsll = precoVenda * 0.32
        const irpj = aliqLp * 0.15
        const adicionalIrpj = aliqLp * 0.10
        const presuncaoCsllAPagar = presuncaoCsll * 0.09
        const pis = precoVenda * 0.0065
        const cofins = precoVenda * 0.03
        const iss = precoVenda * 0.05
        const totImp = irpj + adicionalIrpj + presuncaoCsllAPagar + pis + cofins + iss

        const extras = { freteCompra: frete, freteVenda, difal, margem: Number(margem) }

        return atualizarLucro({ valRef: precoVenda, totImp, custoFinal: valorCusto + freteVenda, extras })
    }

}

async function salvarPreco(codigo, lpu, cotacao) {

    overlayAguarde()

    const icmsSaida = obValComp('icms_saida_select')

    let produto = await recuperarDado('dados_composicoes', codigo)
    let historico = produto[lpu]?.historico || {}

    if (produto.tipo == 'VENDA' && icmsSaida !== '20,5%') return popup(mensagem('ICMS de saída por segurança não pode ser menor que <b>20,5%</b>.'), 'ICMS de Saída bloqueado', true)

    cotacao = cotacao || ID5digitos()

    historico[cotacao] = {
        valor: obValComp('preco_venda'),
        data: obterDatas('completa'),
        usuario: acesso.usuario,
        nota: obValComp('nota'),
        comentario: obValComp('comentario'),
        margem: obValComp('margem'),
        fornecedor: obValComp('fornecedor'),
        custo: obValComp('custo'),
        valor_custo: obValComp('valor_custo'),
        icms_creditado: obValComp('icms_creditado'),
        icms_creditado_select: obValComp('icms_creditado_select'),
        modalidade_icms: obValComp('modalidade_icms_select'),
        icms_saida: obValComp('icms_saida')
    };

    // Verificar antes se a porcentagem é aceitável;
    const permitidos = ['adm', 'diretoria']
    const resultado = calcular(undefined, historico[cotacao])
    if (resultado.lucroPorcentagem < 10 && !permitidos.includes(acesso.permissao)) return popup(mensagem('Percentual de lucro não pode ser menor que 10%'), 'Alerta', true)

    produto[lpu] = produto[lpu] || { historico: {} };
    produto[lpu].historico = historico;

    await inserirDados({ [codigo]: produto }, 'dados_composicoes')
    removerPopup()
    await continuar()

    await abrirHistoricoPrecos(codigo, lpu);
    enviar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`, historico[cotacao])

}

function remover_esta_linha(elemento) {
    let tr = elemento.closest('tr')
    tr.remove()
}

async function cadastrarItem(codigo) {

    if (!origem) colunas.push('descricaocarrefour')
    const produto = await recuperarDado('dados_composicoes', codigo) || {}
    const funcao = codigo ? `salvarServidor('${codigo}')` : `salvarServidor()`

    const modelo = (texto, elemento) => `
        <div ${texto == 'Descrição' ? 'class="full"' : ''} style="display: flex; flex-direction: column; gap: 3px; align-items: start; justify-content: start;">
            <label>${texto}</label>
            ${elemento}
        </div>
    `

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 2vw;">

            <div class="elementos">
                ${modelo('Descrição', `<textarea name="descricao" rows="5">${produto?.descricao || ''}</textarea>`)}
                ${modelo('Fabricante', `<input name="fabricante" value="${produto?.fabricante || ''}">`)}
                ${modelo('Modelo', `<input name="modelo" value="${produto?.modelo || ''}">`)}
                ${modelo('Unidade', `<input name="unidade" value="${produto?.unidade || ''}">`)}
                ${modelo('ncm', `<input name="ncm" value="${produto?.ncm || ''}">`)}
                ${modelo('Omie / Partnumber', `<input name="omie" value="${produto?.omie || ''}">`)}
                ${modelo('Tipo', `<select name="tipo">
                ${esquemas.tipo
            .map(op => `<option ${op == produto?.tipo ? 'selected' : ''}>${op}</option>`)
            .join('')}
                </select>`)}
            </div>

            <br>

            <div style="${horizontal}; justify-content: space-between; width: 100%;">
                <button style="background-color: #4CAF50; margin: 0px;" onclick="${funcao}">Salvar</buttton>

            ${codigo
            ? `<button style="background-color: #B12425; margin: 0px;" onclick="confirmarExclusao_item('${codigo}')">Excluir item</buttton>`
            : ''}
                
            </div>
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
            <button onclick="excluirItemComposicao('${codigo}')">Confirmar</button>
        </div>
        `, 'Tem certeza?')

}

async function excluirItemComposicao(codigo) {

    deletar(`dados_composicoes/${codigo}`)
    await deletarDB('dados_composicoes', codigo)

    const trProduto = document.getElementById(`${codigo}`)
    if (trProduto) trProduto.remove()

    removerPopup()

}

async function salvarServidor(codigo) {

    overlayAguarde()
    const item = await recuperarDado('dados_composicoes', codigo) || {};

    if (!codigo) {

        const resposta = await verificarCodigoExistente();

        if (resposta.status == 'Falha') {
            return popup(mensagem('Não foi possível cadastrar o item... tente novamente'), 'Aviso', true)
        }

        codigo = resposta.status // Aqui é retornado o último número sequencial +1 para cadasto;
    }

    const campos = ['descricao', 'unidade', 'fabricante', 'modelo', 'ncm', 'omie', 'tipo']
    let novosDados = {}
    const elementos = document.querySelector('.elementos')
    for (const campo of campos) {
        const el = elementos.querySelector(`[name="${campo}"]`);
        novosDados[campo] = el ? String(el.value).toUpperCase() : '';
    }

    const final = {
        ...item,
        ...novosDados,
        codigo: String(codigo),
        origem
    }

    enviar(`dados_composicoes/${codigo}`, final)
    await inserirDados({ [codigo]: final }, 'dados_composicoes')
    removerPopup()

    await continuar()
}

async function verificarCodigoExistente() {
    return new Promise((resolve, reject) => {

        fetch(`${api}/codigo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
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

async function paraExcel() {
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

            if (img) continue

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

async function verAgrupamento(codigo) {

    codigoMaster = codigo

    const produto = await recuperarDado('dados_composicoes', codigo)
    const acumulado = `
        <div class="tela-agrupamento">
            <div style="${horizontal}; text-align: left; gap: 0.5rem;">

                <img src="${produto.imagem || logo}" style="width: 6rem;">

                <div style="${vertical}">
                    <span>Agrupamento do item:</span>
                    <span><b>${produto.descricao}</b></span>
                    <span>Explicação: <br>Para cada 1 <b>${String(produto.descricao).slice(0, 10)}</b><br> Será lançada a quantidade abaixo de cada item</span>
                </div>
                
            </div>
            <hr style="width: 100%;">

            <div class="borda-tabela">
                <div class="topo-tabela">
                    <button onclick="criarLinhaAgrupamento()">Adicionar Item</button>
                </div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${['Código', 'Descrição', 'Tipo', 'Quantidade', 'Remover'].map(op => `<th>${op}</th>`).join('')}</tr>
                        </thead>
                        <tbody id="linhasAgrupamento"></tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>
    `
    const telaAgrupamento = document.querySelector('.tela-agrupamento')
    if (!telaAgrupamento) popup(acumulado, 'Agrupamento', true)

    const agrupamento = produto.agrupamento || {}
    for (const [cod, dados] of Object.entries(agrupamento)) {
        await criarLinhaAgrupamento(cod, dados)
    }

}

async function criarLinhaAgrupamento(cod, dados) {

    if (!dados_composicoes) dados_composicoes = await recuperarDados('dados_composicoes')

    const produto = dados_composicoes[cod]
    const chaveUnica = ID5digitos()

    const tds = `
        <td>${cod || '??'}</td>
        <td>
            <span 
            class="opcoes"
            ${cod ? `id="${cod}"` : ''}
            name="${chaveUnica}" 
            onclick="cxOpcoes('${chaveUnica}', 'dados_composicoes', ['descricao', 'codigo', 'tipo', 'modelo', 'fabricante'], 'salvarAgrupamentosAutomatico()')">
                ${produto?.descricao || 'Selecione'}
            </span>
        </td>
        <td>${produto?.tipo || '??'}
        <td><input type="number" oninput="salvarAgrupamentosAutomatico()" value="${dados?.qtde || ''}"></td>
        <td>
            <img src="imagens/cancel.png" style="width: 1.7rem;" onclick="confirmarRemoverAgrupamento('${cod}')">
        </td>
    `

    const trExistente = document.getElementById(`AGRUP_${cod}`)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('linhasAgrupamento').insertAdjacentHTML('beforeend', `<tr id="AGRUP_${cod}">${tds}</tr>`)
}

async function confirmarRemoverAgrupamento(codSlave) {

    const acumulado = `
        <div style="${horizontal}; gap: 1rem; padding: 2rem; background-color: #d2d2d2;">
            <span> Tem certeza que deseja remover este item adicional?</span>
            <button onclick="removerAgrupamento('${codSlave}')">Confirmar</button>
        </div>
    `

    popup(acumulado, 'Tem certeza?', true)

}

async function removerAgrupamento(codSlave) {

    let produto = dados_composicoes[codigoMaster]
    delete produto.agrupamento[codSlave]
    await inserirDados({ [codigoMaster]: produto }, 'dados_composicoes')
    deletar(`dados_composicoes/${codigoMaster}/agrupamento/${codSlave}`)

    const linha = document.getElementById(`AGRUP_${codSlave}`)

    if (linha) linha.remove()

    removerPopup()

}

async function salvarAgrupamentosAutomatico() {

    const linhasAgrupamento = document.getElementById('linhasAgrupamento')

    const trs = linhasAgrupamento.querySelectorAll('tr')

    const agrupamento = {}

    for (const tr of trs) {

        const tds = tr.querySelectorAll('td')
        const spanDesc = tds[1].querySelector('span')
        const codigo = spanDesc.id
        const qtde = Number(tds[3].querySelector('input').value)

        tr.id = `AGRUP_${codigo}`
        tds[0].textContent = codigo
        tds[2].textContent = dados_composicoes[codigo].tipo

        if (qtde == 0) continue
        agrupamento[codigo] = { qtde }

    }

    // codigoMaster é uma variável global;
    const produto = dados_composicoes[codigoMaster].agrupamento || {}
    produto.agrupamento = agrupamento

    if (Object.keys(agrupamento).length > 0) {
        await inserirDados({ [codigoMaster]: produto }, 'dados_composicoes')
        enviar(`dados_composicoes/${codigoMaster}/agrupamento`, agrupamento)
    }

}

function passou60Dias(dataTexto) {
    if (!dataTexto || typeof dataTexto !== 'string') return false

    const partes = dataTexto.split(', ')
    if (partes.length < 2) return false

    const [data, hora] = partes
    const [dia, mes, ano] = data.split('/').map(Number)
    const [hh, mm, ss] = hora.split(':').map(Number)

    const dataCompleta = new Date(ano, mes - 1, dia, hh, mm, ss)
    if (isNaN(dataCompleta.getTime())) return false

    const hoje = new Date()
    const diff = hoje - dataCompleta
    const dias = diff / (1000 * 60 * 60 * 24)

    return dias > 60
}

async function precosDesatualizados() {

    const tabela = 'lpu hope'

    const dados_composicoes = await recuperarDados('dados_composicoes')
    const colunas = ['Código', 'Descrição', 'Data', 'Fornecedor', 'Preço', 'Ver']
    const acumulado = `
        <div id="precosDesatualizados" class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" id="tabela_composicoes">
                    <thead>
                        <tr>${colunas.map(th => `<th>${th}</th>`).join('')}</tr>
                    </thead>
                    <tbody id="linhasPrecos"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const precosDesatualizados = document.getElementById('precosDesatualizados')
    if (!precosDesatualizados) popup(acumulado, 'Preços Desatualizados', true)

    
    const linhasPrecos = document.getElementById('linhasPrecos')

    for (const [codigo, produto] of Object.entries(dados_composicoes)) {

        const historico = produto?.[tabela]?.historico || {}
        const ativo = produto?.[tabela]?.ativo || ''
        const preco = historico?.[ativo] || null
        if (!preco) continue

        const resposta = passou60Dias(preco?.data)
        if (!resposta) continue

        const tds = `
            <td>${codigo}</td>
            <td>${1}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        `

        const trExistente = document.getElementById(`des_${codigo}`)
        if(trExistente) {
            trExistente.innerHTML = tds
            continue
        }

        linhasPrecos.insertAdjacentHTML('beforeend', `<tr id="des_${codigo}">${tds}</tr>`)

    }


}