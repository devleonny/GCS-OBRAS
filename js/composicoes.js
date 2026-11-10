async function telaComposicoes() {

    try {

        overlayAguarde()

        if (!LPUS) {
            const { lpus } = await recuperarDado('mvw_lpus', 1) || {}
            LPUS = lpus
        }

        const filtroLpu = montarDropdownCheckbox({
            pag: 'composicoes',
            titulo: 'LPU',
            path: 'snapshots.validades.*.lpu',
            opcoes: LPUS || []
        })

        const btnExtras = `
            <div class="filtros">
                <div class="campo-pesquisa">
                    <span style="color: white;">Atrasados</span>
                    <select onchange="filtrarAtrasadosComposicoes(this)">
                        <option></option><option>Sim</option><option>Não</option>
                    </select>
                </div>
                ${filtroLpu}
            </div>
        `

        const pag = 'composicoes'
        const tabela = await modTab({
            btnExtras,
            detalhes: true,
            colunas: {
                'Código': { chave: 'id' },
                'Editar': {},
                'Imagem': {},
                'Descrição': { chave: 'descricao' },
                'Cod Omie': { chave: 'omie' },
                'ncm': { chave: 'ncm' },
                'Tipo': { chave: 'tipo' },
                'Unidade': { chave: 'unidade' },
                'Fabricante': { chave: 'fabricante' },
                'Modelo': { chave: 'modelo' },
                'Sistema': { chave: 'sistema' }
            },
            pag,
            base: 'dados_composicoes',
            body: 'bodyComposicoes',
            criarLinha: 'criarLinhaComposicao',
            substituicoes: [
                {
                    path: 'agrupamento.*.codigo',
                    tabela: 'dados_composicoes',
                    campoBusca: 'codigo',
                    retorno: 'descricao',
                    destino: 'agrupamento.*.descricao'
                },
                {
                    path: 'agrupamento.*.codigo',
                    tabela: 'dados_composicoes',
                    campoBusca: 'codigo',
                    retorno: 'tipo',
                    destino: 'agrupamento.*.tipo'
                }
            ]
        })

        tela.innerHTML = `
            <div class="pagina-conteudo">
                <div class="cabecalho-pagina"><h2>Composições</h2></div>
                ${tabela}
            </div>
        `
        removerOverlay()

        await paginacao(pag)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir as composições: Fale com o suporte.' })
    }

}

async function filtrarAtrasadosComposicoes(select) {

    const atrasados = select.value
    const chave = 'snapshots.validades.*.validade'
    controles.composicoes.filtros ??= {}

    controles.composicoes.filtros = {
        ...controles.composicoes.filtros,
        [chave]: { op: atrasados == 'Sim' ? '<d' : '>=d', value: dataServidor() }
    }

    if (!select.value)
        delete controles.composicoes.filtros[chave]

    await paginacao()

}

async function criarLinhaComposicao(produto) {

    const {
        id,
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

    for (const [cod, { tipo, qtde, descricao }] of Object.entries(agrupamento || {})) {

        divAgrupamento.push(`
            <tr>
                <td><span class="composicao-codigo" style="--cor-tipo: ${tipo == 'VENDA' ? '#a63c3c' : tipo == 'SERVIÇO' ? '#356443' : '#24729d'}">${cod}</span></td>
                <td>${descricao || 'Sem descrição'}</td>
                <td class="composicao-numero">${qtde || 0}</td>
            </tr>
            `
        )
    }

    // Um cartão por LPU: com preço primeiro, sem preço apagados no fim.
    const hojeISO = dataServidor().toLocaleDateString('en-CA') // AAAA-MM-DD no fuso local
    const validades = Object.fromEntries((produto?.snapshots?.validades || []).map(v => [v.lpu, v.validade]))
    const podeEditar = usuariosPermitidosParaEditar.includes(acesso.permissao)

    const precosLPU = (LPUS || [])
        .map(lpu => {
            const tabela = produto[lpu] || {}
            const cotacao = tabela?.historico?.[tabela?.ativo] || {}
            return { lpu, valor: Number(conversor(cotacao.valor || 0)) || 0, data: cotacao.data, validade: validades[lpu] }
        })
        .sort((a, b) => (b.valor > 0) - (a.valor > 0))

    const comPreco = precosLPU.filter(p => p.valor > 0).length

    const cartoesLPU = precosLPU
        .map(({ lpu, valor, data, validade }) => {
            const nome = String(lpu).replace(/^lpu\s+/i, '').toUpperCase()
            const vencido = valor > 0 && validade && validade < hojeISO
            const rodape = valor > 0
                ? `${data ? String(data).split(',')[0] : ''}${vencido ? ' <b class="composicao-lpu-vencido">vencido</b>' : ''}`
                : 'Sem preço'
            const conteudo = `
                <span class="composicao-lpu-nome" title="${escaparAtributo(String(lpu))}">${nome}</span>
                <span class="composicao-lpu-valor">${valor > 0 ? dinheiro(valor) : '—'}</span>
                <span class="composicao-lpu-rodape">${rodape}</span>`
            const classe = `composicao-lpu${valor > 0 ? '' : ' sem-valor'}${vencido ? ' vencido' : ''}`

            return podeEditar
                ? `<button type="button" class="${classe}" title="Ver histórico de preços" onclick="abrirHistoricoPrecos('${id}', '${lpu}')">${conteudo}</button>`
                : `<div class="${classe}">${conteudo}</div>`
        }).join('')

    const linha = `
        <tr>
            <td>${id}</td>
            <td style="text-align: center;">
                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
            ? `<img src="imagens/pesquisar.svg" style="width: 1.5rem; cursor: pointer;" onclick="cadastrarItem('${id}')">`
            : ''}
            </td>

            <td>
                <img name="${id}" 
                onclick="abrirImagem('${id}')" 
                style="width: 5rem;" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${imagem || logo}">
            </td>
            <td style="text-align: left; min-width: 200px;">${descricao || ''}</td>

            <td>${omie || ''}</td>
            <td>${ncm || ''}</td>
            <td>${tipo || ''}</td>
            <td>${unidade || ''}</td>
            <td>${fabricante || ''}</td>
            <td>${modelo || ''}</td>
            <td>${sistema || ''}</td>
            
        </tr>
    `

    const detalhes = `
        <div class="composicao-detalhes">
            <section class="composicao-bloco">
                <div class="composicao-bloco-topo">
                    <h3>Agrupamento <span class="composicao-contagem">${divAgrupamento.length}</span></h3>
                    <button type="button" class="composicao-agrupamento" onclick="verAgrupamento('${id}')">
                        <img src="imagens/construcao.png" alt="">Editar agrupamento
                    </button>
                </div>
                ${divAgrupamento.length ? `
                    <div class="composicao-tabela-contorno"><table class="composicao-tabela">
                        <thead><tr><th>Código</th><th>Descrição</th><th>Quantidade</th></tr></thead>
                        <tbody>${divAgrupamento.join('')}</tbody>
                    </table></div>` : '<p class="composicao-vazio">Nenhum item no agrupamento.</p>'}
            </section>
            <section class="composicao-bloco composicao-bloco-precos">
                <div class="composicao-bloco-topo">
                    <h3>Preços por tabela <span class="composicao-contagem">${comPreco} de ${precosLPU.length}</span></h3>
                </div>
                ${cartoesLPU
                    ? `<div class="composicao-lpus">${cartoesLPU}</div>`
                    : '<p class="composicao-vazio">Nenhuma tabela disponível.</p>'}
            </section>
        </div>
    `
    return { linha, detalhes }

}

// Popup que fica por baixo do histórico de preços quando ele abre de dentro de outro
// (ex.: requisição de colaboradores). Só os popups acima dele são fechados ao reabrir.
let popupBaseHistoricoPrecos = null

// Abre o histórico mantendo o popup atual aberto por baixo.
async function abrirHistoricoPrecosSobre(codigo, tabela) {
    popupBaseHistoricoPrecos = [...document.querySelectorAll('.popup')].at(-1)?.id || null
    await abrirHistoricoPrecos(codigo, tabela)
}

function fecharPopupsHistoricoPrecos() {
    const base = popupBaseHistoricoPrecos && document.getElementById(popupBaseHistoricoPrecos)
    if (!base) {
        popupBaseHistoricoPrecos = null
        return removerTodosPopups()
    }

    const popups = [...document.querySelectorAll('.popup')]
    popups.slice(popups.indexOf(base) + 1).forEach(p => removerPopup(p.id))
    removerOverlay()
}

async function abrirHistoricoPrecos(codigo, tabela) {

    overlayAguarde()

    // LPUS só é carregada por composições/orçamentos; de outras telas vem vazia.
    if (!LPUS) {
        const { lpus } = await recuperarDado('mvw_lpus', 1) || {}
        LPUS = lpus
    }

    const produto = await recuperarDado('dados_composicoes', codigo) || {}
    const linhas = []

    const gerada = produto?.[tabela]?.gerada

    if (gerada)
        return popup({ mensagem: 'Esta coluna é automática e por isso não é editável!' })

    for (const [id, cotacao] of Object.entries(produto?.[tabela]?.historico || {})) {

        const marcado = produto[tabela]?.ativo == id

        linhas.push(`
        <tr>
            <td style="white-space: nowrap;">${dinheiro(cotacao?.custo || 0)}</td>
            <td style="white-space: nowrap;">${dinheiro(cotacao?.valor_custo || cotacao?.custo || 0)}</td>
            <td style="text-align: center;">${cotacao?.margem || 0}</td>
            <td style="white-space: nowrap;">${dinheiro(cotacao?.valor)}</td>
            <td>${cotacao?.data}</td>
            <td>${cotacao?.usuario}</td>
            <td>${cotacao?.fornecedor || ''}</td>

            <td>
                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
                ? `<input type="radio" name="preco" style="width: 35px; height: 35px; cursor: pointer;" onclick="salvarPrecoAtivo('${codigo}', '${id}', '${tabela}')" ${marcado ? 'checked' : ''}>`
                : ''}
            </td>
            
            <td>
                <div style="white-space: pre;">${cotacao?.comentario || ''}</div>
            </td>
            <td style="text-align: center;">
                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
                ? `<img src="imagens/cancel.png" style="width: 1.7rem; cursor: pointer;" onclick="excluirCotacao('${codigo}', '${tabela}', '${id}')">`
                : ''}
            </td>
            <td style="text-align: center;">
               <img src="imagens/pesquisar.svg" style="width: 1.7rem; cursor: pointer;" onclick="adicionarCotacao('${codigo}', '${tabela}', '${id}')">
            </td>
        </tr>
        `)
    }

    const linOutrosPrecos = []
    for (const lpu of LPUS || []) {
        const tab = produto[lpu] || {}

        const ativo = tab?.ativo
        const historico = tab?.historico || {}
        const preco = historico[ativo]?.valor || 0
        const tabelaAtiva = lpu == tabela

        const copiar = preco !== 0 && !tabelaAtiva && permComposicoes.includes(acesso?.permissao)
            ? `<img src="imagens/duplicar.png" onclick="confirmarCopiarPreco('${codigo}', '${lpu}', '${ativo}', '${tabela}')">`
            : ''

        linOutrosPrecos.push(`
            <tr ${tabelaAtiva ? 'style="background-color: #b5ffb5;"' : ''}>
                <td>${lpu.toUpperCase()}</td>
                <td>
                    <div style="${horizontal}; gap: 5px;">
                        <span>${dinheiro(preco)}</span>
                        ${copiar}
                    </div>
                </td>
            </tr>`
        )
    }

    const colunas = [
        'Preço Unitário',
        'Valor de Custo',
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

    const acumulado = `
        <div style="${horizontal}; align-items: start; width: 100%; justify-content: space-between; gap: 1rem;">
            <div style="${horizontal}; gap: 5px;">
                <img style="width: 7vw; border-radius: 5px;" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${produto?.imagem || logo}">
                <div style="${vertical}">
                    <label><b>Descrição</b></label>
                    <label>${produto?.descricao || ''}</label>
                </div>
            </div>

            <button onclick="adicionarCotacao('${codigo}', '${tabela}')">Adicionar Preço</button>

        </div>

        <hr>

        <div class="tabelas-preco">
            <!-- Vem antes no HTML para, empilhada no retrato, não reduzir a altura do histórico. -->
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span style="color: white; font-size: 1.1rem;">Preços em outras tabelas</span>
                </div>
                <div class="div-tabela" data-altura-adaptavel="false">
                    <table class="tabela">
                        <thead>
                            ${['Tabela', 'Valor'].map(op => `<th>${op}</th>`).join('')} 
                        </thead>
                        <tbody>${linOutrosPrecos.join('')}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

            <div class="borda-tabela">
                <div class="topo-tabela">
                    <span style="color: white; font-size: 1.1rem;">Histórico de Preços</span>
                </div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            ${colunas.map(op => `<th>${op}</th>`).join('')} 
                        </thead>
                        <tbody>${linhas.join('')}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
    `

    fecharPopupsHistoricoPrecos()

    popup({ elemento: `<div class="historico-preco">${acumulado}</div>`, titulo: 'Preços Cadastrados' })

}

async function confirmarCopiarPreco(codigo, lpu, idPreco, tabela) {

    overlayAguarde()
    const produto = await recuperarDado('dados_composicoes', codigo) || {}

    const preco = produto?.[lpu]?.historico?.[idPreco] || {}
    preco.usuario = acesso.usuario // Usuário atual;

    await enviar(`dados_composicoes/${codigo}/${tabela}/historico/${idPreco}`, preco)

    await abrirHistoricoPrecos(codigo, tabela)

    removerOverlay()

}

async function salvarPrecoAtivo(codigo, idPreco, lpu) {

    await enviar(`dados_composicoes/${codigo}/${lpu}/ativo`, idPreco)

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

    await deletar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`)

    removerPopup()
    await abrirHistoricoPrecos(codigo, lpu);

}

const ICMS_POR_ORIGEM = {
    'IMPORTADO': 4,
    'NACIONAL': 12,
    'BAHIA': 20.5,
    '7%': 7
}

const ICMS_BAHIA = 20.5

// Reforma tributária (EC 132/2023, LC 214/2025) — só simulação, não altera o preço salvo.
// Alíquotas de referência ainda estimadas (CBS + IBS ≈ 26,5%); cada estado usa a de
// referência até publicar a própria em IBS_POR_UF.
const REFORMA = { cbs: 8.8, ibsUF: 14.7, ibsMun: 3 }
const IBS_POR_UF = {}
const UFS = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB',
    'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO']
// Fração de ICMS/ISS que ainda resta em cada ano da transição.
const TRANSICAO = { 2027: 1, 2028: 1, 2029: 0.9, 2030: 0.8, 2031: 0.7, 2032: 0.6, 2033: 0 }

// Último cálculo exibido no modal; o salvamento usa os mesmos valores mostrados.
let ultimoCalculoPreco = null

function porcentagem(valor) {
    return `${(Number(valor) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

// Lucro presumido de serviço, também aplicado a Uso e Consumo.
function impostosPresumidoServico(precoVenda) {
    const aliqPresumido = precoVenda * 0.32
    const presuncaoCsll = precoVenda * 0.32
    const irpj = aliqPresumido * 0.15
    const adicionalIrpj = aliqPresumido * 0.10
    const csll = presuncaoCsll * 0.09
    const pis = precoVenda * 0.0065
    const cofins = precoVenda * 0.03
    const iss = precoVenda * 0.05
    const totalImpostos = irpj + adicionalIrpj + csll + pis + cofins + iss

    return { aliqPresumido, presuncaoCsll, irpj, adicionalIrpj, csll, pis, cofins, iss, totalImpostos }
}

function impostosPresumidoComercio(precoVenda, aliquotaIcmsSaida) {
    const lucroPresumido = precoVenda * 0.08
    const presuncaoCsll = precoVenda * 0.12
    const irpj = lucroPresumido * 0.15
    const adicionalIrpj = lucroPresumido * 0.1
    const csll = presuncaoCsll * 0.09
    const pis = precoVenda * 0.0065
    const cofins = precoVenda * 0.03
    const icms = precoVenda * (aliquotaIcmsSaida / 100)
    const totalImpostos = irpj + adicionalIrpj + csll + pis + cofins + icms

    return { lucroPresumido, presuncaoCsll, irpj, adicionalIrpj, csll, pis, cofins, icms, totalImpostos }
}

// Custo de entrada da mercadoria; com fixarPreco a margem é derivada do preço informado.
function custoMercadoria({ precoCompra, icmsCreditado, aliquotaIcms, margem, precoVenda, fixarPreco }) {
    const frete = precoCompra * 0.02
    const difal = aliquotaIcms - icmsCreditado
    const icmsEntrada = difal / 100 * precoCompra
    const valorCusto = icmsEntrada + precoCompra + frete

    if (fixarPreco)
        margem = valorCusto ? Number(((precoVenda / valorCusto - 1) * 100).toFixed(2)) : 0
    else
        precoVenda = (1 + margem / 100) * valorCusto

    const freteVenda = precoVenda * 0.05

    return { frete, difal, icmsEntrada, valorCusto, margem, precoVenda, freteVenda }
}

function resumoLucro(base, totalCusto) {
    base = Number(base) || 0
    const lucroLiquido = base - (Number(totalCusto) || 0)
    const lucroPorcentagem = base ? lucroLiquido / base * 100 : 0

    return { lucroLiquido, lucroPorcentagem }
}

function calcularPreco(tipo, entradas) {

    if (tipo == 'SERVIÇO') {
        const { precoVenda } = entradas
        const maoObra = precoVenda * 0.3
        const impostos = impostosPresumidoServico(precoVenda)

        return {
            precoVenda,
            maoObra,
            ...impostos,
            ...resumoLucro(precoVenda, impostos.totalImpostos + maoObra)
        }
    }

    if (tipo == 'VENDA' || tipo == 'USO E CONSUMO') {
        const venda = tipo == 'VENDA'
        const custo = custoMercadoria({
            ...entradas,
            aliquotaIcms: venda ? entradas.aliquotaIcmsSaida : ICMS_BAHIA
        })
        const impostos = venda
            ? impostosPresumidoComercio(custo.precoVenda, entradas.aliquotaIcmsSaida)
            : impostosPresumidoServico(custo.precoVenda)

        return {
            icmsCreditado: entradas.icmsCreditado,
            ...custo,
            ...impostos,
            ...resumoLucro(custo.precoVenda, impostos.totalImpostos + (custo.valorCusto + custo.freteVenda))
        }
    }

    return null
}

// Preço líquido que mantém o lucro de hoje sem PIS/COFINS e com ICMS/ISS reduzidos;
// IBS e CBS entram por fora, sobre a base sem ICMS/ISS. IRPJ/CSLL seguem iguais.
function calcularReforma(tipo, entradas, atual, ano, uf) {
    if (!atual) return null

    const antigo = TRANSICAO[ano] ?? 0
    const ibsUF = IBS_POR_UF[uf] ?? REFORMA.ibsUF
    const cbsAliq = ano <= 2028 ? REFORMA.cbs - 0.1 : REFORMA.cbs
    const ibsAliq = ano <= 2028 ? 0.1 : (ibsUF + REFORMA.ibsMun) * (1 - antigo)

    const venda = tipo == 'VENDA'
    const servico = tipo == 'SERVIÇO'

    // O IBS/CBS pago na compra vira crédito; o ICMS de entrada cai junto com o ICMS.
    const custo = servico ? 0 : entradas.precoCompra + atual.frete + atual.icmsEntrada * antigo

    const presumido = venda ? 0.08 * 0.25 + 0.12 * 0.09 : 0.32 * 0.25 + 0.32 * 0.09
    const icmsPerc = venda ? entradas.aliquotaIcmsSaida / 100 * antigo : 0
    const issPerc = venda ? 0 : 0.05 * antigo
    const despesaPerc = servico ? 0.3 : 0.05 // mão de obra ou frete de venda

    const precoLiquido = (atual.lucroLiquido + custo) / (1 - presumido - icmsPerc - issPerc - despesaPerc)
    const base = precoLiquido * (1 - icmsPerc - issPerc)
    const cbs = base * cbsAliq / 100
    const ibs = base * ibsAliq / 100
    const total = precoLiquido + cbs + ibs

    return {
        custo,
        precoLiquido,
        antigoPerc: antigo * 100,
        icmsIss: precoLiquido * (icmsPerc + issPerc),
        irpjCsll: precoLiquido * presumido,
        base,
        cbsAliq,
        ibsAliq,
        cbs,
        ibs,
        total,
        totalHoje: atual.precoVenda,
        diferenca: atual.precoVenda ? (total / atual.precoVenda - 1) * 100 : 0
    }
}

function entradasPreco(campo) {
    const numero = id => Number(document.getElementById(id)?.value || 0)
    const opcao = id => document.getElementById(id)?.value || ''

    return {
        precoCompra: numero('custo'),
        margem: numero('margem'),
        precoVenda: numero('preco_venda'),
        icmsCreditado: ICMS_POR_ORIGEM[opcao('icms_creditado_select')],
        aliquotaIcmsSaida: conversor(opcao('icms_saida_select')),
        fixarPreco: campo == 'preco_venda'
    }
}

function calcular(campo) {

    const painel = document.querySelector('.calc-preco')
    if (!painel) return

    const resultado = calcularPreco(painel.dataset.tipo, entradasPreco(campo))
    ultimoCalculoPreco = resultado
    if (!resultado) return

    // Margem e preço se alimentam: atualiza o que não foi digitado.
    if (resultado.valorCusto !== undefined) {
        if (campo == 'preco_venda')
            document.getElementById('margem').value = resultado.margem
        else
            document.getElementById('preco_venda').value = Number(resultado.precoVenda.toFixed(2))
    }

    const opcao = id => document.getElementById(id)?.value
    const reforma = calcularReforma(painel.dataset.tipo, entradasPreco(campo), resultado, Number(opcao('reforma_ano')), opcao('reforma_uf')) || {}
    const valores = { ...resultado }
    for (const [chave, valor] of Object.entries(reforma)) valores[`r_${chave}`] = valor

    for (const el of painel.querySelectorAll('[data-chave]')) {
        const valor = valores[el.dataset.chave]
        el.innerHTML = el.dataset.formato == 'porcentagem'
            ? porcentagem(valor)
            : dinheiro(valor)

        if ('lucro' in el.dataset) {
            el.classList.toggle('lucroPositivo', resultado.lucroLiquido > 0)
            el.classList.toggle('lucroNegativo', !(resultado.lucroLiquido > 0))
        }
    }
}

function linhaPreco({ label, id, tipo = 'saida', valor, chave, formato, select, opcoes = [], valorSelect, classe = '' }) {

    const caixaSelecao = select
        ? `<select id="${select}" onchange="calcular('${select}')">
            ${opcoes.map(op => `<option ${valorSelect == op ? 'selected' : ''}>${op}</option>`).join('')}
        </select>`
        : ''

    const valorCampo = escaparAtributo(String(valor || ''))

    const campos = {
        numero: `<input id="${id}" type="number" step="any" inputmode="decimal" autocomplete="off" oninput="calcular('${id}')" value="${valorCampo}">`,
        texto: `<input id="${id}" autocomplete="off" value="${valorCampo}">`,
        area: `<textarea id="${id}" rows="3">${valorCampo}</textarea>`,
        fixo: `<span class="calc-preco-valor">${valor}</span>`,
        saida: `<output class="calc-preco-valor" data-chave="${chave}" ${formato ? `data-formato="${formato}"` : ''}></output>`
    }

    const largura = ['texto', 'area'].includes(tipo) ? ' calc-preco-linha-larga' : ''

    return `
        <div class="calc-preco-linha${largura} ${classe}">
            <label class="calc-preco-rotulo" ${id ? `for="${id}"` : ''}>${label}${caixaSelecao}</label>
            ${campos[tipo]}
        </div>`
}

function cardPreco(titulo, linhas) {
    return `
        <section class="calc-preco-card">
            <h3>${titulo}</h3>
            ${linhas.map(linhaPreco).join('')}
        </section>`
}

function secoesPreco(produto) {

    const { tipo } = produto
    const mercadoria = tipo == 'VENDA' || tipo == 'USO E CONSUMO'
    if (!mercadoria && tipo != 'SERVIÇO')
        return null

    const precoVenda = { label: 'Preço de Venda (R$)', id: 'preco_venda', tipo: 'numero', valor: produto?.valor }

    const esquerda = []
    const direita = []

    if (mercadoria) {
        esquerda.push(
            cardPreco('Custo de Compra', [
                { label: 'Preço Unitário (R$)', id: 'custo', tipo: 'numero', valor: produto?.custo },
                { label: 'Frete de Compra (2%)', chave: 'frete' },
                {
                    label: 'ICMS Creditado em nota',
                    select: 'icms_creditado_select',
                    opcoes: tipo == 'VENDA' ? ['IMPORTADO', 'NACIONAL', 'BAHIA', '7%'] : ['IMPORTADO', 'NACIONAL', 'BAHIA'],
                    valorSelect: produto?.icms_creditado_select,
                    chave: 'icmsCreditado',
                    formato: 'porcentagem'
                },
                { label: 'Alíquota ICMS (Bahia)', tipo: 'fixo', valor: porcentagem(ICMS_BAHIA) },
                { label: 'ICMS a ser pago (DIFAL)', chave: 'difal', formato: 'porcentagem' },
                { label: 'Valor do ICMS de Entrada', chave: 'icmsEntrada' },
                { label: 'Valor de Custo', chave: 'valorCusto', classe: 'calc-preco-total' }
            ]),
            cardPreco('Preço de Venda', [
                { label: 'Margem de Acréscimo (%)', id: 'margem', tipo: 'numero', valor: produto?.margem },
                precoVenda,
                { label: 'Frete de Venda (5%)', chave: 'freteVenda' }
            ])
        )
    } else {
        esquerda.push(
            cardPreco('Serviço', [{ ...precoVenda, label: 'Valor do Serviço (R$)' }]),
            cardPreco('Mão de Obra', [{ label: 'Coeficiente de Mão de Obra (30%)', chave: 'maoObra' }])
        )
    }

    esquerda.push(cardPreco('Complementares', [
        { label: 'NF de Compra', id: 'nota', tipo: 'texto', valor: produto?.nota },
        { label: 'Fornecedor', id: 'fornecedor', tipo: 'texto', valor: produto?.fornecedor },
        { label: 'Comentário', id: 'comentario', tipo: 'area', valor: produto?.comentario }
    ]))

    const impostosComuns = [
        { label: 'IRPJ (15%)', chave: 'irpj' },
        { label: 'Adicional IRPJ (10%)', chave: 'adicionalIrpj' },
        { label: 'CSLL (9%)', chave: 'csll' },
        { label: 'PIS (0,65%)', chave: 'pis' },
        { label: 'COFINS (3%)', chave: 'cofins' }
    ]

    const total = { label: 'Total de Impostos', chave: 'totalImpostos', classe: 'calc-preco-total' }

    if (tipo == 'VENDA') {
        direita.push(
            cardPreco('Presunções', [
                { label: 'Lucro Presumido Comércio (8%)', chave: 'lucroPresumido' },
                { label: 'Presunção CSLL (12%)', chave: 'presuncaoCsll' }
            ]),
            cardPreco('Impostos', [
                ...impostosComuns,
                { label: 'ICMS de Saída', select: 'icms_saida_select', opcoes: ['20,5%', '12%', '4%'], chave: 'icms' },
                total
            ])
        )
    } else {
        direita.push(
            cardPreco('Presunções', [
                { label: 'Lucro Presumido Serviço (32%)', chave: 'aliqPresumido' },
                { label: 'Presunção CSLL (32%)', chave: 'presuncaoCsll' }
            ]),
            cardPreco('Impostos', [
                ...impostosComuns,
                { label: 'ISS (5%)', chave: 'iss' },
                total
            ])
        )
    }

    const resultado = `
        <section class="calc-preco-card">
            <h3>Resultado</h3>
            <div class="calc-preco-resultado">
                <div>
                    <span>Lucro Líquido</span>
                    <strong data-chave="lucroLiquido" data-lucro></strong>
                </div>
                <div>
                    <span>Percentual de Lucro</span>
                    <strong data-chave="lucroPorcentagem" data-formato="porcentagem" data-lucro></strong>
                </div>
            </div>
        </section>`

    const aliquota = chave => `<small class="calc-preco-aliquota" data-chave="${chave}" data-formato="porcentagem"></small>`
    const tributoAntigo = tipo == 'VENDA' ? 'ICMS' : 'ISS'

    const reforma = `
        <section class="calc-preco-card calc-preco-reforma">
            <h3>Reforma Tributária (simulação)</h3>
            <p class="calc-preco-nota">Mantém o lucro líquido de hoje. IBS e CBS são cobrados por fora; alíquotas de referência ainda estimadas.</p>
            <div class="calc-preco-resultado">
                <div>
                    <span>Total hoje</span>
                    <strong data-chave="r_totalHoje"></strong>
                </div>
                <div>
                    <span>Total ao cliente</span>
                    <strong data-chave="r_total"></strong>
                </div>
                <div>
                    <span>Diferença</span>
                    <strong data-chave="r_diferenca" data-formato="porcentagem"></strong>
                </div>
            </div>
            ${[
            { label: 'Estado de destino', select: 'reforma_uf', opcoes: UFS, valorSelect: 'BA', chave: 'r_ibsAliq', formato: 'porcentagem' },
            { label: `Ano de faturamento <small>(${tributoAntigo} restante)</small>`, select: 'reforma_ano', opcoes: Object.keys(TRANSICAO), valorSelect: '2033', chave: 'r_antigoPerc', formato: 'porcentagem' },
            ...(mercadoria ? [{ label: 'Custo (com crédito de IBS/CBS)', chave: 'r_custo' }] : []),
            { label: 'Preço Líquido', chave: 'r_precoLiquido', classe: 'calc-preco-total' },
            { label: `${tributoAntigo} da transição`, chave: 'r_icmsIss' },
            { label: 'IRPJ + CSLL', chave: 'r_irpjCsll' },
            { label: 'Base do IBS/CBS', chave: 'r_base' },
            { label: `CBS ${aliquota('r_cbsAliq')}`, chave: 'r_cbs' },
            { label: `IBS ${aliquota('r_ibsAliq')}`, chave: 'r_ibs' },
            { label: 'Total ao cliente', chave: 'r_total', classe: 'calc-preco-total' }
        ].map(linhaPreco).join('')}
        </section>`

    return `
        <div class="calc-preco" data-tipo="${escaparAtributo(tipo)}">
            <div class="calc-preco-coluna">${esquerda.join('')}</div>
            <div class="calc-preco-coluna">${resultado}${direita.join('')}</div>
            <div class="calc-preco-coluna">${reforma}</div>
        </div>`
}

async function adicionarCotacao(codigo, lpu, cotacao) {

    overlayAguarde()

    let produto = await recuperarDado('dados_composicoes', codigo) || {}

    if (lpu && cotacao) {
        produto = {
            ...produto,
            ...produto[lpu]?.historico?.[cotacao]
        }
    }

    const elemento = secoesPreco(produto)
    if (!elemento)
        return popup({ mensagem: 'Defina o tipo do item (VENDA, SERVIÇO ou USO E CONSUMO) para calcular o preço.' })

    const funcao = cotacao
        ? `salvarPreco('${codigo}', '${lpu}', '${cotacao}')`
        : `salvarPreco('${codigo}', '${lpu}')`

    const botoes = []

    if (usuariosPermitidosParaEditar)
        botoes.push({ texto: 'Salvar Preço', img: 'concluido', funcao })

    popup({ botoes, elemento, titulo: produto.tipo, cor: '#eef3f0' })

    calcular()

}

async function salvarPreco(codigo, lpu, cotacao = crypto.randomUUID()) {

    overlayAguarde()

    // Campos ausentes no tipo (ex.: custo em SERVIÇO) são gravados vazios.
    const campo = id => document.getElementById(id)
    const numero = id => campo(id) ? Number(campo(id).value || 0) : ''
    const texto = id => campo(id)?.value ?? ''

    const icmsSaida = texto('icms_saida_select')

    const produto = await recuperarDado('dados_composicoes', codigo) || {}
    const historico = produto[lpu]?.historico || {}

    if (produto.tipo == 'VENDA' && icmsSaida !== '20,5%')
        return popup({ mensagem: 'ICMS de saída por segurança não pode ser menor que <b>20,5%</b>.', titulo: 'ICMS de Saída bloqueado' })

    const calculo = ultimoCalculoPreco || {}

    historico[cotacao] = {
        valor: numero('preco_venda'),
        data: dataServidor().toLocaleString(),
        usuario: acesso.usuario,
        nota: texto('nota'),
        comentario: texto('comentario'),
        margem: numero('margem'),
        fornecedor: texto('fornecedor'),
        custo: numero('custo'),
        valor_custo: calculo.valorCusto !== undefined ? Number(calculo.valorCusto.toFixed(2)) : '',
        icms_creditado: calculo.icmsCreditado ?? '',
        icms_creditado_select: texto('icms_creditado_select'),
        modalidade_icms: '',
        icms_saida: calculo.icms !== undefined ? Number(calculo.icms.toFixed(0)) : 0
    }

    // Verificar antes se a porcentagem é aceitável;
    const permitidos = ['adm', 'diretoria']
    const resultado = calcularPreco(produto.tipo, entradasPreco('preco_venda'))
    if (resultado?.lucroPorcentagem < 10 && !permitidos.includes(acesso.permissao))
        return popup({ mensagem: 'Percentual de lucro não pode ser menor que 10%' })

    removerPopup()

    await enviar(`dados_composicoes/${codigo}/${lpu}/historico/${cotacao}`, historico[cotacao])
    await abrirHistoricoPrecos(codigo, lpu)

}


async function confirmarExclusaoItem(codigo) {

    const mensagem = `Tem certeza que deseja excluir este item?`
    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirItemComposicao('${codigo}')` }
    ]

    popup({ botoes, mensagem, removerAnteriores: true })

}

async function excluirItemComposicao(codigo) {

    await deletar(`dados_composicoes/${codigo}`)

}

async function cadastrarItem(codigo) {

    try {

        overlayAguarde()

        const produto = await recuperarDado('dados_composicoes', codigo) || {}

        const botoes = [
            {
                texto: 'Salvar',
                img: 'concluido',
                funcao: codigo
                    ? `salvarComposicao('${codigo}')`
                    : `salvarComposicao()`
            }
        ]

        if (codigo)
            botoes.push({
                texto: 'Excluir',
                img: 'cancel',
                funcao: `confirmarExclusaoItem('${codigo}')`
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
            { texto: 'Unidade', elemento: `<input name="unidade" value="${produto?.unidade || 'UN'}">` },
            { texto: 'ncm', elemento: `<input name="ncm" value="${produto?.ncm || ''}">` },
            { texto: 'Omie', elemento: `<input name="omie" value="${produto?.omie || ''}">` },
            { texto: 'Tipo', elemento: `<select name="tipo" onchange="alternarClassificacaoItem(this)">${tipos}</select>` },
            { texto: 'Sistema', elemento: `<select name="sistema">${sistemas}</select>` },
            // Obrigatória para produtos: só EQUIPAMENTO entra no orçamento de locação; MATERIAL vai em orçamento comum.
            { texto: 'Classificação *', elemento: campoClassificacaoItem(produto) },
        ]

        popup({ linhas, botoes, titulo: 'Dados do Item' })

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o item: Fale com o suporte.' })
    }

}

const CLASSIFICACOES_ITEM = { EQUIPAMENTO: 'Equipamento', MATERIAL: 'Material' }

// Serviço não tem classificação: o seletor some e o item é salvo sem ela.
function itemPrecisaClassificacao(tipo) {
    return tipo !== 'SERVIÇO'
}

function campoClassificacaoItem(produto) {
    const tipo = produto?.tipo || esquemas.tipo[0]
    const opcoes = Object.entries(CLASSIFICACOES_ITEM).map(([valor, texto]) => `
        <label class="classificacao-opcao">
            <input type="radio" name="classificacao" value="${valor}" ${produto?.classificacao === valor ? 'checked' : ''}>
            <span>${texto}</span>
        </label>`).join('')
    return `
        <div class="classificacao-item" data-classificacao ${itemPrecisaClassificacao(tipo) ? '' : 'hidden'}>${opcoes}</div>
        <span class="classificacao-servico" ${itemPrecisaClassificacao(tipo) ? 'hidden' : ''}>Não se aplica a serviço</span>`
}

function alternarClassificacaoItem(select) {
    const painel = select.closest('.painel-padrao')
    const precisa = itemPrecisaClassificacao(select.value)
    painel.querySelector('[data-classificacao]').hidden = !precisa
    painel.querySelector('.classificacao-servico').hidden = precisa
}

async function salvarComposicao(codigo) {

    try {

        const campos = ['descricao', 'unidade', 'fabricante', 'modelo', 'ncm', 'omie', 'tipo', 'sistema']
        const produto = {}
        // O mais recente: "Criar item" também abre por cima de outros popups (ex.: requisição).
        const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)

        const tipo = painel.querySelector('[name="tipo"]')?.value || ''
        const classificacao = painel.querySelector('[name="classificacao"]:checked')?.value || ''
        if (itemPrecisaClassificacao(tipo) && !classificacao)
            return popup({ mensagem: 'Escolha a classificação do item: <b>Equipamento</b> ou <b>Material</b>.' })

        overlayAguarde()

        produto.classificacao = itemPrecisaClassificacao(tipo) ? classificacao : null

        for (const campo of campos) {
            const el = painel.querySelector(`[name="${campo}"]`)
            // Normalização unicode;
            produto[campo] = campo !== 'tipo'
                ? String(el.value)
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toUpperCase()
                : el?.value || ''
        }

        await enviar(`dados_composicoes/${codigo || '0000'}`, produto)

        removerPopup()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao cadastrar item: Fale com o suporte.' })
    }

}

async function verAgrupamento(codigo) {

    try {

        overlayAguarde()

        const {
            agrupamento,
            imagem,
            descricao
        } = await recuperarDado('dados_composicoes', codigo)

        const linhas = [
            {
                elemento: `
            <div style="${horizontal}; max-width: 400px; text-align: left; gap: 0.5rem;">

                <img referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo" src="${imagem || logo}" style="width: 6rem;">

                <div style="${vertical}">
                    <span>Agrupamento do Item:</span>
                    <span><b>${descricao}</b></span>
                    <br>
                    <span>
                        Explicação: <br>Para cada 1 <b>${String(descricao || '').slice(0, 10)}</b><br> 
                        Será lançada a quantidade abaixo de cada item
                    </span>
                </div>
                
            </div>`
            },
            {
                elemento: `
            <div class="borda-tabela">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${['Descrição', 'Quantidade'].map(op => `<th>${op}</th>`).join('')}</tr>
                        </thead>
                        <tbody id="linhasAgrupamento"></tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>`
            }
        ]

        const botoes = [
            { texto: 'Adicionar Item', img: 'baixar', funcao: `criarLinhaAgrupamento()` },
            { texto: 'Salvar Agrupamento', img: 'concluido', funcao: `salvarAgrupamento('${codigo}')` }
        ]

        popup({ linhas, botoes, titulo: 'Gerenciar itens do agrupamento' })

        await Promise.all(
            Object.entries(agrupamento || {})
                .map(async ([cod, dados]) => {

                    criarLinhaAgrupamento(cod, dados)

                })
        )

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o agrupamento: Fale com o suporte.' })
    }

}

async function criarLinhaAgrupamento(cod, dados) {

    const produto = await recuperarDado('dados_composicoes', cod)
    const chaveUnica = crypto.randomUUID()

    controlesCxOpcoes[chaveUnica] = {
        base: 'dados_composicoes',
        retornar: ['descricao'],
        colunas: {
            'Código': { chave: 'codigo' },
            'Tipo': { chave: 'tipo' },
            'Descrição': { chave: 'descricao' },
            'Modelo': { chave: 'modelo' },
            'Fabricante': { chave: 'fabricante' },
        }
    }

    const tds = `
        <td>
            <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/fechar.png" onclick="this.closest('tr').remove()">
            <span 
            class="opcoes"
            ${cod ? `id="${cod}"` : ''}
            name="${chaveUnica}" 
            onclick="cxOpcoes('${chaveUnica}')">
                ${produto?.descricao || 'Selecione'}
            </span>
        </td>
        <td>
            <input name="quantidade"  type="number" value="${dados?.qtde || ''}">
        </td>
        `

    document.getElementById('linhasAgrupamento').insertAdjacentHTML('beforeend', `<tr>${tds}</tr>`)
}

async function salvarAgrupamento(codigo) {

    overlayAguarde()

    const linhasAgrupamento = document.getElementById('linhasAgrupamento')

    const trs = [...linhasAgrupamento.querySelectorAll('tr')]

    const agrupamento = {}

    for (const tr of trs) {

        const span = tr.querySelector('span')

        if (span.textContent.includes('Selecione'))
            continue

        const codigo = span.id
        const qtde = Number(tr.querySelector('[name="quantidade"]').value || 0)

        agrupamento[codigo] = {
            codigo,
            qtde
        }

    }

    await enviar(`dados_composicoes/${codigo}/agrupamento`, agrupamento)

    removerPopup()

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

    const hoje = dataServidor()
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


async function baixarExcelComposicoes() {

    overlayAguarde()

    const dados = {
        base: "vw_relatorio_composicoes",
        titulo: `Composições_${agoraServidor()}`,
        formatacao: {
            datas: ['Data'],
            moedas: ['Valor LPU']
        }
    }

    try {
        await baixarRelatorioExcel(dados)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }

}
