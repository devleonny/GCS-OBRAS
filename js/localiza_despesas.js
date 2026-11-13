// ---------------- Veículos → Despesas Localiza: rateio por centro de custo (departamento) ----------------
// Lista as contas a pagar da Localiza (vw_localiza_despesas, gcs/migrations/localiza-rateio.sql e localiza-multas.sql):
//   A ratear: sem rateio, com "EMPRESA" (padrão do Omie: ainda precisa dividir) ou que não fecha o valor;
//   Rateados: já divididos (podem ser refeitos); Arquivo morto: histórico (2023–2025).
//   Multas (aba no topo): categoria com "multa" no nome ou marcadas aqui pelo usuário
//     (/veiculos/localiza/classificar); saem das pendências, qualquer que seja o departamento.
// O rateio vai direto ao Omie (gcs /veiculos/localiza/ratear), um título por vez, e substitui o atual;
// depois de gravado o título sai de "A ratear" sozinho. "Atualizar do Omie" puxa as alterações recentes.
// Layout no modelo do RH (js/rh.js): fundo branco, visões em pílula, filtros e legenda no topo, tabela com
// cabeçalho verde-escuro e detalhes expansíveis.

const ABAS_LOCALIZA = [['A RATEAR', 'A ratear'], ['RATEADO', 'Rateados'], ['ARQUIVO MORTO', 'Arquivo morto'], ['MULTA', 'Multas']]
const SETORES_LOCALIZA = ['ASSISTENCIA TÉCNICA', 'PROJETOS', 'COMERCIAL', 'LOGISTICA']
const MES_LOCALIZA = /^(JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*-\s*\d{4}$/i
const SITUACOES_LOCALIZA = {
    'A RATEAR': { cor: 'laranja', texto: 'A ratear' },
    'RATEADO': { cor: 'verde', texto: 'Rateado' },
    'ARQUIVO MORTO': { cor: 'cinza', texto: 'Arquivo morto' },
    'MULTA': { cor: 'vermelho', texto: 'Multa' }
}

const estadoLocaliza = { aba: 'A RATEAR', linhas: new Map(), destinos: null, destinosPorId: new Map() }
const editorLocaliza = { id: null, modo: 'percentual', partes: [], aberto: null, busca: '' }

const reaisLoc = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBrLoc = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''
const escLoc = v => escaparAtributo(v ?? '')
const destinoInvalidoLoc = nome => {
    const n = String(nome || '').trim().toUpperCase()
    return !n || n === 'EMPRESA' || n === 'ARQUIVO MORTO' || MES_LOCALIZA.test(n)
}
// Situação que a tabela mostra agora (Multas é uma das abas).
const situacaoAtualLoc = () => estadoLocaliza.aba
const bolinhaLoc = situacao => `<span class="loc-bolinha ${SITUACOES_LOCALIZA[situacao]?.cor || ''}" title="${escLoc(SITUACOES_LOCALIZA[situacao]?.texto || situacao)}"></span>`

async function apiLocaliza(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/veiculos/localiza/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok || !dados.success) throw new Error(dados.mensagem || 'Falha na comunicação com o servidor.')
    return dados
}

// Clique instantâneo, sem overlay: o topo aparece na hora com o carregando no lugar da tabela; a tabela
// (o modTab consulta as opções de Status/App antes de devolver o HTML) entra quando fica pronta.
async function telaLocalizaDespesas(aba = estadoLocaliza.aba) {
    try {
        estadoLocaliza.aba = aba
        estadoLocaliza.linhas.clear()
        const situacao = situacaoAtualLoc()

        tela.innerHTML = `
            <div class="loc-pagina">
                <div class="loc-topo">
                    <div class="loc-visoes" role="tablist" aria-label="Situação">
                        ${ABAS_LOCALIZA.map(([valor, rotulo]) => `
                            <button type="button" class="${valor === 'MULTA' ? 'multa' : ''} ${valor === situacao ? 'ativo' : ''}"
                                ${valor === 'MULTA' ? 'title="Multas não entram nas pendências de rateio"' : ''}
                                onclick="telaLocalizaDespesas('${valor}')">
                                ${rotulo} <span data-contagem-loc="${valor}"></span>
                            </button>`).join('')}
                    </div>
                    <div class="loc-filtro-dep">${filtroDepartamentoLocaliza([], 'Carregando opções…')}</div>
                    <button type="button" class="loc-atualizar" onclick="atualizarLocalizaOmie()" title="Puxa do Omie as alterações recentes de contas a pagar">Atualizar do Omie</button>
                </div>
                <div class="loc-legenda">
                    ${Object.keys(SITUACOES_LOCALIZA).map(s => `${bolinhaLoc(s)} ${SITUACOES_LOCALIZA[s].texto}`).join('')}
                </div>
                <div class="loc-tabela">
                    <div class="tabela-carregando loc-carregando"><img src="gifs/loading-gcs.png" alt="Carregando"></div>
                </div>
            </div>`
        contarAbasLocaliza()

        const colunas = {
            'Vencimento': { chave: 'data_vencimento', tipoPesquisa: 'data' },
            'Status': { chave: 'status', tipoPesquisa: 'select' },
            'Valor': { chave: 'valor' },
            'Observação': { chave: 'observacao' },
            'Categoria': { chave: 'categoria_nome', tipoPesquisa: 'select' },
            ...(situacao === 'A RATEAR' ? { 'Sugestão': {} } : {}),
            'App': { chave: 'app', tipoPesquisa: 'select' },
            'Ações': {}
        }

        // Filtro de departamento (seletor com checkbox, como os de Ocorrências): opções = departamentos
        // que aparecem no rateio dos títulos da situação aberta. A pesquisa das colunas recomeça a cada troca.
        if (controles.localizaDespesas) controles.localizaDespesas.filtros = {}

        const tabela = await modTab({
            pag: 'localizaDespesas',
            body: 'bodyLocalizaDespesas',
            base: 'vw_localiza_despesas',
            colunas,
            filtros: {},
            filtrosFixos: { situacao: { op: '=', value: situacao } },
            ordenar: { path: 'data_vencimento', direcao: 'desc' },
            topoEmLinha: true,
            detalhes: true,
            criarLinha: 'criarLinhaLocaliza'
        })

        // Trocou de visão (ou de tela) enquanto montava: esta montagem fica para trás.
        const alvo = document.querySelector('.loc-pagina .loc-tabela')
        if (!alvo || situacaoAtualLoc() !== situacao) return
        alvo.innerHTML = tabela

        carregarFiltroDepartamentoLocaliza(situacao)
        await paginacao('localizaDespesas')
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir as despesas da Localiza: fale com o suporte.' })
    }
}

const PATH_DEP_LOCALIZA = 'rateio.*.departamento'

function filtroDepartamentoLocaliza(opcoes, vazio) {
    return montarDropdownCheckbox({
        titulo: 'Departamento',
        op: 'includes',
        pag: 'localizaDespesas',
        path: PATH_DEP_LOCALIZA,
        opcoes,
        vazio
    })
}

// Troca o seletor quando as opções chegam (se ainda estiver na mesma visão e com o menu fechado).
async function carregarFiltroDepartamentoLocaliza(situacao) {
    const opcoes = await departamentosDaSituacaoLocaliza(situacao)
    const alvo = document.querySelector('.loc-filtro-dep')
    if (!alvo || situacaoAtualLoc() !== situacao || alvo.querySelector('.dropdown-menu')?.dataset.aberto === 'S') return
    alvo.innerHTML = filtroDepartamentoLocaliza(opcoes, 'Nenhum departamento aqui')
}

async function departamentosDaSituacaoLocaliza(situacao) {
    try {
        const { resultados = [] } = await pesquisarDB({
            base: 'vw_localiza_despesas',
            filtros: { situacao: { op: '=', value: situacao } },
            limite: 5000
        }) || {}
        const nomes = new Set()
        for (const d of resultados)
            for (const p of d.rateio || []) if (p?.departamento) nomes.add(String(p.departamento))
        return [...nomes]
    } catch {
        return []
    }
}

async function contarAbasLocaliza() {
    try {
        const dados = await contarPorCampo({ base: 'vw_localiza_despesas', path: 'situacao' })
        for (const valor of Object.keys(SITUACOES_LOCALIZA)) {
            const alvo = document.querySelector(`[data-contagem-loc="${valor}"]`)
            const total = dados?.[valor] ?? dados?.[valor.toLowerCase()]
            if (alvo) alvo.textContent = total != null ? `(${total})` : ''
        }
    } catch { /* contagem é só informativa */ }
}

// Tabela do rateio: departamento, valor, % do título e barra; "EMPRESA"/sem rateio em destaque.
function tabelaRateioLoc(rateio = [], valorTitulo = 0) {
    if (!rateio.length) return '<p class="loc-vazio">Sem rateio no Omie: o título inteiro está a ratear.</p>'
    const total = Number(valorTitulo) || rateio.reduce((s, p) => s + Number(p.valor || 0), 0) || 1
    const soma = rateio.reduce((s, p) => s + Number(p.valor || 0), 0)
    const diferenca = Math.round((Number(valorTitulo) - soma) * 100) / 100
    return `
        <table class="loc-rateio">
            <thead><tr><th>Departamento</th><th>Valor</th><th>%</th><th></th></tr></thead>
            <tbody>
                ${rateio.map(p => {
                    const perc = Number(p.valor || 0) / total * 100
                    const pendente = destinoInvalidoLoc(p.departamento)
                    return `
                        <tr class="${pendente ? 'pendente' : ''}">
                            <td>${escLoc(p.departamento)}${pendente ? ' <small>(a ratear)</small>' : ''}</td>
                            <td>${reaisLoc(p.valor)}</td>
                            <td>${perc.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</td>
                            <td class="loc-barra"><span style="width: ${Math.min(100, Math.max(0, perc)).toFixed(2)}%"></span></td>
                        </tr>`
                }).join('')}
            </tbody>
            <tfoot>
                <tr><td>Total</td><td>${reaisLoc(soma)}</td><td colspan="2">
                    ${Math.abs(diferenca) >= 0.01 ? `<span class="loc-falta">${diferenca > 0 ? 'falta' : 'passou'} ${reaisLoc(Math.abs(diferenca))}</span>` : ''}
                </td></tr>
            </tfoot>
        </table>`
}

function textoMultaLoc(d) {
    if (!d.multa) return d.multa_origem === 'MANUAL' ? `Marcado como "não é multa" por ${d.multa_usuario || '—'}` : ''
    return d.multa_origem === 'MANUAL'
        ? `Marcada como multa por ${d.multa_usuario || '—'}${d.multa_data ? ` em ${new Date(d.multa_data).toLocaleDateString('pt-BR')}` : ''}`
        : `Multa pela categoria (${d.categoria_nome || d.categoria})`
}

// Rastreio pelo relatório de faturas da Localiza (localiza_faturas): condutor, placa e o que foi cobrado.
const TIPOS_FATURA_LOC = { LOCACAO: 'Locação', MULTA: 'Multa', INDENIZACAO: 'Indenização' }
const veiculoLoc = d => [d.fatura_placa || d.placa, d.fatura_modelo || d.veiculo_modelo].filter(Boolean).join(' · ')

function cartaoFaturaLoc(d) {
    if (!d.fatura) return ''
    const f = d.fatura_detalhes || {}
    const tem = v => v !== undefined && v !== null && v !== '' && v !== '-' && Number(v) !== 0
    const reaisSe = v => tem(v) ? reaisLoc(v) : ''
    const linhas = [
        ['Condutor', d.condutor],
        ['Veículo', veiculoLoc(d)],
        ['Contrato', [f['Contrato'], [f['Abertura do Contrato'], f['Fechamento do Contrato']].filter(tem).join(' a ')].filter(tem).join(' · ')],
        ...(d.fatura_tipo === 'MULTA' ? [
            ['Infração', f['Descrição']],
            ['Quando', [f['Data'], f['Horário']].filter(tem).join(' ')],
            ['Onde', [f['Local'], [f['Cidade'], f['UF']].filter(tem).join('/')].filter(tem).join(', ')],
            ['Auto', f['Auto da Infração']],
            ['Multa + taxa', [reaisSe(f['Valor']), reaisSe(f['Taxa Administração'])].filter(Boolean).join(' + ')]
        ] : d.fatura_tipo === 'INDENIZACAO' ? [
            ['Indenização', f['Indenização']],
            ['Aviso', [f['Aviso'], f['Data']].filter(tem).join(' de ')]
        ] : [
            ['Diárias', tem(f['Diárias Utilizadas']) ? `${f['Diárias Utilizadas']} × ${reaisLoc(f['Valor da Diária'])}` : ''],
            ['Pedágio', reaisSe(f['Tag de Pagamento - Utilizações'])],
            ['Diária da tag', reaisSe(f['Tag de Pagamento - Diárias'])],
            ['Combustível', reaisSe(f['Combustível'])],
            ['Lavagem', reaisSe(f['Lavagem'])],
            ['Km excedente', reaisSe(f['Km Excedente'])],
            ['Hora extra', reaisSe(f['Hora Extra'])],
            ['Estacionamento', reaisSe(f['Estacionamento'])],
            ['Despesas extras', reaisSe(f['Despesas Extras'])]
        ]),
        ['Requisitante', f['Requisitante']]
    ].filter(([, v]) => tem(v))

    return `
        <div class="loc-card fatura">
            <div class="loc-card-topo">
                <span>Fatura Localiza · ${escLoc(TIPOS_FATURA_LOC[d.fatura_tipo] || d.fatura_tipo || '')}</span>
                <span class="loc-card-selo">${escLoc(d.fatura)}${d.status_fatura ? ` · ${escLoc(d.status_fatura)}` : ''}</span>
            </div>
            <div class="loc-card-corpo">
                <dl class="loc-info">${linhas.map(([k, v]) => `<dt>${k}</dt><dd>${escLoc(v)}</dd>`).join('')}</dl>
            </div>
        </div>`
}

function detalhesLocaliza(d) {
    const info = [
        ['Veículo', d.fatura ? '' : veiculoLoc(d)],
        ['Emissão', dataBrLoc(d.data_emissao)],
        ['Nº documento', d.numero_documento],
        ['NF', d.numero_nf],
        ['Parcela', d.parcela],
        ['Categoria', [d.categoria, d.categoria_nome].filter(Boolean).join(' · ')],
        ['Multa', textoMultaLoc(d)],
        ['Código Omie', d.codigo_lancamento_omie]
    ].filter(([, v]) => v)

    // Multa mostra o rateio pela situação que teria sem ser multa.
    const situacaoRateio = d.situacao === 'MULTA' ? d.situacao_rateio : d.situacao
    const pendente = situacaoRateio === 'A RATEAR'

    return `
        <div class="loc-detalhes">
            <div class="loc-card ${pendente ? 'pendente' : 'ok'}">
                <div class="loc-card-topo">
                    <span>Rateio no Omie</span>
                    <span class="loc-card-selo">${SITUACOES_LOCALIZA[situacaoRateio]?.texto || ''}</span>
                </div>
                <div class="loc-card-corpo">${tabelaRateioLoc(d.rateio || [], d.valor)}</div>
            </div>
            ${cartaoFaturaLoc(d)}
            ${d.sugestao?.rateio?.length ? `
                <div class="loc-card sugestao">
                    <div class="loc-card-topo">
                        <span>Sugestão</span>
                        <small>mesma observação · venc. ${dataBrLoc(d.sugestao.data_vencimento)}</small>
                    </div>
                    <div class="loc-card-corpo">
                        ${tabelaRateioLoc(d.sugestao.rateio, d.sugestao.valor)}
                        <button type="button" class="loc-usar" onclick="abrirRateioLocaliza('${escLoc(d.id)}', 'sugestao')">Usar esta sugestão</button>
                    </div>
                </div>` : ''}
            ${info.length ? `
                <div class="loc-card info">
                    <div class="loc-card-topo"><span>Título</span></div>
                    <div class="loc-card-corpo">
                        <dl class="loc-info">${info.map(([k, v]) => `<dt>${k}</dt><dd>${escLoc(v)}</dd>`).join('')}</dl>
                    </div>
                </div>` : ''}
        </div>`
}

function criarLinhaLocaliza(d) {
    estadoLocaliza.linhas.set(String(d.id), d)
    const veiculo = veiculoLoc(d)
    const sugestao = situacaoAtualLoc() === 'A RATEAR'
        ? `<td>${d.sugestao?.rateio?.length
            ? `<button type="button" class="loc-link" title="Último rateio com a mesma observação (venc. ${escLoc(dataBrLoc(d.sugestao.data_vencimento))})"
                onclick="abrirRateioLocaliza('${escLoc(d.id)}', 'sugestao')">${d.sugestao.rateio.map(p => escLoc(p.departamento)).join(', ')}</button>`
            : ''}</td>`
        : ''

    // Multa: "Não é multa" (volta às pendências). Fora das multas: "É multa" (sai das pendências).
    const botaoMulta = d.multa
        ? `<button type="button" class="loc-botao-multa desfazer" onclick="classificarMultaLocaliza('${escLoc(d.id)}', false)" title="${escLoc(textoMultaLoc(d))}">Não é multa</button>`
        : `<button type="button" class="loc-botao-multa" onclick="classificarMultaLocaliza('${escLoc(d.id)}', true)" title="Tira das pendências de rateio">É multa</button>`

    const linha = `
        <tr>
            <td style="white-space: nowrap;">${bolinhaLoc(d.situacao)} ${dataBrLoc(d.data_vencimento)}</td>
            <td><span class="loc-status ${String(d.status || '').toLowerCase().replace(/\s+/g, '-')}">${escLoc(d.status)}</span></td>
            <td style="white-space: nowrap;">
                <b>${reaisLoc(d.valor)}</b>
                ${d.situacao === 'A RATEAR' && Number(d.valor_a_ratear) && Number(d.valor_a_ratear) !== Number(d.valor)
                    ? `<br><small class="loc-falta">falta ${reaisLoc(d.valor_a_ratear)}</small>` : ''}
            </td>
            <td>
                ${d.condutor ? `<div class="loc-condutor">${escLoc(d.condutor)}${d.fatura_tipo ? ` <span class="loc-tipo-fatura ${String(d.fatura_tipo).toLowerCase()}">${escLoc(TIPOS_FATURA_LOC[d.fatura_tipo] || d.fatura_tipo)}</span>` : ''}</div>` : ''}
                ${veiculo ? `<small class="loc-veiculo">${escLoc(veiculo)}</small>` : ''}
                <div class="loc-obs">${escLoc(d.observacao || '')}</div>
            </td>
            <td>
                ${escLoc(d.categoria_nome || d.categoria || '')}
                ${d.multa ? `<br><small class="loc-multa-origem">${d.multa_origem === 'MANUAL' ? 'marcada manualmente' : 'pela categoria'}</small>` : ''}
            </td>
            ${sugestao}
            <td>${escLoc(d.app)}</td>
            <td>
                <div class="loc-acoes-linha">
                    ${d.multa ? '' : `<button type="button" class="loc-ratear" onclick="abrirRateioLocaliza('${escLoc(d.id)}')">Ratear</button>`}
                    ${botaoMulta}
                </div>
            </td>
        </tr>`
    return { linha, detalhes: detalhesLocaliza(d) }
}

// É multa / não é multa (só no GCS). Quando a marcação só repete a categoria, ela é removida
// (null = volta a valer a categoria), para não sobrar marcação manual sem necessidade.
async function classificarMultaLocaliza(id, multa) {
    const d = estadoLocaliza.linhas.get(String(id))
    if (!d) return
    const valor = multa === !!d.multa_categoria ? null : multa
    overlayAguarde()
    try {
        await apiLocaliza('classificar', { id: String(id), multa: valor })
        removerOverlay()
        await paginacao('localizaDespesas')
        contarAbasLocaliza()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

async function atualizarLocalizaOmie() {
    overlayAguarde()
    try {
        const { mensagem } = await apiLocaliza('atualizar')
        await paginacao('localizaDespesas')
        contarAbasLocaliza()
        removerOverlay()
        popup({ mensagem: mensagem || 'Atualizado.' })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}



// ---------------- Editor de rateio ----------------
// Destino é uma lista FECHADA (vw_localiza_destinos: contratos ORC já no Omie + setores): nada é digitado,
// o seletor abre abaixo da linha com busca por ORC, cliente ou cidade. O servidor confere a mesma lista.

const normalLoc = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const LIMITE_SELETOR_LOC = 60

async function destinosLocaliza() {
    if (estadoLocaliza.destinos) return estadoLocaliza.destinos
    const { resultados = [] } = await pesquisarDB({ base: 'vw_localiza_destinos', limite: 20000 }) || {}
    // Setores primeiro; contratos do mais novo para o mais antigo.
    const lista = resultados.filter(d => d?.id).map(d => ({
        ...d,
        busca: normalLoc([d.id, d.cliente, d.cidade].filter(Boolean).join(' '))
    })).sort((a, b) => a.tipo !== b.tipo
        ? (a.tipo === 'SETOR' ? -1 : 1)
        : (Number(b.ordem) - Number(a.ordem)) || a.id.localeCompare(b.id, 'pt-BR'))
    estadoLocaliza.destinos = lista
    estadoLocaliza.destinosPorId = new Map(lista.map(d => [d.id, d]))
    return lista
}

const destinoLoc = nome => estadoLocaliza.destinosPorId?.get(nome) || null

// Mesma conta do servidor (gcs/SCRIPTS/localiza_rateio.js): centavos pelo maior resto.
function distribuirLoc(percentuais, valor) {
    const total = Math.round(Number(valor) * 100)
    const soma = percentuais.reduce((s, p) => s + p, 0) || 1
    const partes = percentuais.map((p, i) => {
        const bruto = total * p / soma
        return { i, c: Math.floor(bruto), resto: bruto - Math.floor(bruto) }
    })
    let faltam = total - partes.reduce((s, p) => s + p.c, 0)
    for (const p of [...partes].sort((a, b) => b.resto - a.resto)) {
        if (faltam-- <= 0) break
        p.c++
    }
    return partes.map(p => p.c / 100)
}

function partesDeRateioLoc(rateio = [], valor) {
    const uteis = rateio.filter(p => !destinoInvalidoLoc(p.departamento))
    if (!uteis.length) return []
    const soma = uteis.reduce((s, p) => s + Number(p.valor || 0), 0) || 1
    return editorLocaliza.modo === 'valor' && Math.abs(soma - valor) < 0.005
        ? uteis.map(p => ({ departamento: p.departamento, numero: Number(p.valor) }))
        : uteis.map(p => ({ departamento: p.departamento, numero: Math.round(Number(p.valor) / soma * 10000) / 100 }))
}

async function abrirRateioLocaliza(id, partida = null) {
    const titulo = estadoLocaliza.linhas.get(String(id))
    if (!titulo) return

    if (!estadoLocaliza.destinos) {
        overlayAguarde()
        await destinosLocaliza().catch(() => [])
        removerOverlay()
    }
    if (!estadoLocaliza.destinos?.length)
        return popup({ mensagem: 'Não foi possível carregar a lista de contratos. Tente de novo.' })

    editorLocaliza.id = String(titulo.id)
    editorLocaliza.modo = 'percentual'
    editorLocaliza.busca = ''
    editorLocaliza.partes = partida === 'sugestao' && titulo.sugestao?.rateio
        ? partesDeRateioLoc(titulo.sugestao.rateio, titulo.valor)
        : partesDeRateioLoc(titulo.rateio || [], titulo.valor)
    if (!editorLocaliza.partes.length) editorLocaliza.partes = [{ departamento: '', numero: 100 }]
    // Sem nada escolhido ainda: o seletor já abre na primeira linha.
    editorLocaliza.aberto = editorLocaliza.partes.length === 1 && !editorLocaliza.partes[0].departamento ? 0 : null

    const veiculo = [titulo.condutor, veiculoLoc(titulo)].filter(Boolean).join(' · ')
    const sugestao = titulo.sugestao?.rateio?.length && partida !== 'sugestao'
        ? `<button type="button" class="loc-ed-sugestao" onclick="usarSugestaoLocaliza()"
                title="Último rateio com a mesma observação">Usar sugestão: ${titulo.sugestao.rateio.map(p => escLoc(p.departamento)).join(', ')}</button>` : ''

    const elemento = `
        <div class="loc-editor">
            <div class="loc-ed-titulo">
                <div class="loc-ed-valor">
                    <small>Valor do título</small>
                    <b>${reaisLoc(titulo.valor)}</b>
                </div>
                <div class="loc-ed-dados">
                    <span>Vencimento <b>${dataBrLoc(titulo.data_vencimento)}</b></span>
                    <span class="loc-status ${String(titulo.status || '').toLowerCase().replace(/\s+/g, '-')}">${escLoc(titulo.status)}</span>
                    ${veiculo ? `<span>${escLoc(veiculo)}</span>` : ''}
                </div>
                ${titulo.observacao ? `<div class="loc-ed-obs">${escLoc(titulo.observacao)}</div>` : ''}
            </div>

            <div class="loc-ed-barra">
                <div class="loc-modo" title="Dividir por percentual ou por valor">
                    <button type="button" data-modo="percentual" onclick="modoRateioLocaliza('percentual')">%</button>
                    <button type="button" data-modo="valor" onclick="modoRateioLocaliza('valor')">R$</button>
                </div>
                <button type="button" onclick="dividirIgualLocaliza()">Dividir igualmente</button>
                ${sugestao}
            </div>

            <div class="loc-ed-lista">
                <div class="loc-ed-cab">
                    <span>Contrato / setor</span>
                    <span class="loc-ed-unidade"></span>
                    <span class="loc-ed-equiv-cab"></span>
                    <span></span>
                </div>
                <div class="loc-partes"></div>
                <div class="loc-ed-adicionar">
                    <button type="button" onclick="adicionarDepLocaliza('')">+ Adicionar contrato</button>
                    <span>Setores:</span>
                    ${SETORES_LOCALIZA.map(s => `<button type="button" class="loc-ed-setor" data-id="${escLoc(s)}" onclick="adicionarDepLocaliza(this.dataset.id)">+ ${escLoc(s)}</button>`).join('')}
                </div>
            </div>

            <div class="loc-total"></div>

            <div class="loc-rodape">
                <small>Grava direto no Omie e substitui o rateio atual.</small>
                <button type="button" class="loc-confirmar" onclick="confirmarRateioLocaliza()">Ratear no Omie</button>
            </div>
        </div>`

    popup({ elemento, titulo: 'Ratear despesa Localiza' })
    desenharRateioLocaliza()
}

function painelLocaliza() {
    return [...document.querySelectorAll('.loc-editor')].at(-1)
}

function tituloEditorLocaliza() {
    return estadoLocaliza.linhas.get(editorLocaliza.id) || null
}

function rotuloDestinoLoc(nome) {
    if (!nome) return '<span class="loc-dest-vazio">Escolher contrato ou setor…</span>'
    const d = destinoLoc(nome)
    if (!d) return `<span class="loc-dest-nome">${escLoc(nome)}</span><small class="loc-dest-erro">fora da lista: escolha outro</small>`
    const extra = d.tipo === 'SETOR' ? 'Setor' : [d.cliente, d.cidade].filter(Boolean).join(' · ') || 'Contrato'
    return `<span class="loc-dest-nome">${escLoc(d.id)}</span><small>${escLoc(extra)}</small>`
}

function desenharRateioLocaliza() {
    const painel = painelLocaliza()
    if (!painel) return
    const emValor = editorLocaliza.modo === 'valor'
    for (const b of painel.querySelectorAll('[data-modo]')) b.classList.toggle('ativa', b.dataset.modo === editorLocaliza.modo)
    painel.querySelector('.loc-ed-unidade').textContent = emValor ? 'Valor (R$)' : 'Percentual'
    painel.querySelector('.loc-ed-equiv-cab').textContent = emValor ? 'Equivale' : 'Em R$'

    const usados = new Set(editorLocaliza.partes.map(p => p.departamento).filter(Boolean))
    for (const b of painel.querySelectorAll('.loc-ed-setor')) b.disabled = usados.has(b.dataset.id)

    painel.querySelector('.loc-partes').innerHTML = editorLocaliza.partes.map((p, i) => {
        const aberto = editorLocaliza.aberto === i
        const invalido = p.departamento && !destinoLoc(p.departamento)
        return `
            <div class="loc-parte ${aberto ? 'aberta' : ''} ${invalido ? 'invalida' : ''}">
                <button type="button" class="loc-dest" onclick="alternarSeletorLocaliza(${i})" title="Escolher da lista">
                    <span class="loc-dest-texto">${rotuloDestinoLoc(p.departamento)}</span>
                    <span class="loc-dest-seta">${aberto ? '▴' : '▾'}</span>
                </button>
                <div class="loc-numero">
                    <input type="number" step="0.01" min="0" value="${p.numero === '' || p.numero == null ? '' : p.numero}"
                        oninput="editorLocaliza.partes[${i}].numero = this.value === '' ? '' : Number(this.value); atualizarTotaisLocaliza()">
                    <span>${emValor ? 'R$' : '%'}</span>
                </div>
                <span class="loc-equiv" data-equiv="${i}"></span>
                <div class="loc-parte-acoes">
                    <button type="button" class="loc-link" title="Completar com o que falta" onclick="restanteLocaliza(${i})">restante</button>
                    <button type="button" class="loc-remover" title="Remover" onclick="removerDepLocaliza(${i})">×</button>
                </div>
            </div>
            ${aberto ? `
                <div class="loc-seletor">
                    <input type="search" class="loc-seletor-busca" placeholder="Buscar por ORC, cliente ou cidade"
                        value="${escLoc(editorLocaliza.busca)}" autocomplete="off"
                        oninput="editorLocaliza.busca = this.value; listarSeletorLocaliza()"
                        onkeydown="teclaSeletorLocaliza(event, ${i})">
                    <div class="loc-seletor-lista"></div>
                </div>` : ''}`
    }).join('')

    if (editorLocaliza.aberto != null) {
        listarSeletorLocaliza()
        painel.querySelector('.loc-seletor-busca')?.focus()
    }
    atualizarTotaisLocaliza()
}

function resultadosSeletorLoc() {
    const termos = normalLoc(editorLocaliza.busca).split(/\s+/).filter(Boolean)
    return (estadoLocaliza.destinos || []).filter(d => termos.every(t => d.busca.includes(t)))
}

function listarSeletorLocaliza() {
    const alvo = painelLocaliza()?.querySelector('.loc-seletor-lista')
    if (!alvo) return
    const i = editorLocaliza.aberto
    const atual = editorLocaliza.partes[i]?.departamento
    const usados = new Set(editorLocaliza.partes.filter((_, j) => j !== i).map(p => p.departamento).filter(Boolean))
    const encontrados = resultadosSeletorLoc()
    const mostrados = encontrados.slice(0, LIMITE_SELETOR_LOC)

    alvo.innerHTML = mostrados.length
        ? mostrados.map(d => {
            const usado = usados.has(d.id)
            return `
                <button type="button" class="loc-opcao ${d.id === atual ? 'atual' : ''}" data-id="${escLoc(d.id)}"
                    ${usado ? 'disabled title="Já está no rateio"' : ''} onclick="escolherDestinoLocaliza(${i}, this.dataset.id)">
                    <span class="loc-opcao-tipo ${d.tipo === 'SETOR' ? 'setor' : ''}">${d.tipo === 'SETOR' ? 'Setor' : 'Contrato'}</span>
                    <span class="loc-opcao-nome">${escLoc(d.id)}</span>
                    <span class="loc-opcao-cliente">${escLoc([d.cliente, d.cidade].filter(Boolean).join(' · '))}</span>
                    ${d.status ? `<span class="loc-opcao-status">${escLoc(d.status)}</span>` : ''}
                </button>`
        }).join('') + (encontrados.length > mostrados.length
            ? `<div class="loc-seletor-mais">Mostrando ${mostrados.length} de ${encontrados.length}: digite mais para filtrar.</div>` : '')
        : '<div class="loc-seletor-mais">Nada encontrado. Busque pelo número do ORC, cliente ou cidade.</div>'
}

function teclaSeletorLocaliza(evento, i) {
    if (evento.key === 'Escape') {
        evento.preventDefault()
        editorLocaliza.aberto = null
        desenharRateioLocaliza()
    } else if (evento.key === 'Enter') {
        evento.preventDefault()
        const primeiro = painelLocaliza()?.querySelector('.loc-seletor-lista .loc-opcao:not([disabled])')
        if (primeiro) escolherDestinoLocaliza(i, primeiro.dataset.id)
    }
}

function alternarSeletorLocaliza(i) {
    editorLocaliza.aberto = editorLocaliza.aberto === i ? null : i
    editorLocaliza.busca = ''
    desenharRateioLocaliza()
}

function escolherDestinoLocaliza(i, id) {
    if (!destinoLoc(id) || !editorLocaliza.partes[i]) return
    editorLocaliza.partes[i].departamento = id
    editorLocaliza.aberto = null
    editorLocaliza.busca = ''
    desenharRateioLocaliza()
    // Depois de escolher, o cursor vai para o número da linha.
    painelLocaliza()?.querySelectorAll('.loc-parte .loc-numero input')[i]?.focus()
}

function alvoLocaliza() {
    return editorLocaliza.modo === 'valor' ? Number(tituloEditorLocaliza()?.valor || 0) : 100
}

function atualizarTotaisLocaliza() {
    const painel = painelLocaliza()
    if (!painel) return
    const valorTitulo = Number(tituloEditorLocaliza()?.valor || 0)
    const emValor = editorLocaliza.modo === 'valor'
    const alvo = alvoLocaliza()
    const soma = editorLocaliza.partes.reduce((s, p) => s + (Number(p.numero) || 0), 0)
    const falta = Math.round((alvo - soma) * 100) / 100
    const fmt = v => emValor ? reaisLoc(v) : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
    const ok = Math.abs(falta) < 0.005

    // Coluna "Em R$" / "Equivale": o que cada linha representa no outro modo.
    const numeros = editorLocaliza.partes.map(p => Number(p.numero) || 0)
    const reais = !emValor && ok ? distribuirLoc(numeros, valorTitulo) : null
    editorLocaliza.partes.forEach((p, i) => {
        const alvoEquiv = painel.querySelector(`[data-equiv="${i}"]`)
        if (!alvoEquiv) return
        const n = numeros[i]
        alvoEquiv.textContent = !n ? '' : emValor
            ? `${(valorTitulo ? n / valorTitulo * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
            : reaisLoc(reais ? reais[i] : Math.round(valorTitulo * n) / 100)
    })

    const proporcao = alvo ? Math.min(soma / alvo, 1) * 100 : 0
    const estado = ok ? 'ok' : falta > 0 ? 'falta' : 'passou'
    painel.querySelector('.loc-total').innerHTML = `
        <div class="loc-total-texto">
            <span>Distribuído <b>${fmt(soma)}</b> de ${fmt(alvo)}</span>
            <span class="${estado}">${ok ? '✓ Fechado' : falta > 0 ? `Falta ${fmt(falta)}` : `Passou ${fmt(-falta)}`}</span>
        </div>
        <div class="loc-total-barra ${estado}"><span style="width: ${proporcao.toFixed(2)}%"></span></div>`

    const validas = editorLocaliza.partes.filter(p => p.departamento && Number(p.numero) > 0)
    const invalidas = editorLocaliza.partes.some(p => p.departamento && !destinoLoc(p.departamento))
    painel.querySelector('.loc-confirmar').disabled = !ok || !validas.length || invalidas
}

function modoRateioLocaliza(modo) {
    if (modo === editorLocaliza.modo) return
    const valor = Number(tituloEditorLocaliza()?.valor || 0)
    const numeros = editorLocaliza.partes.map(p => Number(p.numero) || 0)
    if (modo === 'valor') {
        const soma = numeros.reduce((s, v) => s + v, 0)
        const valores = soma ? distribuirLoc(numeros, valor * Math.min(soma, 100) / 100) : numeros
        editorLocaliza.partes.forEach((p, i) => p.numero = valores[i] || '')
    } else {
        editorLocaliza.partes.forEach(p => p.numero = valor && Number(p.numero) ? Math.round(Number(p.numero) / valor * 10000) / 100 : '')
    }
    editorLocaliza.modo = modo
    desenharRateioLocaliza()
}

function dividirIgualLocaliza() {
    const partes = editorLocaliza.partes.filter(p => p.departamento)
    if (!partes.length) return popup({ mensagem: 'Escolha os contratos primeiro.' })
    editorLocaliza.partes = partes
    editorLocaliza.aberto = null
    if (editorLocaliza.modo === 'valor') {
        const valores = distribuirLoc(partes.map(() => 1), alvoLocaliza())
        partes.forEach((p, i) => p.numero = valores[i])
    } else {
        const base = Math.floor(10000 / partes.length) / 100
        partes.forEach(p => p.numero = base)
        partes[partes.length - 1].numero = Math.round((100 - base * (partes.length - 1)) * 100) / 100
    }
    desenharRateioLocaliza()
}

function restanteLocaliza(i) {
    const outros = editorLocaliza.partes.reduce((s, p, j) => j === i ? s : s + (Number(p.numero) || 0), 0)
    editorLocaliza.partes[i].numero = Math.max(0, Math.round((alvoLocaliza() - outros) * 100) / 100)
    desenharRateioLocaliza()
}

// Setor: entra direto (na primeira linha vazia, se houver). Contrato: nova linha com o seletor aberto.
function adicionarDepLocaliza(nome) {
    if (nome && editorLocaliza.partes.some(p => p.departamento === nome)) return
    const vazia = editorLocaliza.partes.findIndex(p => !p.departamento)
    if (nome) {
        if (vazia >= 0) editorLocaliza.partes[vazia].departamento = nome
        else editorLocaliza.partes.push({ departamento: nome, numero: '' })
        editorLocaliza.aberto = null
    } else {
        if (vazia < 0) editorLocaliza.partes.push({ departamento: '', numero: '' })
        editorLocaliza.aberto = vazia >= 0 ? vazia : editorLocaliza.partes.length - 1
        editorLocaliza.busca = ''
    }
    desenharRateioLocaliza()
}

function removerDepLocaliza(i) {
    editorLocaliza.partes.splice(i, 1)
    if (!editorLocaliza.partes.length) editorLocaliza.partes.push({ departamento: '', numero: '' })
    editorLocaliza.aberto = null
    desenharRateioLocaliza()
}

function usarSugestaoLocaliza() {
    const titulo = tituloEditorLocaliza()
    if (!titulo?.sugestao?.rateio) return
    editorLocaliza.partes = partesDeRateioLoc(titulo.sugestao.rateio, titulo.valor)
    editorLocaliza.aberto = null
    desenharRateioLocaliza()
}

async function confirmarRateioLocaliza() {
    const validas = editorLocaliza.partes.filter(p => p.departamento && Number(p.numero) > 0)
    const fora = editorLocaliza.partes.filter(p => p.departamento && !destinoLoc(p.departamento))
    if (fora.length)
        return popup({ mensagem: `Troque pelo contrato da lista: ${fora.map(p => escLoc(p.departamento)).join(', ')}` })

    const chave = editorLocaliza.modo === 'valor' ? 'valor' : 'percentual'
    const itens = [{
        id: editorLocaliza.id,
        partes: validas.map(p => ({ departamento: p.departamento, [chave]: Number(p.numero) }))
    }]

    overlayAguarde()
    try {
        const { resultados = [] } = await apiLocaliza('ratear', { itens })
        const resultado = resultados[0] || { ok: false, mensagem: 'Sem resposta do servidor.' }

        // Deu certo: fecha o editor e avisa. Falhou: o editor continua aberto para corrigir.
        removerOverlay()
        if (resultado.ok) {
            removerTodosPopups()
            popup({ mensagem: `Rateado no Omie. ${escLoc(resultado.mensagem || '')}` })
        } else {
            popup({ mensagem: `Não foi rateado: ${escLoc(resultado.mensagem)}` })
        }
        await paginacao('localizaDespesas')
        contarAbasLocaliza()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}
