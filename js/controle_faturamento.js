// Controle de Faturamento (Financeiro → Controle de Faturamento), layout financeiro.
// A planilha "CONTROLE FATURAMENTO 2026" dentro do GCS: uma linha por nota de saída (Omie, avulsas e as emitidas
// pelo GCS), lida da vw_controle_faturamento (gcs migrations/controle-faturamento.sql).
//
// Grupo  = empresa do cadastro do cliente (sem ela, a do cliente do orçamento).
// Setor  = setor do responsável do orçamento na ficha do RH (rh_funcionarios.setor); corrige-se clicando nele.
// Situação: Recebida, Recebida parcial, A vencer, Atrasada (pelas faturas a receber ligadas à nota),
//           Sem fatura, Fatura cancelada, Cancelada, Substituída, Devolvida e Sem cobrança (remessa/devolução).
// Totais do topo (como o PAINEL da planilha): só o que se cobra (cobravel = S), com os filtros da tabela.

const estadoControleFat = { ano: String(new Date().getFullYear()) }
const dadosControleFat = new Map()
let assinaturaTotaisControleFat = null

const SITUACOES_CONTROLE_FAT = {
    RECEBIDA: '#2e9e4f', 'RECEBIDA PARCIAL': '#7a9e2e', 'A VENCER': '#2563eb', ATRASADA: '#d32f2f',
    'SEM FATURA': '#b7791f', 'FATURA CANCELADA': '#b7791f', CANCELADA: '#64748b', 'SUBSTITUÍDA': '#64748b',
    DEVOLVIDA: '#8e44ad', 'SEM COBRANÇA': '#64748b'
}
const ICONES_CONTROLE_FAT = { RECEBIDA: 'check', ATRASADA: 'alerta', 'A VENCER': 'relogio', CANCELADA: 'cancelar' }

function situacaoControleFat(s) {
    return `<span class="fin-sit" style="--cor: ${SITUACOES_CONTROLE_FAT[s] || '#64748b'}">${iconeFin(ICONES_CONTROLE_FAT[s] || 'relogio')}${escFin(s || '')}</span>`
}

// Ano escolhido no topo (filtro fixo pelo mês da emissão); "todos" tira o filtro.
const filtrosFixosControleFat = () => estadoControleFat.ano === 'todos' ? null : { mes: { op: 'includes', value: `${estadoControleFat.ano}-` } }

function abrirControleFaturamento() {
    recolherMenuPrincipalFin()
    return telaControleFaturamento()
}

async function telaControleFaturamento() {
    dadosControleFat.clear()
    assinaturaTotaisControleFat = null
    const anoAtual = new Date().getFullYear()
    const anos = [anoAtual, anoAtual - 1, anoAtual - 2].map(String)
    tela.innerHTML = `
        <div class="fis-pagina fin-tela ctf-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Controle de Faturamento</h2>
                    <div class="fin-barra">
                        <select aria-label="Ano da emissão" onchange="estadoControleFat.ano = this.value; telaControleFaturamento()">
                            ${[...anos, 'todos'].map(a => `<option value="${a}" ${a === estadoControleFat.ano ? 'selected' : ''}>${a === 'todos' ? 'Todos os anos' : `Emitidas em ${a}`}</option>`).join('')}
                        </select>
                        <button type="button" onclick="baixarExcelControleFat()" title="Baixa todas as notas dos filtros aplicados">${iconeFin('excel')} Excel</button>
                    </div>
                </header>
                <div class="fis-resumo ctf-resumo" data-totais-ctf>
                    ${['Recebido', 'Atrasado', 'A vencer', 'Total faturado'].map(t => `<div><span>${t}</span><b>…</b></div>`).join('')}
                </div>
                <div class="fin-tabela-area ctf-area" data-tabela-ctf></div>
            </section>
        </div>`
    try {
        delete controles.controleFat
        const area = document.querySelector('[data-tabela-ctf]')
        area.innerHTML = await modTab({
            base: 'vw_controle_faturamento',
            pag: 'controleFat',
            body: 'bodyControleFat',
            criarLinha: 'criarLinhaControleFat',
            caber: true,
            limite: 50,
            funcaoAdicional: ['aposCarregarControleFat'],
            filtrosFixos: filtrosFixosControleFat(),
            ordenar: [{ path: 'emissao', direcao: 'desc' }],
            colunas: {
                'Setor': { chave: 'setor', tipoPesquisa: 'select' },
                'Responsável': { chave: 'responsavel' },
                'Grupo': { chave: 'grupo', tipoPesquisa: 'select' },
                'Cliente': { chave: 'cliente', principal: true },
                'Loja (orçamento)': { chave: 'loja' },
                'Orçamento': { chave: 'orcamento' },
                'Valor': { chave: 'valor', tipoOrdenacao: 'numero' },
                'Nota': { chave: 'numero' },
                'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                'Emissão': { chave: 'dia_emissao', tipoPesquisa: 'data' },
                'Vencimento': { chave: 'dia_vencimento', tipoPesquisa: 'data' },
                'Recebido em': { chave: 'dia_recebimento', tipoPesquisa: 'data' },
                'Situação': { chave: 'situacao', tipoPesquisa: 'select' },
                'Recebido': { chave: 'recebido', tipoOrdenacao: 'numero' },
                'Saldo': { chave: 'saldo', tipoOrdenacao: 'numero' },
                'Dias de atraso': { chave: 'dias_atraso', tipoOrdenacao: 'numero' },
                'Pedido do cliente': { chave: 'pedido_cliente' },
                'CPF/CNPJ': { chave: 'cliente_documento' },
                'LPU': { chave: 'lpu_ativa', tipoPesquisa: 'select' },
                'Origem': { chave: 'fonte', tipoPesquisa: 'select', rotulos: { OMIE: 'Omie / avulsa', GCS: 'GCS' } }
            }
        })
        await paginacao('controleFat')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o Controle de Faturamento: ${escFin(err.message)}` })
    }
}

function criarLinhaControleFat(d) {
    dadosControleFat.set(String(d.id), d)
    const id = escFin(d.id)
    const primeiraFatura = String(d.titulos || '').split(',')[0]
    const titulo = [
        d.substituta ? `Substituída pela ${d.substituta}` : '',
        Number(d.faturas) ? `${d.faturas} fatura(s) a receber · duplo clique abre` : 'Sem fatura a receber ligada',
        d.orc_venda_direta ? 'Orçamento de venda direta' : ''
    ].filter(Boolean).join(' · ')
    return `
        <tr class="fin-linha ctf-linha" title="${escFin(titulo)}" ${primeiraFatura ? `ondblclick="abrirFaturaFin('${escFin(primeiraFatura)}')"` : ''}>
            <td><button type="button" class="ctf-setor ${d.setor === 'SEM SETOR' ? 'vazio' : ''}" title="${d.responsavel_id ? 'Clique para corrigir o setor de quem pediu (vale para todas as notas dele)' : 'Responsável sem cadastro: o setor não se corrige por aqui'}"
                ${d.responsavel_id ? `onclick="event.stopPropagation(); escolherSetorControleFat('${id}')"` : 'disabled'}>${escFin(d.setor)}</button></td>
            <td>${escFin(d.responsavel || '')}</td>
            <td>${escFin(d.grupo)}</td>
            <td class="fin-obs fin-nome" title="${escFin(d.cliente || '')}"><span class="fin-obs-txt">${escFin(d.cliente || '')}</span></td>
            <td class="fin-obs fin-nome" title="${escFin(d.loja || '')}"><span class="fin-obs-txt">${escFin(d.loja || '')}</span></td>
            <td class="fin-centro">${escFin(d.orcamento || '')}</td>
            <td class="fis-num">${dinheiro(d.valor)}</td>
            <td class="fin-centro fin-doc">${escFin(d.numero || '')}<small class="ctf-sub">${escFin(d.modelo)}</small></td>
            <td><small>${escFin(d.tipo)}</small></td>
            <td>${escFin(d.app || '')}</td>
            <td class="fin-centro">${dataFin(d.dia_emissao)}</td>
            <td class="fin-centro">${dataFin(d.dia_vencimento)}</td>
            <td class="fin-centro">${dataFin(d.dia_recebimento)}</td>
            <td>${situacaoControleFat(d.situacao)}${d.substituta ? `<small class="ctf-sub">por ${escFin(d.substituta)}</small>` : ''}</td>
            <td class="fis-num">${Number(d.recebido) ? dinheiro(d.recebido) : '—'}</td>
            <td class="fis-num">${Number(d.saldo) ? dinheiro(d.saldo) : '—'}</td>
            <td class="fin-centro">${d.dias_atraso ? `<b class="ctf-atraso">${d.dias_atraso}</b>` : ''}</td>
            <td class="fin-centro">${escFin(d.pedido_cliente || '')}</td>
            <td class="fin-centro fin-doc">${d.cliente_documento ? docFormatadoFis(d.cliente_documento) : ''}</td>
            <td><small>${escFin(d.lpu_ativa || '')}</small></td>
            <td><small>${d.fonte === 'GCS' ? 'GCS' : 'Omie / avulsa'}</small></td>
        </tr>`
}

async function aposCarregarControleFat() {
    await cabecalhoAvancadoTabela('controleFat', { prefKey: 'controle_faturamento' })
    totaisControleFat()
}

// Totais com os filtros da tabela: recebido e total só do que se cobra; atrasado e a vencer pelo saldo.
async function totaisControleFat() {
    const ctrl = controles.controleFat
    const caixa = document.querySelector('[data-totais-ctf]')
    if (!ctrl || !caixa) return
    const base = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
    const assinatura = JSON.stringify(base)
    if (assinatura === assinaturaTotaisControleFat) return
    assinaturaTotaisControleFat = assinatura
    const comFiltro = extra => combinarFiltros(base, extra)
    const somar = async (path, extra) => {
        try { return Number((await contarPorCampo({ base: 'vw_controle_faturamento', path, modo: 'soma', filtros: comFiltro(extra) }))?.total || 0) } catch { return null }
    }
    const cobravel = { cobravel: { op: '=', value: 'S' } }
    const [recebido, atrasado, aVencer, total] = await Promise.all([
        somar('recebido', cobravel),
        somar('saldo', { situacao: { op: '=', value: 'ATRASADA' } }),
        somar('saldo', { situacao: { modo: 'OR', regras: [{ op: '=', value: 'A VENCER' }, { op: '=', value: 'RECEBIDA PARCIAL' }] } }),
        somar('valor', cobravel)
    ])
    if (assinatura !== assinaturaTotaisControleFat) return
    const v = n => n == null ? '—' : dinheiro(n)
    caixa.innerHTML = `
        <div><span>Recebido</span><b class="ctf-verde">${v(recebido)}</b></div>
        <div><span>Atrasado</span><b class="ctf-vermelho">${v(atrasado)}</b></div>
        <div><span>A vencer</span><b>${v(aVencer)}</b></div>
        <div><span>Total faturado</span><b>${v(total)} <small>(sem canceladas, substituídas, devolvidas e remessas)</small></b></div>`
}

// ------------------------------------------------------------ setor do responsável (rh_funcionarios.setor)

function escolherSetorControleFat(idLinha) {
    const d = dadosControleFat.get(String(idLinha))
    if (!d?.responsavel_id) return
    const atual = d.setor === 'SEM SETOR' ? '' : d.setor
    const opcoes = [...new Set([...SETORES_PADRAO_RH, ...(atual ? [atual] : [])])]
    popup({
        titulo: 'Setor de quem pediu o faturamento',
        linhas: [
            { texto: 'Responsável', elemento: `<b>${escFin(d.responsavel)}</b>` },
            {
                texto: 'Setor',
                elemento: `<select name="setor"><option value="">— sem setor —</option>${opcoes.map(s =>
                    `<option value="${escFin(s)}" ${s === atual ? 'selected' : ''}>${escFin(s)}</option>`).join('')}</select>`
            },
            { elemento: '<small>Vale para todas as notas dele e aparece na ficha do RH.</small>' }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarSetorControleFat(this, '${escFin(d.responsavel_id)}')` }]
    })
}

async function salvarSetorControleFat(botao, idPessoa) {
    const janela = botao.closest('.popup')
    const setor = janela?.querySelector('[name="setor"]')?.value || null
    const resposta = await enviar(`rh_funcionarios/${idPessoa}/setor`, setor)
    if (!resposta?.success)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar o setor.' })
    removerPopup(janela?.id)
    assinaturaTotaisControleFat = null
    await paginacao('controleFat')
}

// ------------------------------------------------------------ Excel (todas as linhas dos filtros)

async function baixarExcelControleFat() {
    const ctrl = controles.controleFat
    if (!ctrl) return
    overlayAguarde()
    try {
        const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        const linhas = []
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_controle_faturamento', filtros, ordenar: ctrl.ordenar, pagina, limite: 2000 })
            linhas.push(...(r?.resultados || []))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas)
        const data = v => v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null
        const texto = k => d => d[k] ?? ''
        const moeda = (titulo, k) => ({ titulo, largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d[k]) || 0 })
        await baixarExcelRelatorioGCS({
            titulo: 'Controle de Faturamento',
            resumo: `${linhas.length} nota(s)`,
            filtrosTexto: `${estadoControleFat.ano === 'todos' ? 'Todos os anos' : `Emitidas em ${estadoControleFat.ano}`} · Filtros: ${descreverFiltrosFin(ctrl)}`,
            colunas: [
                { titulo: 'Setor', largura: 20, valor: texto('setor') },
                { titulo: 'Responsável', largura: 16, valor: texto('responsavel') },
                { titulo: 'Grupo', largura: 16, valor: texto('grupo') },
                { titulo: 'Cliente', largura: 34, quebra: true, valor: texto('cliente') },
                { titulo: 'Loja (orçamento)', largura: 30, quebra: true, valor: texto('loja') },
                { titulo: 'Orçamento', largura: 12, valor: texto('orcamento') },
                moeda('Valor', 'valor'),
                { titulo: 'Nota', largura: 12, centro: true, valor: texto('numero') },
                { titulo: 'Modelo', largura: 9, centro: true, valor: texto('modelo') },
                { titulo: 'Tipo', largura: 16, valor: texto('tipo') },
                { titulo: 'Empresa', largura: 9, centro: true, valor: texto('app') },
                { titulo: 'Emissão', largura: 12, tipo: 'data', valor: d => data(d.dia_emissao) },
                { titulo: 'Vencimento', largura: 12, tipo: 'data', valor: d => data(d.dia_vencimento) },
                { titulo: 'Recebido em', largura: 12, tipo: 'data', valor: d => data(d.dia_recebimento) },
                { titulo: 'Situação', largura: 17, valor: texto('situacao') },
                moeda('Recebido', 'recebido'),
                moeda('Saldo', 'saldo'),
                { titulo: 'Dias de atraso', largura: 10, centro: true, valor: d => d.dias_atraso ?? '' },
                { titulo: 'Pedido do cliente', largura: 16, valor: texto('pedido_cliente') },
                { titulo: 'CPF/CNPJ', largura: 18, valor: d => d.cliente_documento ? docFormatadoFis(d.cliente_documento) : '' },
                { titulo: 'Substituída por', largura: 16, valor: texto('substituta') }
            ],
            linhas
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escFin(err.message)}` })
    } finally {
        removerOverlay()
    }
}
