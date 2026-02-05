let colunas = []
const usuariosPermitidosParaEditar = ['log', 'editor', 'adm', 'gerente', 'diretoria', 'coordenacao']
const LPUS = [
    'lpu hope',
    'lpu boticario',
    'lpu cf boticario',
    'lpu romagnole',
    'lpu gpa',
    'lpu muffato',
    'lpu eas muffato'
]

async function atualizarComposicoes() {
    await sincronizarDados({ base: 'dados_composicoes' })
    await telaComposicoes(true)
}

async function telaComposicoes() {

    overlayAguarde()
    mostrarMenus(false)

    const colunas = {
        'codigo': { chave: 'codigo' },
        'editar': {},
        'imagem': {},
        'descricao': { chave: 'descricao' },
        'agrupamento': {},
        'omie': { chave: 'omie' },
        'ncm': { chave: 'ncm' },
        'tipo': { chave: 'tipo' },
        'unidade': { chave: 'unidade' },
        'fabricante': { chave: 'fabricante' },
        'modelo': { chave: 'modelo' },
        'sistema': { chave: 'sistema' },
        'tempo': {},
        '-': { chave: 'descricao' },

        ...Object.fromEntries(
            LPUS.map(lpu => [lpu, {}])
        )
    }

    const pag = 'composicoes'
    const tabela = await modTab({
        colunas,
        pag,
        base: 'dados_composicoes',
        body: 'bodyComposicoes',
        criarLinha: 'criarLinhaComposicao'
    })

    tela.innerHTML = `
        <div style="width: 95vw;">
            ${tabela}
        </div>
        `
    await paginacao(pag)

    criarMenus('composicoes')
    removerOverlay()
}

async function criarLinhaComposicao(produto) {

    const {
        codigo,
        descricao,
        agrupamento,
        omie,
        ncm,
        tipo,
        unidade,
        imagem,
        modelo,
        sistema,
        fabricante,
        tempo
    } = produto

    const divAgrupamento = []

    for (const [cod, dados] of Object.entries(agrupamento || {})) {
        const prodVinculado = await recuperarDado('dados_composicoes', cod) || {}

        const { tipo, descricao } = prodVinculado

        divAgrupamento.push(`
            <div style="${horizontal}; gap: 5px;">
                <span class="balao-redondo-agrupamento" 
                style="background-color: ${tipo == 'VENDA' ? '#B12425' : tipo == 'SERVIÇO' ? 'green' : '#24729d'}">
                    ${cod}
                </span>
                <span class="balao-redondo-agrupamento">${dados.qtde}</span>
                <span style="text-align: left;">${String(descricao || '??').slice(0, 10)}...</span>
            </div>`)
    }

    const tdsLPUS = LPUS
        .map(lpu => {
            const tabela = produto[lpu] || {}
            const ativo = tabela?.ativo
            const valor = tabela?.historico?.[ativo]?.valor || 0
            return `
            <td>
                <label class="label-estoque" style="color: white; background-color: ${valor > 0 ? '#4CAF50' : '#b36060'};" 
                    ${usuariosPermitidosParaEditar.includes(acesso.permissao) ? `onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')"` : ''}> 
                    ${dinheiro(conversor(valor))}
                </label>
            </td>`
        }).join('')

    return `
        <tr id="${codigo}">
            <td>${codigo}</td>
            <td>
                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
            ? `<img src="imagens/editar.png" onclick="cadastrarItem('${codigo}')">`
            : ''}
            </td>

            <td><img name="${codigo}" onclick="abrirImagem('${codigo}')" style="width: 5rem;" src="${imagem || logo}"></td>
            <td style="text-align: left;">${descricao || ''}</td>

            <td>
                <div style="${vertical}; gap: 3px;">
                    <div onclick="verAgrupamento('${codigo}')" class="ver-agrupamento">
                        <img src="imagens/construcao.png">
                        <span>Editar Agrupamento</span>
                    </div>
                    ${divAgrupamento.join('')}
                </div>
            </td>

            <td>${omie || ''}</td>
            <td>${ncm || ''}</td>
            <td>${tipo || ''}</td>
            <td>${unidade || ''}</td>
            <td>${fabricante || ''}</td>
            <td>${modelo || ''}</td>
            <td>${sistema || ''}</td>
            <td>${tempo || ''}</td>

            <td style="text-align: right;">${descricao || ''}</td>
            ${tdsLPUS}
        <tr>
    `

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
                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
                ? `<input type="radio" name="preco" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvarPrecoAtivo('${codigo}', '${id}', '${tabela}')" ${marcado ? 'checked' : ''}>`
                : ''}
            </td>
            
            <td><textarea style="border: none;" readOnly>${cotacao?.comentario || ''}</textarea></td>
            <td style="text-align: center;">
                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
                ? `<img src="imagens/cancel.png" style="width: 1.7rem; cursor: pointer;" onclick="excluirCotacao('${codigo}', '${tabela}', '${id}')">`
                : ''}
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

        <hr>
        
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
            <div class="rodape-tabela"></div>
        </div>
    `

    const historicoPreco = document.querySelector('.historico-preco')
    if (historicoPreco) return historicoPreco.innerHTML = acumulado

    popup({ elemento: `<div class="historico-preco">${acumulado}</div>`, titulo: 'Valores de Venda' })

}

async function salvarPrecoAtivo(codigo, id_preco, lpu) {

    overlayAguarde()

    let produto = await recuperarDado('dados_composicoes', codigo)

    if (!produto[lpu]) produto[lpu] = {}
    produto[lpu].ativo = id_preco

    enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, id_preco)
    await inserirDados({ [codigo]: produto }, 'dados_composicoes')
    removerOverlay()

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

    delete cotacoes?.historico?.[cotacao]
    deletar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`)
    await inserirDados({ [codigo]: produto }, 'dados_composicoes')

    removerPopup()
    await abrirHistoricoPrecos(codigo, lpu);

}

function gerarTabelas(objeto) {

    let acumulado = {}

    for (const [chave, campos] of Object.entries(objeto)) {

        const titulos = {
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
                <div class="rodape-tabela"></div>
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

    let produto = await recuperarDado('dados_composicoes', codigo)
    const funcao = cotacao
        ? `salvarPreco('${codigo}', '${lpu}', '${cotacao}')`
        : `salvarPreco('${codigo}', '${lpu}')`

    if (lpu && cotacao) {
        produto = {
            ...produto,
            ...produto[lpu].historico[cotacao]
        }
    }

    const tabelas = gerarTabelas(modelos(produto))
    const gap = `gap: 0.5rem;`

    const acumulado = `
        <div style="${horizontal}; border-radius: 5px; background-color: #575757; padding: 0.5rem; align-items: start; ${gap}">
            <span style="display: none" id="modalidadeCalculo">${produto.tipo}</span>
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
    `

    const botoes = []

    if (usuariosPermitidosParaEditar) botoes.push({ texto: 'Salvar Preço', img: 'concluido', funcao })

    popup({ botoes, elemento: `<div class="painel-precos">${acumulado}</div>`, titulo: produto.tipo })

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

        if (!dadosCalculo) {
            obValComp('frete_venda', dinheiro(freteVenda))
            obValComp('difal', dinheiro(difal))
            obValComp('irpj', dinheiro(irpj))
            obValComp('adicional_irpj', dinheiro(adicionalIrpj))
            obValComp('presuncao_csll_pagar', dinheiro(presuncaoCsllAPagar))
            obValComp('pis', dinheiro(pis))
            obValComp('cofins', dinheiro(cofins))
            obValComp('iss', dinheiro(iss))
            obValComp('total_impostos', dinheiro(totImp))
        }

        const extras = { freteCompra: frete, freteVenda, difal, margem: Number(margem) }

        return atualizarLucro({ valRef: precoVenda, totImp, custoFinal: valorCusto + freteVenda, extras })
    }

}

async function salvarPreco(codigo, lpu, cotacao) {

    overlayAguarde()

    const icmsSaida = obValComp('icms_saida_select')

    let produto = await recuperarDado('dados_composicoes', codigo)
    let historico = produto[lpu]?.historico || {}

    if (produto.tipo == 'VENDA' && icmsSaida !== '20,5%')
        return popup({ mensagem: 'ICMS de saída por segurança não pode ser menor que <b>20,5%</b>.', titulo: 'ICMS de Saída bloqueado' })

    cotacao = cotacao || ID5digitos()

    historico[cotacao] = {
        valor: obValComp('preco_venda'),
        data: new Date().toLocaleString(),
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
        icms_saida: conversor(obValComp('icms_saida'))
    };

    // Verificar antes se a porcentagem é aceitável;
    const permitidos = ['adm', 'diretoria']
    const resultado = calcular(undefined, historico[cotacao])
    if (resultado.lucroPorcentagem < 10 && !permitidos.includes(acesso.permissao))
        return popup({ mensagem: 'Percentual de lucro não pode ser menor que 10%' })

    produto[lpu] = produto[lpu] || { historico: {} };
    produto[lpu].historico = historico;

    await inserirDados({ [codigo]: produto }, 'dados_composicoes')
    removerPopup()

    await abrirHistoricoPrecos(codigo, lpu)
    enviar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`, historico[cotacao])

}

async function confirmarExclusao_item(codigo) {

    const mensagem = `Tem certeza que deseja excluir este item?`
    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirItemComposicao('${codigo}')` }
    ]

    popup({ botoes, mensagem, nra: false })

}

async function excluirItemComposicao(codigo) {

    deletar(`dados_composicoes/${codigo}`)
    await deletarDB('dados_composicoes', codigo)

}

async function cadastrarItem(codigo) {

    const produto = await recuperarDado('dados_composicoes', codigo) || {}
    const funcao = codigo ? `salvarComposicao('${codigo}')` : `salvarComposicao()`

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao }
    ]

    if (codigo) botoes.push({
        texto: 'Excluir',
        img: 'cancel',
        funcao: `confirmarExclusao_item('${codigo}')`
    })

    const tipos = esquemas.tipo
        .map(op => `<option ${op == produto?.tipo ? 'selected' : ''}>${op}</option>`)
        .join('')

    const sistemas = esquemas.sistema
        .map(op => `<option ${op == produto?.sistema ? 'selected' : ''}>${op}</option>`)
        .join('')

    const linhas = [
        { texto: 'Descrição', elemento: `<textarea name="descricao" rows="5">${produto?.descricao || ''}</textarea>` },
        { texto: 'Fabricante', elemento: `<input name="fabricante" value="${produto?.fabricante || ''}">` },
        { texto: 'Modelo', elemento: `<input name="modelo" value="${produto?.modelo || ''}">` },
        { texto: 'Unidade', elemento: `<input name="unidade" value="${produto?.unidade || ''}">` },
        { texto: 'ncm', elemento: `<input name="ncm" value="${produto?.ncm || ''}">` },
        { texto: 'Omie', elemento: `<input name="omie" value="${produto?.omie || ''}">` },
        { texto: 'Tipo', elemento: `<select name="tipo">${tipos}</select>` },
        { texto: 'Sistema', elemento: `<select name="sistema">${sistemas}</select>` },
    ]

    popup({ linhas, botoes, titulo: 'Dados do Item' })

}

async function salvarComposicao(codigo) {

    overlayAguarde()
    const item = await recuperarDado('dados_composicoes', codigo) || {};

    if (!codigo) {

        const resposta = await verificarCodigoExistente();

        if (resposta.status == 'Falha') {
            return popup({ mensagem: 'Não foi possível cadastrar o item... tente novamente' })
        }

        codigo = resposta.status // Aqui é retornado o último número sequencial +1 para cadasto;
    }

    const campos = ['descricao', 'unidade', 'fabricante', 'modelo', 'ncm', 'omie', 'tipo', 'sistema']
    let novosDados = {}
    const painel = document.querySelector('.painel-padrao')
    for (const campo of campos) {
        const el = painel.querySelector(`[name="${campo}"]`)
        novosDados[campo] = el ? String(el.value).toUpperCase() : '';
    }

    const final = {
        ...item,
        ...novosDados,
        codigo: String(codigo)
    }

    enviar(`dados_composicoes/${codigo}`, final)
    await inserirDados({ [codigo]: final }, 'dados_composicoes')
    removerPopup()

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

async function verAgrupamento(codigo) {

    const produto = await recuperarDado('dados_composicoes', codigo)
    const elemento = `
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
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${['Descrição', 'Quantidade', 'Remover'].map(op => `<th>${op}</th>`).join('')}</tr>
                        </thead>
                        <tbody id="linhasAgrupamento"></tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>`

    const botoes = [
        { texto: 'Adicionar Item', img: 'baixar', funcao: `criarLinhaAgrupamento()` },
        { texto: 'Salvar Agrupamento', img: 'concluido', funcao: `salvarAgrupamento('${codigo}')` }
    ]

    popup({ elemento, botoes, titulo: 'Gerenciar itens do agrupamento', nra: false })

    const agrupamento = produto.agrupamento || {}
    for (const [cod, dados] of Object.entries(agrupamento)) {
        await criarLinhaAgrupamento(cod, dados)
    }

}

async function criarLinhaAgrupamento(cod, dados) {

    const produto = await recuperarDado('dados_composicoes', cod)
    const chaveUnica = ID5digitos()

    const tds = `
        <td>
            <span 
            class="opcoes"
            ${cod ? `id="${cod}"` : ''}
            name="${chaveUnica}" 
            onclick="cxOpcoes('${chaveUnica}', 'dados_composicoes', ['descricao', 'codigo', 'tipo', 'modelo', 'fabricante'])">
                ${produto?.descricao || 'Selecione'}
            </span>
        </td>
        <td>
            <input name="quantidade" class="campoValor" type="number" value="${dados?.qtde || ''}">
        </td>
        <td>
            <img src="imagens/cancel.png" style="width: 1.7rem;" onclick="this.closest('tr').remove()">
        </td>`

    const trExistente = document.getElementById(`AGRUP_${cod}`)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('linhasAgrupamento').insertAdjacentHTML('beforeend', `<tr id="AGRUP_${cod}">${tds}</tr>`)
}

async function salvarAgrupamento(codigo) {

    const linhasAgrupamento = document.getElementById('linhasAgrupamento')

    const trs = linhasAgrupamento.querySelectorAll('tr')

    const agrupamento = {}

    for (const tr of trs) {

        const tds = tr.querySelectorAll('td')
        const spanDesc = tds[0].querySelector('span')
        const codigo = spanDesc.id
        const qtde = Number(tr.querySelector('[name="quantidade"]').value || 0)

        tr.id = `AGRUP_${codigo}`
        agrupamento[codigo] = { qtde }

    }

    const produto = await recuperarDado('dados_composicoes', codigo) || {}
    produto.agrupamento = agrupamento

    if (Object.keys(agrupamento).length > 0) {
        await inserirDados({ [codigo]: produto }, 'dados_composicoes')
        enviar(`dados_composicoes/${codigo}/agrupamento`, agrupamento)
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

async function confirmarAtualizarData(tabela, codigo) {

    const produto = await recuperarDado('dados_composicoes', codigo)

    const elemento = `
        <div style="${vertical};">
            <span>${produto.descricao}</span>
            <span>Manter o preço por mais 60 dias?</span>
        </div>
    `

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `manterPreco('${tabela}', '${codigo}')` }
    ]


    popup({ elemento, botoes, titulo: 'Manter preço' })

}
