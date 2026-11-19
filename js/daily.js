// Histórico de Uso GCS (acesso sistema.historico).
//  - Alterações: versões dos registros (gcs: migrations/versoes.sql, SCRIPTS/versoes_rotas.js).
//    Quem mudou, quando, o que tinha antes e o que ficou; voltar uma versão (sistema.restaurar_versao).
//  - Uso do sistema: atividades de logs_rotas e o mapa de calor de dias x horários.
// abrirVersoesRegistro(tabela, registro) abre a linha do tempo de um registro de qualquer tela.

let chartMapaCalor = null

const estadoHU = {
    aba: 'alteracoes',
    filtros: { busca: '', quem: 'pessoas', tabelas: [], usuarios: [], operacao: '', de: '', ate: '' },
    pagina: 1,
    por: 50,
    itens: [],
    total: 0,
    opcoes: null,
    podeRestaurar: false
}
const escHU = v => escaparAtributo(v ?? '')
// Texto como argumento de onclick (aspas de qualquer tipo).
const jsHU = v => escaparAtributo(JSON.stringify(String(v ?? '')))

async function apiVersoes(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/versoes/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const retorno = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(retorno.mensagem || `Falha (${resposta.status})`)
    return retorno
}

// ---------------------------------------------------------------- nomes amigáveis

const TABELAS_HU = {
    dados_orcamentos: 'Orçamento', dados_ocorrencias: 'Chamado', composicoes_base: 'Item do catálogo',
    lpu_precos: 'Preço de LPU', lpus: 'LPU', familias: 'Família', tags_orcamentos: 'Tag de orçamento',
    orcamento_lotes: 'Lote de orçamentos', orcamento_saldo_baixas: 'Baixa de saldo', contratos_vinculados: 'Vínculo de orçamentos',
    parceiros: 'LPU parceiro', checklist: 'Checklist', correcoes: 'Correção', config_locacao: 'Configuração de locação',
    quadros: 'Quadro', fluxo_itens: 'Pedido / requisição / nota', clientes: 'Cadastro', empresas: 'Empresa',
    colaboradores: 'Colaborador', transportadoras: 'Transportadora', lista_pagamentos: 'Pagamento',
    lista_recebimentos: 'Recebimento', autorizacoes_departamento: 'Autorização de departamento',
    fin_titulos: 'Fatura (financeiro)', fin_baixas: 'Baixa (financeiro)', fin_categorias: 'Categoria (financeiro)',
    fin_contas: 'Conta (financeiro)', fin_setores: 'Setor (financeiro)', fin_parametros: 'Parâmetro (financeiro)',
    fin_recorrencias: 'Recorrência (financeiro)', custos_pessoal_manuais: 'Custo de pessoal', custos_pessoal_categorias: 'Categoria de custo de pessoal',
    localiza_classificacao: 'Classificação Localiza', fiscal_documentos: 'Nota fiscal', fiscal_documento_itens: 'Item de nota fiscal',
    fiscal_operacoes: 'Operação fiscal', fiscal_participantes: 'Participante fiscal', fiscal_servicos: 'Serviço fiscal',
    fiscal_empresas: 'Empresa emissora', fiscal_depara: 'De-para fiscal', fiscal_remessas: 'Remessa',
    estoque_locais: 'Local de estoque', estoque_movimentos: 'Movimento de estoque', estoque_inventarios: 'Inventário',
    estoque_inventario_itens: 'Item de inventário', controle_logistico: 'Envio (logística)', custo_veiculos: 'Custo de veículo',
    veiculos: 'Veículo', dados_veiculos: 'Dados de veículo', documentos: 'Documento do RH', rh_funcionarios: 'Funcionário (RH)',
    rh_salarios: 'Salário', rh_exames: 'Exame (RH)', rh_epis: 'EPI', rh_ficha_itens: 'Ficha do funcionário',
    rh_documentos_regras: 'Regra de documentos (RH)', rh_pastas_acesso: 'Pasta do RH', acesso_perfis: 'Perfil de acesso',
    acesso_usuarios: 'Acessos do usuário', ref_permissoes_bases: 'Permissão de base'
}
const nomeTabelaHU = t => TABELAS_HU[t] || inicialMaiuscula(String(t || '').replace(/_/g, ' '))

// Nome de cada campo (último pedaço do caminho que tem nome conhecido).
const CAMPOS_HU = {
    dados_orcam: '', contrato: 'Nº do orçamento', omie_cliente: 'Cliente (código Omie)', cliente_selecionado: 'Cliente',
    emissor: 'Emissor', validade: 'Validade (dias)', validade_ate: 'Válido até', condicoes: 'Condições',
    condicao_pagamento: 'Condição de pagamento', data_registro: 'Data do registro', prorrogacoes: 'Prorrogações',
    dados_composicoes: '', esquema_composicoes: '', revisoes: 'Revisões', historico_status: 'Status',
    total_geral: 'Total', total_bruto: 'Total bruto', lpu_ativa: 'LPU ativa', tags: 'Tags', vinculados: 'Vinculados',
    custo: 'Preço', custo_original: 'Preço original', qtde: 'Quantidade', descricao: 'Descrição', unidade: 'Unidade',
    tipo: 'Tipo', codigo: 'Código', valor: 'Valor', status: 'Status', usuario: 'Usuário', data: 'Data', nome: 'Nome',
    observacao: 'Observação', observacoes: 'Observações', comentario: 'Comentário', excluido: 'Exclusão',
    anexos: 'Anexos', fotos: 'Fotos', correcoes: 'Andamentos', unidade_: 'Unidade', prioridade: 'Prioridade',
    sistema: 'Sistema', tecnico: 'Técnico', executor: 'Executor', param: '', historico: 'Histórico',
    distribuicao: 'Rateio por departamento', categorias: 'Categorias', data_vencimento: 'Vencimento',
    valor_documento: 'Valor', numero_documento_fiscal: 'Nº do documento fiscal', codigo_categoria: 'Categoria',
    etapa: 'Etapa', pedido: 'Pedido', requisicoes: 'Requisições', notas: 'Notas', cnpj: 'CNPJ/CPF',
    endereco: 'Endereço', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade',
    estado: 'UF', cep: 'CEP', email: 'E-mail', celular: 'Celular', permissao: 'Perfil', empresa: 'Empresa',
    setor: 'Setor', cargo: 'Cargo', inscricao_estadual: 'Inscrição estadual', inscricao_municipal: 'Inscrição municipal',
    razao_social: 'Razão social', desligado: 'Desligado', itens: 'Marcações', adicionados: 'A mais', removidos: 'A menos',
    salario: 'Salário', vencimento: 'Vencimento', emissao: 'Emissão', participante_nome: 'Participante',
    valor_total: 'Valor total', serie: 'Série', chave: 'Chave', margem: 'Margem', fornecedor: 'Fornecedor',
    ativo: 'Ativo', familia: 'Família', ncm: 'NCM', modelo: 'Modelo', fabricante: 'Fabricante', imagem: 'Imagem'
}

function nomeCampoHU(tabela, c = []) {
    if (!c.length) return 'Registro inteiro'
    const partes = []
    for (let i = 0; i < c.length; i++) {
        const p = String(c[i]), anterior = c[i - 1]
        // Itens do orçamento: dados_composicoes/<código>/<campo> → "Item 722 › Preço"
        if (['dados_composicoes', 'esquema_composicoes'].includes(anterior)) { partes.push(`Item ${p}`); continue }
        if (/^\d+$/.test(p)) { if (!(tabela === 'lista_pagamentos' && anterior === 'param' && p === '0')) partes.push(`nº ${Number(p) + 1}`); continue }
        if (/^[0-9a-f-]{20,}$/i.test(p) || /^[A-Za-z0-9_-]{5,}$/.test(p) && !CAMPOS_HU[p] && /\d/.test(p)) continue  // ids internos
        partes.push(p in CAMPOS_HU ? CAMPOS_HU[p] : inicialMaiuscula(p.replace(/_/g, ' ')))
    }
    return partes.filter(Boolean).join(' › ') || 'Registro'
}

function valorHU(v, ausente) {
    if (ausente) return '<i class="hu-nada">—</i>'
    if (v === null || v === '') return '<i class="hu-nada">(vazio)</i>'
    if (v === '[SIGILOSO]' || v === '[OCULTO]') return '<i class="hu-nada">••• sigiloso</i>'
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
    if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
    if (typeof v === 'string') {
        const curto = v.length > 160 ? v.slice(0, 160) + '…' : v
        return `<span title="${escHU(v)}">${escHU(curto)}</span>`
    }
    // Objeto/lista: o que tiver de mais legível
    const legivel = v && !Array.isArray(v) && (v.status || v.nome || v.descricao || v.justificativa || v.comentario)
    const json = JSON.stringify(v)
    const curto = legivel ? String(legivel) : (json.length > 140 ? json.slice(0, 140) + '…' : json)
    return `<span class="hu-obj" title="${escHU(json.slice(0, 2000))}">${escHU(curto)}</span>`
}

const ACAO_HU = { I: ['Criou', 'hu-criou'], U: ['Editou', 'hu-editou'], D: ['Apagou', 'hu-apagou'] }

function origemHU(v) {
    const o = String(v.origem || '')
    if (o.startsWith('restauração')) return o.replace('restauração', 'voltou versão')
    if (v.usuario) return ''
    const mapa = {
        'gcs:server': 'GCS (automático)', 'gcs:atualizar_pagamentos': 'Sincronização Omie (pagamentos)',
        'gcs:atualizar_notas': 'Sincronização Omie (notas)', 'gcs:cadastrar_clientes': 'Sincronização de cadastros',
        psql: 'Direto no banco (suporte)', banco: 'Banco (sem identificação)'
    }
    return mapa[o] || (o.startsWith('gcs:') ? `Script ${o.slice(4)}` : o || 'Banco')
}

const quandoHU = q => new Date(q).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

// ---------------------------------------------------------------- tela (layout das faturas a pagar, .fin-tela)
// Topo: título, abas (Alterações | Uso do sistema) e botões. Alterações: tabela vw_versoes com filtros no cabeçalho,
// caixinhas (Excel das marcadas), paginação no rodapé e painel lateral retrátil com a alteração escolhida.

const POR_PAGINA_HU = 50
let painelHUAberto = true
let versaoAtivaHU = null
const selecaoHU = new Set()

async function daily(filtroExtra = null) {
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
    titulo.innerHTML = 'Histórico de Uso GCS'
    tela.innerHTML = `
        <div class="fis-pagina fin-tela hu-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Histórico de Uso GCS</h2>
                    <div class="fin-barra">
                        <span class="hu-botoes" data-hu-botoes></span>
                    </div>
                </header>
                <div class="hu-corpo" data-hu-corpo></div>
            </section>
        </div>`
    estadoHU.aba = 'alteracoes'
    await desenharAlteracoesHU(document.querySelector('[data-hu-corpo]'), filtroExtra)
}

// Uso do sistema (menu próprio): atividades de logs_rotas e o mapa de calor de dias x horários.
async function telaUsoSistema() {
    titulo.innerHTML = 'Uso do sistema'
    estadoHU.aba = 'uso'
    tela.innerHTML = `
        <div class="pagina-conteudo hu">
            <div class="cabecalho-pagina"><h2>Uso do sistema</h2></div>
            <div data-hu-corpo></div>
        </div>`
    await dailyUso(document.querySelector('[data-hu-corpo]'))
}

async function desenharAlteracoesHU(corpo, filtroExtra = null) {
    const botoes = document.querySelector('[data-hu-botoes]')
    if (botoes) botoes.innerHTML = `
        <button type="button" onclick="baixarExcelVersoesHU()" title="Com alterações marcadas, baixa só as marcadas; sem marcação, todos os resultados dos filtros aplicados">${iconeFin('excel')} Excel</button>
        ${filtroExtra ? `<button type="button" onclick="daily()">${iconeFin('fechar')} Limpar filtro</button>` : ''}`
    corpo.innerHTML = `
        <div class="fin-corpo${painelHUAberto ? '' : ' recolhido'}" data-corpo-hu>
            <div class="fin-tabela-area" data-tabela-hu></div>
            <div class="fin-lateral fis-cred-lateral hu-lateral">
                <button type="button" class="fin-recolher" onclick="alternarPainelHU()" aria-expanded="${painelHUAberto}"
                    title="${painelHUAberto ? 'Recolher' : 'Mostrar'} o painel">${iconeFin('seta')}</button>
                <aside class="fin-painel fis-cred-painel hu-painel" data-painel-hu></aside>
            </div>
        </div>`
    versaoAtivaHU = null
    selecaoHU.clear()
    desenharPainelHU()
    try {
        delete controles.versoesHU
        const area = document.querySelector('[data-tabela-hu]')
        area.innerHTML = await modTab({
            base: 'vw_versoes',
            pag: 'versoesHU',
            body: 'bodyVersoesHU',
            criarLinha: 'criarLinhaVersaoHU',
            caber: true,
            limite: POR_PAGINA_HU,
            funcaoAdicional: ['aposCarregarVersoesHU'],
            filtrosFixos: { ...(filtroExtra || {}) },
            ordenar: [{ path: 'id', direcao: 'desc' }],
            colunas: {
                '': {},
                'Quando': { chave: 'dia', tipoPesquisa: 'data' },
                'Quem': { chave: 'quem', tipoPesquisa: 'select' },
                'Autor': { chave: 'autor', tipoPesquisa: 'select', rotulos: { PESSOA: 'PESSOA', SISTEMA: 'SISTEMA' } },
                'Ação': { chave: 'acao', tipoPesquisa: 'select' },
                'Módulo': { chave: 'modulo', tipoPesquisa: 'select' },
                'Registro': { chave: 'rotulo' },
                'O que mudou': {},
                'Mudanças': { chave: 'qtd_mudancas', tipoOrdenacao: 'numero' }
            }
        })
        area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', '<div class="fin-rodape" data-rodape-hu></div>')
        area.querySelector('.modtab')?.insertAdjacentHTML('afterbegin', '<div class="fin-aviso-selecao" data-aviso-hu hidden></div>')
        await paginacao('versoesHU')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o histórico: ${escHU(err.message)}` })
    }
}

function alternarPainelHU(abrir = null) {
    const corpo = document.querySelector('[data-corpo-hu]')
    if (!corpo) return
    const aberto = abrir ?? corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !aberto)
    const botao = corpo.querySelector('.fin-recolher')
    botao?.setAttribute('aria-expanded', String(aberto))
    if (botao) botao.title = `${aberto ? 'Recolher' : 'Mostrar'} o painel`
    painelHUAberto = aberto
}

const ACAO_TAB_HU = {
    CRIOU: ['Criou', '#15803d'], EDITOU: ['Editou', '#1d4ed8'], APAGOU: ['Apagou', '#b91c1c'], VOLTOU: ['Voltou versão', '#92400e']
}

// Texto simples (sem HTML) de um valor, para a linha e o Excel.
function valorTextoHU(v, ausente) {
    if (ausente) return '—'
    if (v === null || v === '') return '(vazio)'
    if (v === '[SIGILOSO]' || v === '[OCULTO]') return '•••'
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não'
    if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
    if (typeof v === 'string') return v.length > 60 ? v.slice(0, 60) + '…' : v
    const legivel = v && !Array.isArray(v) && (v.status || v.nome || v.descricao || v.justificativa || v.comentario)
    if (legivel) return String(legivel)
    const json = JSON.stringify(v)
    return json.length > 60 ? json.slice(0, 60) + '…' : json
}

function resumoTextoHU(tabela, mudancas = [], total = 0) {
    const vistos = new Set()
    const partes = []
    for (const m of mudancas || []) {
        const t = `${nomeCampoHU(tabela, m.c)}: ${valorTextoHU(m.a, !('a' in m))} → ${valorTextoHU(m.d, !('d' in m))}`
        if (vistos.has(t)) continue
        vistos.add(t)
        partes.push(t)
    }
    const resto = Number(total || 0) - (mudancas || []).length
    return partes.join('  ·  ') + (resto > 0 ? `  · +${resto}` : '')
}

const dadosVersoesHU = new Map()

function criarLinhaVersaoHU(v) {
    dadosVersoesHU.set(String(v.id), v)
    const id = Number(v.id)
    const [acao, cor] = ACAO_TAB_HU[v.acao] || [v.acao, '#64748b']
    const resumo = v.acao === 'CRIOU' ? 'Registro criado' : v.acao === 'APAGOU' ? 'Registro apagado (cópia guardada)'
        : v.tabela === 'rh_salarios' ? 'Valor sigiloso' : resumoTextoHU(v.tabela, v.resumo, v.qtd_mudancas)
    return `
        <tr class="fin-linha${String(versaoAtivaHU) === String(id) ? ' fin-linha-ativa' : ''}" data-id="${id}"
            onclick="selecionarVersaoHU(${id}, event)" ondblclick="abrirVersaoHU(${id})" title="Clique para ver no painel; duplo clique abre os detalhes">
            <td class="fin-col-marcar">
                <input type="checkbox" class="fin-marcar" data-marcar-hu value="${id}" ${selecaoHU.has(String(id)) ? 'checked' : ''}
                    onclick="event.stopPropagation(); marcarVersaoHU(this)" ondblclick="event.stopPropagation()" aria-label="Marcar alteração">
            </td>
            <td class="fin-centro">${quandoHU(v.quando)}</td>
            <td class="fin-obs hu-col-quem" title="${escHU(v.quem)}"><span class="fin-obs-txt">${escHU(v.quem)}</span></td>
            <td class="fin-centro"><small>${v.autor === 'PESSOA' ? 'Pessoa' : 'Sistema'}</small></td>
            <td>${typeof etiquetaEst === 'function' ? etiquetaEst(acao, cor) : escHU(acao)}</td>
            <td class="fin-obs hu-col-modulo" title="${escHU(v.modulo)}"><span class="fin-obs-txt">${escHU(v.modulo)}</span></td>
            <td class="fin-obs hu-col-registro" title="${escHU(v.rotulo)}"><span class="fin-obs-txt"><b>${escHU(v.rotulo)}</b></span></td>
            <td class="fin-obs hu-col-resumo" title="${escHU(resumo)}"><span class="fin-obs-txt">${escHU(resumo)}</span></td>
            <td class="fis-num">${Number(v.qtd_mudancas) || ''}</td>
        </tr>`
}

async function aposCarregarVersoesHU() {
    const tabela = document.getElementById('bodyVersoesHU')?.closest('table')
    if (!tabela) return
    const th = tabela.querySelector('thead tr:first-child th:first-child')
    if (th && !th.querySelector('[data-marcar-todas-hu]'))
        th.innerHTML = '<input type="checkbox" class="fin-marcar" data-marcar-todas-hu title="Marcar todas desta página" onclick="event.stopPropagation(); marcarTodasHU(this)">'
    const filtro = tabela.querySelector('thead tr:nth-child(2) th:first-child')
    if (filtro?.querySelector('img')) filtro.innerHTML = ''
    if (!tabela.querySelector('tbody.fin-enchimento')) {
        const enchimento = document.createElement('tbody')
        enchimento.className = 'fin-enchimento'
        enchimento.innerHTML = `<tr><td colspan="${Object.keys(controles.versoesHU?.colunas || {}).length || 9}"></td></tr>`
        tabela.appendChild(enchimento)
    }
    if (typeof cabecalhoAvancadoTabela === 'function')
        await cabecalhoAvancadoTabela('versoesHU', { prefKey: 'historico_versoes' })
    desenharRodapeHU()
    desenharSelecaoHU()
}

function desenharRodapeHU() {
    const alvo = document.querySelector('[data-rodape-hu]')
    const ctrl = controles.versoesHU
    if (!alvo || !ctrl) return
    const total = Number(document.getElementById('resultados_versoesHU')?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const inicio = total ? (pagina - 1) * POR_PAGINA_HU + 1 : 0
    const fim = Math.min(total, pagina * POR_PAGINA_HU)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaHU(${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} alteraç${total === 1 ? 'ão' : 'ões'}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaHU(this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaHU(n) {
    const ctrl = controles.versoesHU
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeHU()
    ctrl.pagina = pagina
    await paginacao('versoesHU')
}

// ---------- seleção (caixinhas) e Excel

function marcarVersaoHU(caixa) {
    if (caixa.checked) selecaoHU.add(caixa.value)
    else selecaoHU.delete(caixa.value)
    desenharSelecaoHU()
}

function marcarTodasHU(caixa) {
    document.querySelectorAll('#bodyVersoesHU [data-marcar-hu]').forEach(c => {
        c.checked = caixa.checked
        if (caixa.checked) selecaoHU.add(c.value)
        else selecaoHU.delete(c.value)
    })
    desenharSelecaoHU()
}

function limparSelecaoHU() {
    selecaoHU.clear()
    document.querySelectorAll('#bodyVersoesHU [data-marcar-hu]').forEach(c => { c.checked = false })
    desenharSelecaoHU()
}

async function selecionarTodasFiltroHU() {
    const ctrl = controles.versoesHU
    if (!ctrl) return
    overlayAguarde()
    try {
        const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_versoes', filtros, pagina, limite: 2000 })
            ;(r?.resultados || []).forEach(v => selecaoHU.add(String(v.id)))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas && pagina <= 50)
        document.querySelectorAll('#bodyVersoesHU [data-marcar-hu]').forEach(c => { c.checked = selecaoHU.has(c.value) })
        desenharSelecaoHU()
    } catch (err) {
        popup({ mensagem: `Falha ao marcar as alterações do filtro: ${escHU(err.message)}` })
    } finally {
        removerOverlay()
    }
}

function desenharSelecaoHU() {
    const pagina = [...document.querySelectorAll('#bodyVersoesHU [data-marcar-hu]')]
    const marcadas = pagina.filter(c => c.checked).length
    const paginaToda = pagina.length > 0 && marcadas === pagina.length
    const todas = document.querySelector('[data-marcar-todas-hu]')
    if (todas) {
        todas.checked = paginaToda
        todas.indeterminate = marcadas > 0 && marcadas < pagina.length
    }
    const aviso = document.querySelector('[data-aviso-hu]')
    if (!aviso) return
    const n = selecaoHU.size
    const total = Number(document.getElementById('resultados_versoesHU')?.textContent) || 0
    const plural = q => `${q.toLocaleString('pt-BR')} ${q === 1 ? 'alteração' : 'alterações'}`
    const limpar = '<a href="#" onclick="event.preventDefault(); limparSelecaoHU()">limpar a seleção</a>'
    aviso.hidden = !(n && paginaToda)
    aviso.innerHTML = aviso.hidden ? '' : n < total
        ? `Você selecionou ${plural(n)}. Você pode ${limpar} ou <a href="#" onclick="event.preventDefault(); selecionarTodasFiltroHU()">selecionar todas as ${plural(total)} deste filtro</a>`
        : `Você selecionou ${n === total ? 'todas as ' : ''}${plural(n)}${n === total ? ' deste filtro' : ''}. Você pode ${limpar}`
}

async function baixarExcelVersoesHU() {
    const ctrl = controles.versoesHU
    if (!ctrl) return
    overlayAguarde()
    try {
        const marcadas = [...selecaoHU]
        const filtros = marcadas.length
            ? { id: { modo: 'OR', regras: marcadas.map(id => ({ op: '=', value: id })) } }
            : combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        const linhas = []
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_versoes', filtros, ordenar: [{ path: 'id', direcao: 'desc' }], pagina, limite: 2000 })
            linhas.push(...(r?.resultados || []))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas && pagina <= 50)
        await baixarExcelRelatorioGCS({
            titulo: 'Histórico de Uso GCS · alterações',
            resumo: `${linhas.length} alteração(ões)`,
            filtrosTexto: marcadas.length ? `Alterações marcadas na tela: ${marcadas.length}` : `Filtros: ${typeof descreverFiltrosFin === 'function' ? descreverFiltrosFin(ctrl).replace('nenhum (todas as faturas)', 'nenhum (todas as alterações)') : ''}`,
            linhas,
            colunas: [
                { titulo: 'Quando', largura: 19, valor: d => quandoHU(d.quando) },
                { titulo: 'Quem', largura: 22, valor: d => d.quem || '' },
                { titulo: 'Autor', largura: 9, centro: true, valor: d => d.autor === 'PESSOA' ? 'Pessoa' : 'Sistema' },
                { titulo: 'Ação', largura: 13, valor: d => (ACAO_TAB_HU[d.acao] || [d.acao])[0] },
                { titulo: 'Módulo', largura: 22, valor: d => d.modulo || '' },
                { titulo: 'Registro', largura: 40, valor: d => d.rotulo || '' },
                { titulo: 'O que mudou', largura: 80, valor: d => d.acao === 'CRIOU' ? 'Registro criado' : d.acao === 'APAGOU' ? 'Registro apagado' : resumoTextoHU(d.tabela, d.resumo, d.qtd_mudancas) },
                { titulo: 'Mudanças', largura: 10, valor: d => Number(d.qtd_mudancas) || 0 }
            ]
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escHU(err.message)}` })
    } finally {
        removerOverlay()
    }
}

// ---------- painel lateral: a alteração escolhida

async function selecionarVersaoHU(id, event) {
    if (event?.target?.closest('input, button, a, select')) return
    versaoAtivaHU = String(id)
    document.querySelectorAll('#bodyVersoesHU > tr[data-id]').forEach(tr => tr.classList.toggle('fin-linha-ativa', tr.dataset.id === versaoAtivaHU))
    alternarPainelHU(true)
    const painel = document.querySelector('[data-painel-hu]')
    if (painel) painel.innerHTML = '<div class="fin-painel-cabeca"><span class="fin-avatar">…</span><div class="fin-painel-texto"><b>Carregando…</b></div></div>'
    try {
        const r = await apiVersoes('detalhe', { id })
        if (versaoAtivaHU !== String(id)) return
        desenharPainelHU(r)
    } catch (err) {
        if (painel) painel.innerHTML = `<div class="fin-painel-texto"><small>${escHU(err.message)}</small></div>`
    }
}

function desenharPainelHU(detalhe = null) {
    const painel = document.querySelector('[data-painel-hu]')
    if (!painel) return
    const cabeca = (circulo, titulo, sub = '') => `
        <div class="fin-painel-cabeca" title="${escHU(titulo)}">
            <span class="fin-avatar">${escHU(circulo)}</span>
            <div class="fin-painel-texto"><b>${escHU(titulo)}</b>${sub}</div>
        </div>`
    if (!detalhe) {
        painel.innerHTML = `
            ${cabeca('?', 'Nenhuma alteração escolhida', '<small>Clique numa linha para ver aqui o antes → depois e as ações. Duplo clique abre os detalhes.</small>')}`
        return
    }
    const { versao: v, posteriores = [], podeRestaurar } = detalhe
    const acao = v.origem?.startsWith('restauração') ? 'Voltou versão' : (ACAO_HU[v.operacao] || ['Alterou'])[0]
    const quem = v.usuario || origemHU(v)
    const iniciais = typeof iniciaisFin === 'function' ? iniciaisFin(quem) : String(quem || '?').slice(0, 2).toUpperCase()
    const vistos = new Set()
    const mudancas = v.operacao === 'D'
        ? '<div class="hu-p-nada">Registro apagado. A cópia completa está guardada.</div>'
        : v.operacao === 'I' ? '<div class="hu-p-nada">Registro criado.</div>'
        : (v.mudancas || []).map(m => {
            const campo = nomeCampoHU(v.tabela, m.c)
            const chave = `${campo}|${JSON.stringify(m.a)}|${JSON.stringify(m.d)}`
            if (vistos.has(chave)) return ''
            vistos.add(chave)
            return `
                <div class="hu-p-mud">
                    <span class="hu-p-campo">${escHU(campo)}</span>
                    <span class="hu-p-antes">${valorHU(m.a, !('a' in m))}</span>
                    <span class="hu-p-depois">${valorHU(m.d, !('d' in m))}</span>
                </div>`
        }).join('')
    const acaoBotao = (icone, texto, funcao, { perigo = false } = {}) => `
        <button type="button" class="fin-acao${perigo ? ' perigo' : ''}" title="${escHU(texto)}" onclick="${funcao}">${iconeFin(icone)}<span>${texto}</span></button>`
    painel.innerHTML = `
        ${cabeca(iniciais, v.rotulo || v.registro, `<small>${escHU(nomeTabelaHU(v.tabela))} · ${acao}</small><small>${escHU(quem)} · ${quandoHU(v.quando)}</small>`)}
        <div class="hu-p-lista">${mudancas}</div>
        ${podeRestaurar && posteriores.length ? `<div class="hu-p-aviso">Depois desta, mais ${posteriores.length} alteração(ões) no registro: voltar desfaz essas também.</div>` : ''}
        <hr>
        ${acaoBotao('ver', 'Ver detalhes', `abrirVersaoHU(${Number(v.id)})`)}
        ${acaoBotao('repetir', 'Todas as versões do registro', `daily({ tabela: { op: '=', value: ${escHU(JSON.stringify(v.tabela))} }, registro: { op: '=', value: ${escHU(JSON.stringify(v.registro))} } })`)}
        ${podeRestaurar ? `
            ${acaoBotao('cancelar', v.operacao === 'I' ? 'Desfazer a criação' : v.operacao === 'D' ? 'Trazer de volta' : 'Desfazer esta alteração', `voltarVersaoHU(${Number(v.id)}, true)`, { perigo: v.operacao === 'I' })}
            ${v.operacao !== 'D' && posteriores.length ? acaoBotao('vencimento', 'Voltar para como ficou aqui', `voltarVersaoHU(${Number(v.id)}, false)`) : ''}` : ''}`
}

// Cartão de uma versão (linha do tempo de um registro: abrirVersoesRegistro).
function cartaoVersaoHU(v, { mostrarRegistro = true } = {}) {
    const [acao, classe] = ACAO_HU[v.operacao] || ['Alterou', '']
    const origem = origemHU(v)
    // Itens do orçamento mudam em dois lugares (esquema e itens gerados): no cartão aparece uma vez.
    const vistos = new Set()
    const linhas = (v.mudancas || []).map(m => {
        const html = `
        <div class="hu-mud">
            <span class="hu-campo">${escHU(nomeCampoHU(v.tabela, m.c))}</span>
            <span class="hu-antes">${valorHU(m.a, !('a' in m))}</span>
            <span class="hu-seta">→</span>
            <span class="hu-depois">${valorHU(m.d, !('d' in m))}</span>
        </div>`
        if (vistos.has(html)) return ''
        vistos.add(html)
        return html
    }).join('')
    const resto = (v.total_mudancas || 0) - (v.mudancas || []).length
    return `
        <div class="hu-cartao">
            <div class="hu-cartao-topo">
                <span class="hu-hora">${quandoHU(v.quando)}</span>
                <span class="hu-quem">${escHU(v.usuario || origem)}</span>
                <span class="hu-acao ${classe}">${acao}</span>
                ${mostrarRegistro ? `<span class="hu-tabela">${escHU(nomeTabelaHU(v.tabela))}</span>
                    <a class="hu-registro" onclick="abrirVersoesRegistro(${jsHU(v.tabela)}, ${jsHU(v.registro)})" title="Ver todas as versões deste registro">${escHU(v.rotulo || v.registro)}</a>` : ''}
                ${v.usuario && origem ? `<span class="hu-origem">${escHU(origem)}</span>` : ''}
                <span class="hu-espaco"></span>
                <button type="button" class="hu-btn" onclick="abrirVersaoHU(${Number(v.id)})">Detalhes${estadoHU.podeRestaurar ? ' / voltar' : ''}</button>
            </div>
            ${v.operacao === 'D' ? '<div class="hu-mud hu-nada">Registro apagado. A cópia completa ficou guardada (dá para trazer de volta).</div>' : ''}
            ${v.operacao === 'I' ? '<div class="hu-mud hu-nada">Registro criado.</div>' : ''}
            ${linhas}
            ${resto > 0 ? `<div class="hu-mais" onclick="abrirVersaoHU(${Number(v.id)})">+ ${resto} mudança${resto > 1 ? 's' : ''}…</div>` : ''}
        </div>`
}


// ---------------------------------------------------------------- detalhe e voltar

async function abrirVersaoHU(id) {
    overlayAguarde()
    let r
    try { r = await apiVersoes('detalhe', { id }) }
    catch (erro) { removerOverlay(); return popup({ mensagem: escHU(erro.message) }) }
    removerOverlay()
    const { versao: v, posteriores, podeRestaurar } = r
    const [acao] = ACAO_HU[v.operacao] || ['Alterou']
    const linhas = v.operacao === 'D'
        ? '<tr><td colspan="3" class="hu-nada">Registro apagado (a cópia completa está guardada).</td></tr>'
        : (v.mudancas || []).map(m => `
            <tr>
                <td>${escHU(nomeCampoHU(v.tabela, m.c))}<div class="hu-caminho">${escHU((m.c || []).join(' / '))}</div></td>
                <td class="hu-antes">${valorHU(m.a, !('a' in m))}</td>
                <td class="hu-depois">${valorHU(m.d, !('d' in m))}</td>
            </tr>`).join('') || '<tr><td colspan="3" class="hu-nada">Registro criado.</td></tr>'
    const outros = posteriores.length
        ? `<div class="hu-aviso">Depois desta, o registro teve mais ${posteriores.length} alteração(ões):
            ${posteriores.slice(0, 8).map(p => `${escHU(p.usuario || origemHU(p))} (${quandoHU(p.quando)})`).join(', ')}${posteriores.length > 8 ? '…' : ''}.
            Voltar desfaz essas também.</div>` : ''
    const botoes = podeRestaurar ? `
        <div class="hu-acoes">
            <button type="button" onclick="voltarVersaoHU(${Number(v.id)}, true)"
                title="O registro fica como estava logo antes desta alteração">${v.operacao === 'I' ? 'Desfazer a criação (apagar)' : v.operacao === 'D' ? 'Trazer de volta' : 'Desfazer esta alteração'}</button>
            ${v.operacao !== 'D' && posteriores.length ? `<button type="button" onclick="voltarVersaoHU(${Number(v.id)}, false)"
                title="O registro fica como estava logo depois desta alteração">Voltar para como ficou aqui</button>` : ''}
        </div>` : ''
    popup({
        titulo: `${acao} · ${nomeTabelaHU(v.tabela)} ${v.rotulo || v.registro}`,
        elemento: `
            <div class="hu-detalhe">
                <div class="hu-detalhe-topo">
                    <span><b>${escHU(v.usuario || origemHU(v))}</b> em ${quandoHU(v.quando)}</span>
                    ${v.usuario && origemHU(v) ? `<span class="hu-origem">${escHU(origemHU(v))}</span>` : ''}
                    <a class="hu-registro" onclick="abrirVersoesRegistro(${jsHU(v.tabela)}, ${jsHU(v.registro)})">Todas as versões deste registro</a>
                </div>
                <table class="hu-tabela-mud">
                    <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
                ${podeRestaurar ? outros : ''}
                ${botoes}
            </div>`
    })
}

async function voltarVersaoHU(id, antes) {
    const ok = await confirmarPopup({
        titulo: 'Voltar versão',
        mensagem: antes
            ? 'O registro volta a ficar como estava <b>antes</b> desta alteração (ela e as seguintes são desfeitas).<br><br>Isso não desfaz o que já aconteceu em outros lugares (notas emitidas, pagamentos no Omie, saldos já abatidos). A volta também fica registrada como uma versão nova.'
            : 'O registro volta a ficar como estava <b>logo depois</b> desta alteração (as seguintes são desfeitas).<br><br>Isso não desfaz o que já aconteceu em outros lugares (notas emitidas, pagamentos no Omie, saldos já abatidos). A volta também fica registrada como uma versão nova.',
        textoConfirmar: 'Voltar'
    })
    if (!ok) return
    overlayAguarde()
    try {
        await apiVersoes('restaurar', { id, antes })
        removerOverlay()
        removerTodosPopups()
        popup({ mensagem: 'Pronto: o registro voltou para a versão escolhida.' })
        if (estadoHU.aba === 'alteracoes' && controles.versoesHU) { await paginacao('versoesHU'); if (versaoAtivaHU) selecionarVersaoHU(Number(versaoAtivaHU)) }
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: escHU(erro.message) })
    }
}

// Linha do tempo de um registro (também chamada de outras telas).
async function abrirVersoesRegistro(tabela, registro) {
    overlayAguarde()
    let r
    try { r = await apiVersoes('registro', { tabela, registro }) }
    catch (erro) { removerOverlay(); return popup({ mensagem: escHU(erro.message) }) }
    removerOverlay()
    estadoHU.podeRestaurar = r.podeRestaurar
    popup({
        titulo: `Versões · ${nomeTabelaHU(tabela)} ${r.rotulo || registro}`,
        elemento: `
            <div class="hu-linha-tempo">
                ${r.itens.map(v => cartaoVersaoHU(v, { mostrarRegistro: false })).join('')
                    || '<div class="hu-vazio">Nenhuma versão guardada deste registro (as versões começaram em 18/11/2026).</div>'}
            </div>`
    })
}

// ---------------------------------------------------------------- uso do sistema (logs_rotas)

async function dailyUso(corpo) {

    try {

        overlayAguarde()

        const { criadores } = await recuperarDado('mvw_opcoes_filtros', 1) || {}

        const dropdownUsuarios = montarDropdownCheckbox({
            titulo: 'Usuários',
            pag: 'daily',
            path: 'usuario',
            opcoes: criadores || []
        })

        const tabela = await modTab({
            btnExtras: dropdownUsuarios,
            base: 'logs_rotas',
            pag: 'daily',
            body: 'bodyDaily',
            funcaoAdicional: ['graficoMapaCalor'],
            criarLinha: 'linDaily',
            filtros: {
                'rota': { op: '!=', value: '/acesso' }
            },
            colunas: {
                'Usuário': { chave: 'usuario' },
                'Data': { chave: 'data', tipoPesquisa: 'data' },
                'Tabela': { chave: 'body.caminho' },
                'Detalhes': {}
            }
        })

        corpo.innerHTML = `
            <div class="daily">
                <div class="pagina-conteudo">
                ${tabela}
            </div>
                <div class="mapa-calor">
                    <h2>Dias x Horários de maior uso do GCS</h2>
                </div>
            </div>`

        await paginacao()

        removerOverlay()

    } catch (err) {
        console.error(err)
        removerOverlay()
        popup({ mensagem: 'Falha ao abrir o histórico de Uso: Fale com o suporte.' })
    }

}


function resumirValor(body) {
    const { valor, caminho } = body || {}

    // Desde 18/11/2026 o conteúdo das gravações fica nas versões (aba Alterações).
    if (body?.versionado)
        return 'O que mudou está na aba Alterações'

    if (!valor)
        return ''

    if (valor === 'string')
        return valor

    if (caminho.includes('/tags'))
        return 'Alterou a tag'

    if (caminho.includes('postit/'))
        return ''

    if (caminho.includes('historico/') && valor?.justificativa == 'ok')
        return 'Aprovou um pagamento'

    const candidatos = [
        valor,
        valor.para,
        valor.titulo,
        valor.nome,
        valor.descricao,
        valor.comentario,
        valor.pedido,
        valor.contrato,
        valor.chamado,
        valor.codigo
    ].filter(v => typeof v === 'string' || typeof v === 'number')

    const principal = candidatos.find(v => String(v).trim())
    if (principal)
        return String(principal).trim()

    return ''
}

function traducaoLog({ body, rota }) {

    const { caminho = '' } = body || {}
    const partes = caminho.split('/')
    const tabela = inicialMaiuscula(partes[0])

    let traducao = ''

    if (rota == '/salvar') {

        traducao = `Editou • ${tabela}`

    } else if (rota == '/deletar') {

        traducao = `Apagou • ${tabela}`

    } else if (rota == '/excel') {

        traducao = `Baixou um relatório em Excel`

    }

    return traducao || rota

}

function linDaily(dados) {

    const { id, usuario, data, body } = dados || {}

    const traducao = traducaoLog(dados)
    const valorResumido = resumirValor(body)
    const tabela = inicialMaiuscula(body?.caminho?.split('/')?.[0] || '')

    const tr = `
        <tr>
            <td>
                <div style="${vertical};gap: 1rem;">
                    <span>${usuario}</span>
                    <span style="color: #ff2022;">${id}</span>
                </div>
            </td>
            <td>${data}</td>
            <td>${tabela}</td>
            <td>    
                <div style="${vertical}; gap: 1rem;">
                    <span><b>${traducao}</b></span>
                    <div style="white-space: pre-wrap;">${valorResumido}</div>
                </div>
            </td>
        </tr>
    `

    return tr

}

function obterMesAnoFiltroDaily() {
    const filtrosData = controles?.daily?.filtros?.data || []
    const hoje = dataServidor()

    let dataInicial = null
    let dataFinal = null

    for (const item of filtrosData) {
        if (!item?.value) continue

        if (item.op === '>=d') dataInicial = item.value
        if (item.op === '<=d') dataFinal = item.value
    }

    const dataBase = dataInicial || dataFinal

    if (!dataBase) {
        return {
            mes: hoje.getMonth() + 1,
            ano: hoje.getFullYear(),
            dataInicial: null,
            dataFinal: null
        }
    }

    const [ano, mes] = String(dataBase).split('-').map(Number)

    return {
        mes,
        ano,
        dataInicial,
        dataFinal
    }
}

async function graficoMapaCalor() {
    const filtros = controles?.daily?.filtros || {}
    const { mes, ano, dataInicial, dataFinal } = obterMesAnoFiltroDaily()

    const contagem = await contarPorCampo({
        base: 'logs_rotas',
        filtros,
        path: 'data'
    })

    const mapaCalor = document.querySelector('.mapa-calor')
    if (!mapaCalor) return

    const titulo = mapaCalor.querySelector('h2')
    if (titulo) {
        titulo.textContent = dataInicial || dataFinal
            ? `Dias x Horários de maior uso do GCS (${dataInicial || '...'} até ${dataFinal || '...'})`
            : 'Dias x Horários de maior uso do GCS'
    }

    if (!document.getElementById('chart-mapa-calor')) {
        mapaCalor.insertAdjacentHTML('beforeend', `<div id="chart-mapa-calor"></div>`)
    }

    const series = montarSeriesMapaCalor(contagem, mes, ano)
    const ranges = criarFaixasCor(series)

    if (chartMapaCalor) chartMapaCalor.destroy()

    chartMapaCalor = new ApexCharts(
        document.querySelector('#chart-mapa-calor'),
        {
            chart: {
                type: 'heatmap',
                height: 220 + (series.length * 12),
                toolbar: { show: false }
            },
            series,
            dataLabels: {
                enabled: false
            },
            plotOptions: {
                heatmap: {
                    shadeIntensity: 0,
                    colorScale: { ranges }
                }
            },
            stroke: {
                width: 1,
                colors: ['#ddd']
            },
            xaxis: {
                type: 'category',
                categories: Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, '0')}h`),
                labels: { rotate: 0 }
            },
            yaxis: {
                reversed: true
            },
            tooltip: {
                y: {
                    formatter: value => value || 0
                }
            },
            legend: {
                show: false
            }
        }
    )

    chartMapaCalor.render()
}

function criarFaixasCor(series) {
    const valores = series
        .flatMap(linha => linha.data.map(p => Number(p.y || 0)))
        .filter(v => v > 0)

    if (!valores.length) {
        return [
            {
                from: 0,
                to: 0,
                color: '#ffffff',
                name: 'Sem dados'
            }
        ]
    }

    const min = Math.min(...valores)
    const max = Math.max(...valores)

    if (min === max) {
        return [
            {
                from: 0,
                to: 0,
                color: '#ffffff',
                name: '0'
            },
            {
                from: min,
                to: max,
                color: '#ff0000',
                name: String(max)
            }
        ]
    }

    const faixas = 6
    const passo = (max - min) / faixas

    const ranges = [
        {
            from: 0,
            to: 0,
            color: '#ffffff',
            name: '0'
        }
    ]

    for (let i = 0; i < faixas; i++) {
        const from = i === 0 ? min : (min + passo * i)
        const to = i === faixas - 1 ? max : (min + passo * (i + 1))

        const intensidade = (i + 1) / faixas
        const verdeAzul = Math.round(255 * (1 - intensidade))

        ranges.push({
            from,
            to,
            color: `rgb(255, ${verdeAzul}, ${verdeAzul})`,
            name: `${Math.round(from)} - ${Math.round(to)}`
        })
    }

    return ranges
}

function montarSeriesMapaCalor(dados, mes, ano) {
    const diasNoMes = new Date(ano, mes, 0).getDate()
    const horaInicio = 5
    const horaFim = 23
    const mapa = {}

    for (const [dataHora, qtde] of Object.entries(dados || {})) {
        if (!dataHora)
            continue

        const [data = '', hora = ''] = String(dataHora).split(', ')
        const [dia, mesRegistro, anoRegistro] = data.split('/').map(Number)
        const horaNumero = Number((hora.split(':')[0] || 0))

        if (
            !dia ||
            !mesRegistro ||
            !anoRegistro ||
            Number.isNaN(horaNumero) ||
            mesRegistro !== mes ||
            anoRegistro !== ano ||
            horaNumero < horaInicio ||
            horaNumero > horaFim
        ) continue

        mapa[dia] ??= {}
        mapa[dia][horaNumero] = (mapa[dia][horaNumero] || 0) + Number(qtde || 0)
    }

    return Array.from({ length: diasNoMes }, (_, i) => {
        const dia = i + 1

        return {
            name: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`,
            data: Array.from({ length: horaFim - horaInicio + 1 }, (_, j) => {
                const hora = horaInicio + j
                return {
                    x: `${String(hora).padStart(2, '0')}h`,
                    y: mapa?.[dia]?.[hora] || 0
                }
            })
        }
    })
}

function criarFaixasCor(series) {
    const valores = series.flatMap(linha => linha.data.map(p => p.y))
    const max = Math.max(...valores, 0)

    if (max <= 0) {
        return [{
            from: 0,
            to: 0,
            color: '#ffffff',
            name: 'Sem dados'
        }]
    }

    const faixas = 6
    const passo = Math.ceil(max / faixas)

    return Array.from({ length: faixas }, (_, i) => {
        const from = i * passo
        const to = i === faixas - 1 ? max : ((i + 1) * passo) - 1
        const intensidade = (i + 1) / faixas
        const verdeAzul = Math.round(255 * (1 - intensidade))

        return {
            from,
            to,
            color: `rgb(255, ${verdeAzul}, ${verdeAzul})`,
            name: `${from} - ${to}`
        }
    })
}