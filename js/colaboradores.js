// Ferramentas e materiais em mãos de funcionários e parceiros.
// Tabela `colaboradores` (uma linha por cadastro de clientes com usuário). Cada linha guarda as
// requisições; cada requisição, as etapas (status da tabela `correcoes`) e os documentos anexados.
// O servidor junta cadastro, composições, nomes de status e o Kit Técnico na hora (gcs/SCRIPTS/colaboradores.js).
//
// Fluxo linear, tudo no próprio item da lista:
//   1. Nova requisição -> nasce em REQUISIÇÃO (setor Logística).
//   2. Status: cxOpcoes no item; cada troca vira uma etapa no histórico.
//   3. Documento: gera o recibo para assinar. Anexar: guarda o arquivo e muda para SOLUCIONADA.
//   Só requisição solucionada entra no saldo da pessoa.
// Devolução é avulsa: registrada pela pessoa (aba Por pessoa) e já entra no saldo.
// Material usado em requisição padrão com origem "Kit Técnico" é abatido do saldo do recebedor (servidor).
//
// aba: 'requisicoes' (lista linear), 'pessoas' (relatório por pessoa) ou 'itens' (relatório por item).
// pessoa: ficha aberta na aba Por pessoa. aberta: id da requisição com os detalhes à mostra.
const estadoColaboradores = {
    aba: 'requisicoes', situacao: 'abertas', filtroStatus: 'TODOS', busca: '',
    requisicoes: [], aberta: null, lista: [], pessoa: null,
    relatorio: { dados: null, aba: 'ferramentas' }, requisicao: null, statusEscolha: null, termo: null
}

// Status com que a requisição nasce, o mesmo das requisições de chamados (js/requisicao.js).
const etapaInicialColaborador = { tipoCorrecao: '4Zmd3', setor: ['LOGÍSTICA'] }

async function chamarColaboradores(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/colaboradores/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok)
        throw new Error(dados.mensagem || `Falha (${resposta.status})`)
    return dados
}

function avatarColaborador({ nome, foto }, classe = '') {
    if (foto)
        return `<img class="colab-avatar moldura-foto ${classe}" src="${urlFotoCliente(foto)}" alt="" onerror="this.onerror = null; this.src = logo">`

    const iniciais = String(nome || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0])
        .join('')
        .toUpperCase()

    return `<span class="colab-avatar colab-iniciais moldura-foto ${classe}">${escaparAtributo(iniciais)}</span>`
}

// Cidade do cadastro às vezes já vem com a UF ("SALVADOR (BA)"): não repete o estado.
function localColaborador({ cidade, estado }) {
    if (!cidade) return estado || ''
    if (!estado || String(cidade).toUpperCase().includes(String(estado).toUpperCase())) return cidade
    return `${cidade} / ${estado}`
}

const numeroColab = valor => Number(valor || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const numeroFinitoColab = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0
const movimentoColab = movimento => movimento == 'DEVOLUÇÃO'
    ? '<span class="colab-chip devolucao">Devolução</span>'
    : '<span class="colab-chip saida">Saída</span>'
const podeGerenciarColab = usuario => usuario == acesso.usuario || autE.includes(acesso.permissao)
const carregandoColab = '<div class="colab-vazio"><img src="gifs/loading-gcs.png" alt=""></div>'
const iconeVoltarColab = `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path d="M19 12H5M11 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`

function classeStatusColab(r) {
    if (r.concluida) return 'ok'
    if (r.cancelada) return 'cancelada'
    return 'aberta'
}

// ---------------- Tela ----------------

async function telaColaboradores(aba = estadoColaboradores.aba) {

    if (['cliente', 'técnico'].includes(acesso?.permissao))
        return popup({ mensagem: 'Acesso restrito à equipe interna.' })

    tela.innerHTML = `
        <div class="tela-colaboradores">
            <div class="colab-cabecalho">
                <div>
                    <h2>Ferramentas e materiais</h2>
                    <small>Requisição → status → documento anexado (solucionada). Só o que foi solucionado entra no saldo.</small>
                </div>
                <div class="colab-controles">
                    <div class="colab-segmento colab-nav" role="tablist" aria-label="Visão">
                        ${[['requisicoes', 'Requisições'], ['pessoas', 'Por pessoa'], ['itens', 'Por item']].map(([chave, texto]) => `
                            <button type="button" role="tab" data-aba="${chave}" onclick="trocarAbaColaboradores('${chave}')">${texto}</button>
                        `).join('')}
                    </div>
                    <input type="search" placeholder="Buscar pessoa, item ou status" value="${escaparAtributo(estadoColaboradores.busca)}"
                        oninput="estadoColaboradores.busca = this.value; renderizarColaboradores()">
                    <button type="button" onclick="formularioRequisicaoColaborador()">Nova requisição</button>
                </div>
            </div>
            <div class="colab-conteudo">${carregandoColab}</div>
        </div>
    `

    await trocarAbaColaboradores(aba)
}

async function trocarAbaColaboradores(aba) {
    estadoColaboradores.aba = aba
    estadoColaboradores.pessoa = null
    document.querySelectorAll('.colab-nav [data-aba]')
        .forEach(b => b.classList.toggle('ativo', b.dataset.aba == aba))

    const local = document.querySelector('.colab-conteudo')
    if (local) local.innerHTML = carregandoColab
    await carregarColaboradores()
}

// Busca os dados da visão atual e desenha. Também chamado pelo websocket e depois de cada gravação.
async function carregarColaboradores() {
    const { aba, pessoa, situacao } = estadoColaboradores
    try {
        if (aba == 'requisicoes') {
            const { requisicoes = [] } = await chamarColaboradores('andamento', { situacao })
            estadoColaboradores.requisicoes = requisicoes
        } else if (aba == 'pessoas' && pessoa?.id) {
            estadoColaboradores.pessoa = { id: pessoa.id, ...await chamarColaboradores('detalhe', { id: pessoa.id }) }
        } else if (aba == 'pessoas') {
            const { colaboradores = [] } = await chamarColaboradores('lista')
            estadoColaboradores.lista = colaboradores
        } else {
            estadoColaboradores.relatorio.dados = await chamarColaboradores('relatorio')
        }
        renderizarColaboradores()
    } catch (erro) {
        const local = document.querySelector('.colab-conteudo')
        if (local) local.innerHTML = `<div class="colab-vazio">${escaparAtributo(erro.message)}</div>`
    }
}

function renderizarColaboradores() {
    const { aba, pessoa } = estadoColaboradores
    if (aba == 'requisicoes') return renderizarRequisicoesColab()
    if (aba == 'pessoas') return pessoa?.colaborador ? renderizarPessoaColab() : renderizarPessoasColab()
    return renderizarRelatorioColaboradores()
}

// Websocket (tabela colaboradores).
async function atualizarColaboradoresWS() {
    if (document.querySelector('.tela-colaboradores'))
        await carregarColaboradores()
}

// Atalhos de status do menu lateral: lista de requisições com aquele status.
async function filtrarStatusColaboradores(nome) {
    estadoColaboradores.filtroStatus = nome || 'TODOS'
    estadoColaboradores.situacao = 'todas'
    if (!document.querySelector('.tela-colaboradores'))
        return telaColaboradores('requisicoes')
    await trocarAbaColaboradores('requisicoes')
}

// Tela inicial (pendências): abre a pessoa com a requisição aberta.
async function irParaColaborador(id, idRequisicao) {
    estadoColaboradores.aberta = idRequisicao || null
    await telaColaboradores('pessoas')
    await abrirPessoaColab(id)
}

// ---------------- Requisições (lista linear) ----------------

async function trocarSituacaoColab(situacao) {
    estadoColaboradores.situacao = situacao
    const local = document.querySelector('.colab-conteudo')
    if (local) local.innerHTML = carregandoColab
    await carregarColaboradores()
}

function textoBuscaRequisicao(r) {
    return [r.colaborador?.nome, r.colaborador?.usuario, r.status, r.usuario, r.movimento,
        ...r.itens.flatMap(i => [i.codigo, i.descricao])].join(' ').toLowerCase()
}

function renderizarRequisicoesColab() {
    const local = document.querySelector('.colab-conteudo')
    if (!local || estadoColaboradores.aba != 'requisicoes')
        return

    const { situacao, filtroStatus } = estadoColaboradores
    const busca = estadoColaboradores.busca.trim().toLowerCase()
    const todas = estadoColaboradores.requisicoes
    const status = [...new Set(todas.map(r => r.status))].sort()
    const lista = todas
        .filter(r => filtroStatus == 'TODOS' || r.status == filtroStatus)
        .filter(r => !busca || textoBuscaRequisicao(r).includes(busca))

    const vazio = busca || filtroStatus != 'TODOS'
        ? 'Nenhuma requisição com esse filtro.'
        : { abertas: 'Tudo em dia: nenhuma requisição em aberto.', concluidas: 'Nenhuma requisição concluída.', todas: 'Nenhuma requisição ainda.' }[situacao]

    local.innerHTML = `
        <div class="colab-req-barra">
            <div class="colab-segmento" role="group" aria-label="Situação">
                ${[['abertas', 'Em aberto'], ['concluidas', 'Concluídas'], ['todas', 'Todas']].map(([chave, texto]) => `
                    <button type="button" class="${situacao == chave ? 'ativo' : ''}" onclick="trocarSituacaoColab('${chave}')">${texto}</button>
                `).join('')}
            </div>
            <select class="colab-filtro-status" aria-label="Status" onchange="estadoColaboradores.filtroStatus = this.value; renderizarRequisicoesColab()">
                ${['TODOS', ...new Set([...status, filtroStatus])].filter((s, i, a) => s && a.indexOf(s) == i).map(s => `
                    <option value="${escaparAtributo(s)}" ${s == filtroStatus ? 'selected' : ''}>${s == 'TODOS' ? 'Todos os status' : escaparAtributo(s)}</option>
                `).join('')}
            </select>
            <span class="colab-req-total">${lista.length} requisição(ões)</span>
        </div>
        ${lista.length
            ? `<div class="colab-reqs">${lista.map(r => cartaoRequisicaoColab(r, r.colaborador, true)).join('')}</div>`
            : `<div class="colab-vazio">${vazio}</div>`}
    `
}

// Um item da lista. Mesmo desenho na lista geral e na ficha da pessoa (mostrarPessoa = false).
function cartaoRequisicaoColab(r, colaborador = {}, mostrarPessoa = false) {
    const idColab = escaparAtributo(colaborador.id)
    const idReq = escaparAtributo(r.id)
    const aberta = estadoColaboradores.aberta == r.id
    const documentos = r.documentos || []

    const resumoItens = r.itens.slice(0, 4)
        .map(i => `<span class="colab-escolhido">${numeroColab(i.quantidade)} ${escaparAtributo(i.unidade)} · ${escaparAtributo(i.descricao || i.codigo)}</span>`)
        .join('') + (r.itens.length > 4 ? `<small>+${r.itens.length - 4} item(ns)</small>` : '')

    const anexos = documentos.map(d => criarAnexoVisual(d.nome, d.link,
        podeGerenciarColab(d.usuario) ? `removerDocumentoColab('${idColab}', '${idReq}', '${escaparAtributo(d.id)}')` : false)).join('')

    return `
        <article class="colab-req ${classeStatusColab(r)} ${aberta ? 'aberta' : ''}">
            <div class="colab-req-principal">
                ${mostrarPessoa ? `
                    <button type="button" class="colab-req-pessoa" onclick="abrirPessoaColab('${idColab}')" title="Ver tudo desta pessoa">
                        ${avatarColaborador(colaborador)}
                        <span>
                            <b>${escaparAtributo(colaborador.nome || 'Sem cadastro')}</b>
                            <small>${escaparAtributo(colaborador.usuario || '')}</small>
                        </span>
                    </button>` : ''}
                <div class="colab-req-info">
                    <div>${movimentoColab(r.movimento)}<small>${escaparAtributo(r.data)} · ${escaparAtributo(r.usuario)} · ${r.itens.length} item(ns) · ${dinheiro(r.total)}</small></div>
                    <div class="colab-escolhidos-lista">${resumoItens}</div>
                    ${r.comentario ? `<small class="colab-comentario">${escaparAtributo(r.comentario)}</small>` : ''}
                </div>
                <div class="colab-req-acoes">
                    <span class="opcoes colab-req-status ${classeStatusColab(r)}" name="statusColab_${idReq}" title="Alterar status"
                        onclick="escolherStatusColab('${idColab}', '${idReq}')">${escaparAtributo(r.status)}</span>
                    <button type="button" class="secundario" onclick="gerarDocumentoColab('${idColab}', '${idReq}')">Documento</button>
                    <label class="colab-anexar" title="Anexar o documento assinado: a requisição passa para solucionada">
                        Anexar
                        <input type="file" multiple hidden accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                            onchange="anexarDocumentoColab(this, '${idColab}', '${idReq}')">
                    </label>
                    <button type="button" class="colab-req-mais ${aberta ? 'ativo' : ''}" title="${aberta ? 'Ocultar detalhes' : 'Itens e histórico'}"
                        aria-expanded="${aberta}" onclick="alternarRequisicaoColab('${idReq}')">${aberta ? '▴' : '▾'}</button>
                </div>
            </div>
            ${anexos ? `<div class="colab-req-docs">${anexos}</div>` : ''}
            ${aberta ? detalheRequisicaoColab(r, colaborador) : ''}
        </article>
    `
}

function alternarRequisicaoColab(idReq) {
    estadoColaboradores.aberta = estadoColaboradores.aberta == idReq ? null : idReq
    renderizarColaboradores()
}

function detalheRequisicaoColab(r, colaborador) {
    const idColab = escaparAtributo(colaborador.id)
    const idReq = escaparAtributo(r.id)

    const itens = r.itens.map(i => `
        <tr>
            <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
            <td>${escaparAtributo(i.codigo)}</td>
            <td>${escaparAtributo(i.descricao || '')}</td>
            <td>${i.classe == 'FERRAMENTA' ? 'Ferramenta' : 'Material'}</td>
            <td class="num">${numeroColab(i.quantidade)} ${escaparAtributo(i.unidade)}</td>
            <td class="num">${dinheiro(i.custo)}</td>
            <td class="num">${dinheiro(i.quantidade * i.custo)}</td>
        </tr>
    `).join('')

    // A etapa mais recente pode ser desfeita (status escolhido por engano).
    const etapas = r.etapas.map((e, indice) => `
        <li>
            <span class="colab-req-etapa-status">${escaparAtributo(e.nome)}</span>
            <small>${escaparAtributo(e.data)} · ${escaparAtributo(e.usuario)}</small>
            ${e.descricao ? `<small>${escaparAtributo(e.descricao)}</small>` : ''}
            ${indice == 0 && r.etapas.length > 1 && podeGerenciarColab(e.usuario)
                ? `<button type="button" class="secundario" onclick="desfazerEtapaColab('${idColab}', '${idReq}', '${escaparAtributo(e.id)}')">Desfazer</button>`
                : ''}
        </li>
    `).join('')

    return `
        <div class="colab-req-detalhe">
            <div class="colab-tabela-rolagem">
                <table class="colab-tabela">
                    <thead><tr><th></th><th>Código</th><th>Descrição</th><th>Tipo</th><th class="num">Qtde</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
                    <tbody>${itens}</tbody>
                    <tfoot><tr><td colspan="6" class="num"><b>Total</b></td><td class="num"><b>${dinheiro(r.total)}</b></td></tr></tfoot>
                </table>
            </div>
            <div class="colab-req-historico">
                <b>Histórico</b>
                <ol>${etapas || '<li><small>Sem histórico.</small></li>'}</ol>
                <div class="colab-movimento-acoes">
                    ${podeEditarRequisicaoColaborador(r) ? `<button type="button" class="secundario" onclick="formularioRequisicaoColaborador({ colaborador: '${idColab}', idRequisicao: '${idReq}' })">Editar itens</button>` : ''}
                    ${!r.concluida && podeGerenciarColab(r.usuario) ? `<button type="button" class="perigo" onclick="confirmarExcluirRequisicaoColaborador('${idColab}', '${idReq}')">Excluir requisição</button>` : ''}
                </div>
            </div>
        </div>
    `
}

// Requisição carregada na tela (lista geral ou ficha da pessoa), com o cadastro de quem recebe.
function buscarRequisicaoColab(idColab, idReq) {
    const geral = estadoColaboradores.requisicoes.find(r => r.id == idReq && r.colaborador?.id == idColab)
    if (geral) return { requisicao: geral, colaborador: geral.colaborador }

    const { pessoa } = estadoColaboradores
    const propria = pessoa?.id == idColab ? pessoa.requisicoes?.find(r => r.id == idReq) : null
    return propria ? { requisicao: propria, colaborador: { id: idColab, ...pessoa.colaborador } } : {}
}

async function gravarEtapaColab(idColab, idReq, { tipoCorrecao, descricao, setor }) {
    const agora = dataServidor()
    const resultado = await enviar(`colaboradores/${idColab}/requisicoes/${idReq}/etapas/${crypto.randomUUID()}`, {
        tipoCorrecao,
        setor: setor?.length ? setor : etapaInicialColaborador.setor,
        executor: [],
        descricao,
        usuario: acesso.usuario,
        data: agora.toLocaleString(),
        ts: agora.getTime()
    })
    if (!resultado?.success)
        throw new Error(resultado?.mensagem || 'Falha ao salvar o status: Fale com o suporte.')
}

let idSolucionadaColab = null
async function statusSolucionadaColab() {
    if (idSolucionadaColab)
        return idSolucionadaColab

    const pesquisa = await pesquisarDB({ base: 'correcoes', filtros: { nome: { op: '=', value: 'SOLUCIONADA' } }, limite: 1 })
    idSolucionadaColab = pesquisa?.resultados?.[0]?.id || null
    if (!idSolucionadaColab)
        throw new Error('Status SOLUCIONADA não encontrado em correções.')
    return idSolucionadaColab
}

// Status: cxOpcoes da tabela correcoes no próprio item. Um controle por requisição, porque o
// selecionar (js/ferramentas.js) escreve no elemento com o mesmo name.
function escolherStatusColab(idColab, idReq) {
    const name = `statusColab_${idReq}`
    estadoColaboradores.statusEscolha = { idColab, idReq, name }
    controlesCxOpcoes[name] = {
        base: 'correcoes',
        retornar: ['nome'],
        funcaoAdicional: 'salvarStatusEscolhidoColab',
        colunas: { 'Status': { chave: 'nome' } }
    }
    cxOpcoes(name)
}

async function salvarStatusEscolhidoColab() {
    const { idColab, idReq, name } = estadoColaboradores.statusEscolha || {}
    const tipoCorrecao = document.querySelector(`[name="${name}"]`)?.id
    const { requisicao } = buscarRequisicaoColab(idColab, idReq)
    delete controlesCxOpcoes[name]
    if (!requisicao || !tipoCorrecao)
        return removerOverlay()

    if (requisicao.etapas[0]?.tipoCorrecao == tipoCorrecao) {
        removerOverlay()
        return renderizarColaboradores()
    }

    try {
        await gravarEtapaColab(idColab, idReq, { tipoCorrecao, setor: requisicao.etapas[0]?.setor, descricao: 'Status alterado na lista.' })
        removerOverlay()
        await carregarColaboradores()
    } catch (erro) {
        popup({ mensagem: erro.message })
    }
}

// Anexar: guarda os arquivos na requisição e, se ainda não estava, muda para SOLUCIONADA.
async function anexarDocumentoColab(input, idColab, idReq) {
    if (!input?.files?.length)
        return

    const nomes = [...input.files].map(f => f.name)
    overlayAguarde()

    try {
        const { requisicao } = buscarRequisicaoColab(idColab, idReq)
        if (!requisicao)
            throw new Error('Requisição não encontrada. Atualize a tela.')

        const arquivos = await importarAnexos({ input })
        if (!Array.isArray(arquivos) || !arquivos.length || arquivos.some(a => !a?.link))
            throw new Error('Falha no envio do arquivo.')

        const agora = dataServidor()
        for (const [indice, arquivo] of arquivos.entries()) {
            const resultado = await enviar(`colaboradores/${idColab}/requisicoes/${idReq}/documentos/${crypto.randomUUID()}`, {
                nome: arquivo.nome || nomes[indice] || arquivo.link,
                link: arquivo.link,
                data: agora.toLocaleString(),
                ts: agora.getTime(),
                usuario: acesso.usuario
            })
            if (!resultado?.success)
                throw new Error(resultado?.mensagem || 'Falha ao salvar o documento.')
        }

        if (!requisicao.concluida)
            await gravarEtapaColab(idColab, idReq, {
                tipoCorrecao: await statusSolucionadaColab(),
                setor: requisicao.etapas[0]?.setor,
                descricao: `Documento anexado: ${nomes.join(', ')}`
            })

        removerOverlay()
        await carregarColaboradores()
    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao anexar: Fale com o suporte.' })
    } finally {
        input.value = ''
    }
}

async function removerDocumentoColab(idColab, idReq, idDoc) {
    if (!await confirmarPopup({ mensagem: 'Remover este documento? O status da requisição não muda.', textoConfirmar: 'Remover' }))
        return

    overlayAguarde()
    const resultado = await deletar(`colaboradores/${idColab}/requisicoes/${idReq}/documentos/${idDoc}`)
    if (!resultado)
        return
    removerOverlay()
    await carregarColaboradores()
}

async function desfazerEtapaColab(idColab, idReq, idEtapa) {
    if (!await confirmarPopup({ mensagem: 'Desfazer o último status? A requisição volta ao status anterior.', textoConfirmar: 'Desfazer' }))
        return

    overlayAguarde()
    const resultado = await deletar(`colaboradores/${idColab}/requisicoes/${idReq}/etapas/${idEtapa}`)
    if (!resultado)
        return
    removerOverlay()
    await carregarColaboradores()
}

async function confirmarExcluirRequisicaoColaborador(idColab, idReq) {
    if (!await confirmarPopup({ mensagem: 'Excluir esta requisição e todo o histórico dela?', textoConfirmar: 'Excluir' }))
        return

    overlayAguarde()
    const resultado = await deletar(`colaboradores/${idColab}/requisicoes/${idReq}`)
    if (!resultado)
        return
    removerOverlay()
    if (estadoColaboradores.aberta == idReq)
        estadoColaboradores.aberta = null
    await carregarColaboradores()
}

// ---------------- Por pessoa ----------------

function renderizarPessoasColab() {
    const local = document.querySelector('.colab-conteudo')
    if (!local || estadoColaboradores.aba != 'pessoas' || estadoColaboradores.pessoa)
        return

    const busca = estadoColaboradores.busca.trim().toLowerCase()
    const lista = estadoColaboradores.lista
        .filter(c => !busca || `${c.nome || ''} ${c.usuario || ''} ${c.cidade || ''}`.toLowerCase().includes(busca))
    const soma = campo => lista.reduce((s, c) => s + Number(c[campo] || 0), 0)

    const linhas = lista.map(c => `
        <button type="button" class="colab-linha" onclick="abrirPessoaColab('${escaparAtributo(c.id)}')">
            <div class="colab-linha-pessoa">
                ${avatarColaborador(c)}
                <div>
                    <b title="${escaparAtributo(c.nome || '')}">${escaparAtributo(c.nome || 'Sem cadastro')}</b>
                    <small>${escaparAtributo([c.usuario, localColaborador(c)].filter(Boolean).join(' · '))}</small>
                </div>
            </div>
            <div class="colab-linha-status">
                <div class="colab-linha-avisos">
                    ${c.termo == 'DESATUALIZADO' ? '<span class="colab-pendente">Termo desatualizado</span>' : ''}
                    ${c.termo == 'PENDENTE' ? '<span class="colab-pendente falta">Sem termo assinado</span>' : ''}
                    ${c.termo == 'EM DIA' ? '<small>Termo em dia</small>' : ''}
                </div>
            </div>
            <div class="colab-linha-num" data-rotulo="Ferramentas em mãos">
                <b>${numeroColab(c.unidadesFerramentas)}</b><small>${dinheiro(c.valorEmMaos)}</small>
            </div>
            <div class="colab-linha-num" data-rotulo="Materiais em saldo">
                <b>${c.materiais || 0}</b><small>${dinheiro(c.valorMateriais)}</small>
            </div>
            <div class="colab-linha-num" data-rotulo="Requisições em aberto">
                <b class="${c.emAndamento ? 'alerta' : ''}">${c.emAndamento || 0}</b><small>de ${c.requisicoes}</small>
            </div>
            <span class="colab-linha-seta" aria-hidden="true">›</span>
        </button>
    `).join('')

    local.innerHTML = `
        <div class="colab-cards">
            <div class="colab-card"><span>Pessoas</span><b>${lista.length}</b></div>
            <div class="colab-card"><span>Ferramentas em mãos</span><b>${dinheiro(soma('valorEmMaos'))}</b><small>${numeroColab(soma('unidadesFerramentas'))} unidade(s)</small></div>
            <div class="colab-card"><span>Materiais em saldo</span><b>${dinheiro(soma('valorMateriais'))}</b><small>entregue − devolvido − Kit Técnico</small></div>
        </div>
        ${lista.length ? `
            <div class="colab-lista">
                <div class="colab-lista-cabecalho" aria-hidden="true">
                    <span>Pessoa</span><span>Termo</span>
                    <span class="num">Ferramentas em mãos</span><span class="num">Materiais em saldo</span><span class="num">Em aberto</span><span></span>
                </div>
                ${linhas}
            </div>`
        : `<div class="colab-vazio">${estadoColaboradores.lista.length ? 'Ninguém com essa busca.' : 'Nenhuma requisição ainda.'}</div>`}
    `
}

async function abrirPessoaColab(id) {
    estadoColaboradores.aba = 'pessoas'
    estadoColaboradores.pessoa = { id }
    document.querySelectorAll('.colab-nav [data-aba]')
        .forEach(b => b.classList.toggle('ativo', b.dataset.aba == 'pessoas'))
    const local = document.querySelector('.colab-conteudo')
    if (local) local.innerHTML = carregandoColab
    await carregarColaboradores()
}
// Nome antigo, ainda usado no relatório por item.
const abrirColaborador = abrirPessoaColab

function voltarPessoasColab() {
    estadoColaboradores.pessoa = null
    estadoColaboradores.aberta = null
    trocarAbaColaboradores('pessoas')
}

function itensPessoaColab(itens = []) {
    return {
        ferramentas: itens.filter(i => i.classe == 'FERRAMENTA' && (i.saldo != 0 || i.entregue > 0)),
        materiais: itens.filter(i => i.classe == 'MATERIAL' && (i.entregue > 0 || i.utilizado > 0))
    }
}

function renderizarPessoaColab() {
    const local = document.querySelector('.colab-conteudo')
    const { id, colaborador = {}, itens = [], requisicoes = [], termo = {} } = estadoColaboradores.pessoa || {}
    if (!local || !id)
        return

    const { ferramentas, materiais } = itensPessoaColab(itens)
    const emMaos = ferramentas.filter(i => i.saldo > 0)
    const podeDevolver = itens.some(i => (i.disponivel ?? i.saldo) > 0)
    const kit = itens.reduce((s, i) => s + (i.utilizado || 0) * i.custo, 0)
    const abertas = requisicoes.filter(r => !r.concluida && !r.cancelada)

    local.innerHTML = `
        <div class="colab-painel">
            <div class="colab-painel-topo">
                <button type="button" class="colab-voltar" onclick="voltarPessoasColab()" title="Voltar para a lista de pessoas">${iconeVoltarColab}<span>Voltar</span></button>
                <div class="colab-identificacao">
                    ${avatarColaborador(colaborador, 'grande')}
                    <div>
                        <h3>${escaparAtributo(colaborador.nome || 'Sem cadastro')}</h3>
                        <small>${escaparAtributo([colaborador.usuario, colaborador.setor, localColaborador(colaborador)].filter(Boolean).join(' · '))}</small>
                    </div>
                </div>
                <div class="colab-acoes">
                    <button type="button" onclick="formularioRequisicaoColaborador({ colaborador: '${escaparAtributo(id)}' })">Nova requisição</button>
                    <button type="button" class="secundario" onclick="formularioDevolucaoColab('${escaparAtributo(id)}')" ${podeDevolver ? '' : 'disabled title="Nada em mãos para devolver"'}>Devolver itens</button>
                    <button type="button" class="secundario" onclick="pdfRelatorioPessoaColab()">Relatório PDF</button>
                </div>
            </div>

            <div class="colab-cards">
                <div class="colab-card"><span>Ferramentas em mãos</span><b>${numeroColab(colaborador.unidadesFerramentas)}</b><small>${dinheiro(colaborador.valorEmMaos)} · a recuperar na saída</small></div>
                <div class="colab-card"><span>Materiais em saldo</span><b>${dinheiro(colaborador.valorMateriais)}</b><small>${colaborador.materiais || 0} item(ns)</small></div>
                <div class="colab-card"><span>Usado em Kit Técnico</span><b>${dinheiro(kit)}</b><small>abatido pelas requisições de chamados</small></div>
                <div class="colab-card ${abertas.length ? 'alerta' : ''}"><span>Requisições em aberto</span><b>${abertas.length}</b><small>entram no saldo quando solucionadas</small></div>
            </div>

            ${blocoTermoColaborador(termo, emMaos.length)}

            <section class="colab-secao">
                <h4>Ferramentas <span class="colab-contador ${emMaos.length ? '' : 'zerado'}">${emMaos.length}</span></h4>
                ${tabelaItensColaborador(ferramentas, true)}
            </section>

            <section class="colab-secao">
                <h4>Materiais <span class="colab-contador ${materiais.length ? '' : 'zerado'}">${materiais.length}</span></h4>
                ${tabelaItensColaborador(materiais, false)}
            </section>

            <section class="colab-secao">
                <h4>Requisições <span class="colab-contador ${abertas.length ? 'alerta' : 'zerado'}" title="Em aberto">${abertas.length}</span></h4>
                ${requisicoes.length
                    ? `<div class="colab-reqs">${requisicoes.map(r => cartaoRequisicaoColab(r, { id, ...colaborador })).join('')}</div>`
                    : '<div class="colab-vazio">Nenhuma requisição.</div>'}
            </section>
        </div>
    `
}

// Saldo = entregue − devolvido − utilizado em Kit Técnico. Botão Devolver: devolução avulsa daquele item.
function tabelaItensColaborador(itens, ferramenta) {
    if (!itens.length)
        return `<div class="colab-vazio">${ferramenta ? 'Nenhuma ferramenta entregue.' : 'Nenhum material entregue.'}</div>`

    const idPessoa = escaparAtributo(estadoColaboradores.pessoa?.id || '')

    return `
        <div class="colab-tabela-rolagem">
            <table class="colab-tabela">
                <thead>
                    <tr>
                        <th></th><th>Código</th><th>Descrição</th><th>Un.</th>
                        <th class="num">Entregue</th><th class="num">Devolvido</th>
                        <th class="num">Kit Técnico</th>
                        <th class="num">${ferramenta ? 'Em mãos' : 'Saldo'}</th>
                        <th class="num">Valor unit.</th><th class="num">Valor do saldo</th><th></th>
                    </tr>
                </thead>
                <tbody>
                    ${itens.map(i => {
                        const disponivel = i.disponivel ?? i.saldo
                        return `
                        <tr>
                            <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
                            <td>${escaparAtributo(i.codigo)}</td>
                            <td>${escaparAtributo(i.descricao)}</td>
                            <td>${escaparAtributo(i.unidade)}</td>
                            <td class="num">${numeroColab(i.entregue)}</td>
                            <td class="num">${i.devolvido ? numeroColab(i.devolvido) : '—'}</td>
                            <td class="num">${i.utilizado ? numeroColab(i.utilizado) : '—'}</td>
                            <td class="num ${i.saldo < 0 ? 'colab-negativo' : ''}" ${i.saldo < 0 ? 'title="Usou mais do que recebeu"' : ''}><b>${numeroColab(i.saldo)}</b></td>
                            <td class="num">${dinheiro(i.custo)}</td>
                            <td class="num">${dinheiro(Math.max(0, i.saldo) * i.custo)}</td>
                            <td>${disponivel > 0
                                ? `<button type="button" class="secundario colab-devolver-item" onclick="formularioDevolucaoColab('${idPessoa}', '${escaparAtributo(i.codigo)}')">Devolver</button>`
                                : ''}</td>
                        </tr>`
                    }).join('')}
                </tbody>
            </table>
        </div>
    `
}

// ---------------- Devolução avulsa ----------------

// Lista o que a pessoa tem; vindo do botão de um item, ele já vem preenchido com tudo.
// Salva como DEVOLUÇÃO já solucionada: o saldo baixa na hora.
async function formularioDevolucaoColab(idColab, codigo = null) {
    overlayAguarde()

    let emMaos = []
    try {
        const { itens = [] } = await chamarColaboradores('detalhe', { id: idColab })
        emMaos = itens.filter(i => (i.disponivel ?? i.saldo) > 0)
    } catch (erro) {
        return popup({ mensagem: erro.message })
    }

    if (!emMaos.length)
        return popup({ mensagem: 'Nada em mãos para devolver.' })

    estadoColaboradores.requisicao = {
        colaborador: idColab, movimento: 'DEVOLUÇÃO',
        itens: Object.fromEntries(emMaos.filter(i => i.codigo == codigo)
            .map(i => [i.codigo, { codigo: i.codigo, qtde: i.disponivel ?? i.saldo, custo: i.custo, descricao: i.descricao, unidade: i.unidade }]))
    }

    const linhas = emMaos.map(i => {
        const disponivel = i.disponivel ?? i.saldo
        const valor = estadoColaboradores.requisicao.itens[i.codigo]?.qtde || ''
        return `
            <tr class="${valor ? 'escolhido' : ''}" data-codigo="${escaparAtributo(i.codigo)}" data-custo="${i.custo}" data-descricao="${escaparAtributo(i.descricao)}" data-unidade="${escaparAtributo(i.unidade)}">
                <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
                <td>${escaparAtributo(i.codigo)}</td>
                <td>${escaparAtributo(i.descricao)}</td>
                <td>${i.classe == 'FERRAMENTA' ? 'Ferramenta' : 'Material'}</td>
                <td class="num"><b>${numeroColab(disponivel)}</b> ${escaparAtributo(i.unidade)}</td>
                <td class="num">
                    <div class="colab-devolver">
                        <input class="colab-qtde" type="number" min="0" max="${disponivel}" step="any" placeholder="0" value="${valor}" oninput="qtdeItemColab(this)">
                        <button type="button" class="secundario" onclick="devolverTudoColab(this)">Tudo</button>
                    </div>
                </td>
            </tr>`
    }).join('')

    popup({
        titulo: 'Devolução',
        elemento: `
            <div class="colab-requisicao">
                <div class="colab-devolucao-ajuda">
                    <span>Informe <b>quanto volta</b> de cada item. Pode ser parte da quantidade; o resto continua com a pessoa.</span>
                    <button type="button" class="secundario" onclick="devolverTudoColab()">Devolver tudo</button>
                </div>
                <div id="colabEscolhidos" class="colab-escolhidos"></div>
                <div id="colabItensRequisicao" class="colab-tabela-rolagem">
                    <table class="colab-tabela">
                        <thead><tr><th></th><th>Código</th><th>Descrição</th><th>Tipo</th><th class="num">Com a pessoa</th><th class="num">Devolver</th></tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <label class="colab-requisicao-comentario">Comentário
                    <textarea id="comentarioColab" rows="2" placeholder="Estado dos itens, motivo..."></textarea>
                </label>
            </div>`,
        botoes: [{ texto: 'Registrar devolução', img: 'concluido', funcao: 'salvarDevolucaoColab()' }]
    })

    atualizarEscolhidosColab()
}

async function salvarDevolucaoColab() {
    const { colaborador, itens = {} } = estadoColaboradores.requisicao || {}
    const lista = Object.values(itens)
    if (!colaborador || !lista.length)
        return popup({ mensagem: 'Informe a quantidade de pelo menos um item.' })

    overlayAguarde()
    try {
        // Confere de novo o saldo: outra devolução pode ter sido registrada no meio tempo.
        const { itens: atuais = [] } = await chamarColaboradores('detalhe', { id: colaborador })
        for (const item of lista) {
            const atual = atuais.find(i => i.codigo == item.codigo)
            if (!atual || item.qtde > (atual.disponivel ?? atual.saldo))
                throw new Error(`A quantidade de ${item.descricao || item.codigo} passa do que está com a pessoa. Abra a devolução de novo.`)
        }

        const agora = dataServidor()
        const data = agora.toLocaleString()
        const resultado = await enviar(`colaboradores/${colaborador}/requisicoes/${crypto.randomUUID()}`, {
            movimento: 'DEVOLUÇÃO',
            data,
            ts: agora.getTime(),
            usuario: acesso.usuario,
            comentario: document.getElementById('comentarioColab')?.value.trim() || '',
            itens: Object.fromEntries(lista.map(({ codigo, qtde, custo }) => [codigo, { codigo, qtde, custo }])),
            etapas: {
                [crypto.randomUUID()]: {
                    tipoCorrecao: await statusSolucionadaColab(),
                    setor: etapaInicialColaborador.setor,
                    executor: [],
                    data,
                    ts: agora.getTime(),
                    usuario: acesso.usuario,
                    descricao: `Devolução avulsa recebida por ${acesso.usuario}.`
                }
            }
        })
        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao registrar a devolução.')

        removerPopup()
        await carregarColaboradores()
    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao registrar a devolução: Fale com o suporte.' })
    }
}

// "Tudo" de uma linha (botao) ou de todas (sem botao) preenche o que pode devolver.
function devolverTudoColab(botao = null) {
    const linhas = botao
        ? [botao.closest('tr')]
        : [...document.querySelectorAll('#colabItensRequisicao tbody tr')]

    for (const linha of linhas) {
        const input = linha?.querySelector('.colab-qtde')
        if (!input || input.disabled)
            continue
        input.value = input.max
        qtdeItemColab(input)
    }
}

// ---------------- Relatório por item ----------------

function trocarAbaRelatorioColab(aba) {
    estadoColaboradores.relatorio.aba = aba
    renderizarRelatorioColaboradores()
}

function renderizarRelatorioColaboradores() {
    const local = document.querySelector('.colab-conteudo')
    const { dados, aba } = estadoColaboradores.relatorio
    if (!local || !dados || estadoColaboradores.aba != 'itens')
        return

    const ferramenta = aba == 'ferramentas'
    const { totais = {} } = dados

    // A busca do cabeçalho filtra por item (código/descrição) ou por quem tem o item.
    const busca = estadoColaboradores.busca.trim().toLowerCase()
    const itens = (dados[aba] || [])
        .filter(i => !busca || [i.codigo, i.descricao, i.modelo, i.fabricante, ...i.colaboradores.map(c => c.nome)]
            .join(' ').toLowerCase().includes(busca))

    const total = itens.reduce((s, i) => s + i.valor, 0)

    const resumo = (titulo, t = {}, chave) => `
        <button type="button" class="colab-card colab-card-acao ${aba == chave ? 'selecionado' : ''}" onclick="trocarAbaRelatorioColab('${chave}')">
            <span>${titulo}</span><b>${dinheiro(t.valor)}</b>
            <small>${t.itens || 0} item(ns) · ${numeroColab(t.quantidade)} unidade(s)</small>
        </button>`

    const linhas = itens.map(i => `
        <tr>
            <td><img class="colab-miniatura" src="${i.imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
            <td>${escaparAtributo(i.codigo)}</td>
            <td>
                <div class="colab-relatorio-descricao">
                    <span>${escaparAtributo(i.descricao || '')}</span>
                    ${i.modelo || i.fabricante ? `<small>${escaparAtributo([i.modelo, i.fabricante].filter(Boolean).join(' · '))}</small>` : ''}
                </div>
            </td>
            <td>${escaparAtributo(i.unidade)}</td>
            <td class="num">${numeroColab(i.entregue)}</td>
            <td class="num">${numeroColab(i.devolvido)}</td>
            <td class="num"><b>${numeroColab(i.quantidade)}</b></td>
            <td class="num">${dinheiro(i.valor)}</td>
            <td>
                <div class="colab-relatorio-quem">
                    ${i.colaboradores.map(c => `
                        <button type="button" onclick="abrirPessoaColab('${escaparAtributo(c.id)}')"
                            title="Abrir a pessoa">${escaparAtributo(c.nome || 'Sem cadastro')} · <b>${numeroColab(c.quantidade)}</b></button>
                    `).join('')}
                </div>
            </td>
        </tr>
    `).join('')

    local.innerHTML = `
        <div class="colab-fila colab-relatorio">
            <div class="colab-fila-topo">
                <div>
                    <h3>Por item</h3>
                    <small>Todas as pessoas somadas por item. Conta só requisições solucionadas; valor pelo custo da última saída.</small>
                </div>
            </div>

            <div class="colab-cards">
                ${resumo('Ferramentas em mãos', totais.ferramentas, 'ferramentas')}
                ${resumo('Materiais em saldo', totais.materiais, 'materiais')}
            </div>

            ${itens.length ? `
                <div class="colab-tabela-rolagem">
                    <table class="colab-tabela">
                        <thead>
                            <tr>
                                <th></th><th>Código</th><th>Descrição</th><th>Un.</th>
                                <th class="num">Entregue</th><th class="num">Devolvido</th>
                                <th class="num">${ferramenta ? 'Em mãos' : 'Saldo'}</th>
                                <th class="num">Valor</th>
                                <th>Com quem</th>
                            </tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="7" class="num"><b>Total${busca ? ' (filtrado)' : ''}</b></td>
                                <td class="num"><b>${dinheiro(total)}</b></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>`
            : `<div class="colab-vazio">${busca
                ? 'Nenhum item com essa busca.'
                : ferramenta ? 'Nenhuma ferramenta em mãos.' : 'Nenhum material em saldo.'}</div>`}
        </div>
    `
}

// ---------------- Nova requisição (saída) ----------------

// Requisição só pode ter os itens editados enquanto está no status inicial.
function podeEditarRequisicaoColaborador(r) {
    const etapas = Object.values(r?.etapas || {})
    return !!r && r.movimento != 'DEVOLUÇÃO' && podeGerenciarColab(r.usuario) && !r.concluida && !r.cancelada
        && etapas.length > 0 && etapas.every(e => e.tipoCorrecao == etapaInicialColaborador.tipoCorrecao)
}

// LPUs mostradas nos detalhes da linha da requisição.
const lpusDetalheColab = ['lpu ferramentas', 'lpu hope', 'lpu peças']

const valorLpuColab = (produto, lpu) => {
    const tabela = produto?.[lpu]
    return Number(produto?.snapshots?.[lpu]?.[0] || tabela?.historico?.[tabela?.ativo]?.valor || 0)
}

// Preço da composição: a primeira LPU com valor, começando pela de ferramentas.
function lpuCustoColab(produto) {
    // LPUS começa null (ferramentas.js) e só é carregada por orçamentos/composições.
    const lpus = ['lpu ferramentas', 'lpu peças', 'lpu hope', ...(typeof LPUS !== 'undefined' && Array.isArray(LPUS) ? LPUS : [])]
        .map(l => String(l).toLowerCase())

    return lpus.find(lpu => valorLpuColab(produto, lpu) > 0) || null
}

function custoComposicaoColab(produto) {
    const lpu = lpuCustoColab(produto)
    return lpu ? valorLpuColab(produto, lpu) : 0
}

// colaborador: id em clientes (aberto pela pessoa) ou vazio para escolher na hora.
// idRequisicao: edição dos itens de uma requisição ainda no status inicial.
async function formularioRequisicaoColaborador({ colaborador = null, idRequisicao = null } = {}) {

    let existente
    if (idRequisicao) {
        existente = buscarRequisicaoColab(colaborador, idRequisicao).requisicao
        if (!podeEditarRequisicaoColaborador(existente))
            return popup({ mensagem: 'Só é possível editar requisições ainda no status inicial, pelo autor ou gestores.' })
    }

    overlayAguarde()

    estadoColaboradores.requisicao = {
        colaborador, movimento: 'SAÍDA', idRequisicao,
        itens: Object.fromEntries((existente?.itens || []).map(i => [i.codigo, {
            ...i, qtde: numeroFinitoColab(i.qtde ?? i.quantidade), custo: numeroFinitoColab(i.custo)
        }]))
    }

    const { nome } = colaborador ? await recuperarDado('clientes', colaborador) || {} : {}

    // Filtro oculto: só cadastros com usuário (funcionários e parceiros com acesso).
    controlesCxOpcoes.colaboradorRequisicao = {
        base: 'clientes',
        filtros: { usuario: { op: 'NOT_EMPTY' } },
        retornar: ['nome'],
        funcaoAdicional: 'trocarColaboradorRequisicao',
        colunas: {
            'Nome': { chave: 'nome' },
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' },
            'Cidade': { chave: 'cidade' }
        }
    }

    const campoColaborador = colaborador
        ? `<span>${escaparAtributo(nome || colaborador)}</span>`
        : `<span class="opcoes" name="colaboradorRequisicao" onclick="cxOpcoes('colaboradorRequisicao')">Selecione</span>`

    popup({
        elemento: `
            <div class="colab-requisicao">
                <div class="colab-requisicao-campos">
                    <label>Para quem ${campoColaborador}</label>
                    <label class="colab-requisicao-comentario">Comentário
                        <textarea id="comentarioColab" rows="2">${escaparAtributo(existente?.comentario || '')}</textarea>
                    </label>
                </div>
                <div id="colabEscolhidos" class="colab-escolhidos"></div>
                <div id="colabItensRequisicao"></div>
            </div>
        `,
        titulo: idRequisicao ? 'Editar itens da requisição' : 'Nova requisição de ferramentas e materiais',
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarRequisicaoColaborador()' }],
        autoDestruicao: ['colaboradorRequisicao', 'reqColab']
    })

    await renderizarItensRequisicaoColab()
    removerOverlay()
}

function trocarColaboradorRequisicao() {
    const id = document.querySelector('[name="colaboradorRequisicao"]')?.id
    if (id && estadoColaboradores.requisicao)
        estadoColaboradores.requisicao.colaborador = id
}

// Base de composições inteira, com pesquisa.
async function renderizarItensRequisicaoColab() {
    const local = document.getElementById('colabItensRequisicao')
    if (!local)
        return

    atualizarEscolhidosColab()

    // A pesquisa da tabela anterior não deve vazar para a nova requisição.
    delete controles.reqColab

    // Mesmo atalho do orçamento: cadastra a composição sem sair da requisição.
    const criarItem = permComposicoes.includes(acesso.permissao)
        ? `<button type="button" class="colab-criar-item" onclick="cadastrarItem()">
                <img src="imagens/baixar.png" alt="">Criar item
            </button>`
        : ''

    local.innerHTML = await modTab({
        base: 'dados_composicoes',
        pag: 'reqColab',
        body: 'bodyReqColab',
        btnExtras: criarItem,
        detalhes: true,
        // 60dvh é o teto da altura mínima em css/tabelas.css; com espaço sobrando no popup, cresce mais.
        alturaMinima: '60dvh',
        criarLinha: 'linhaComposicaoColab',
        colunas: {
            'Imagem': {},
            'Código': { chave: 'id' },
            'Descrição': { chave: 'descricao' },
            'Sistema': { chave: 'sistema', tipoPesquisa: 'select' },
            'Unidade': { chave: 'unidade' },
            'Valor': {},
            'Quantidade': {}
        }
    })

    await paginacao('reqColab')
}

function linhaComposicaoColab(produto) {
    const { descricao, sistema, unidade, imagem, modelo, fabricante } = produto || {}
    const codigo = String(produto?.id ?? produto?.codigo ?? '')
    const custo = custoComposicaoColab(produto)
    const qtde = estadoColaboradores.requisicao?.itens?.[codigo]?.qtde || ''
    const detalhes = [modelo, fabricante].filter(Boolean).join(' · ')

    // Detalhes (+): preço em cada LPU, no mesmo bloco de "Preços por tabela" de composições
    // (css/composicoes.css).
    const precos = `
        <div class="composicao-detalhes colab-detalhes-precos">
            <section class="composicao-bloco composicao-bloco-precos">
                <div class="composicao-bloco-topo"><h3>Preços por tabela</h3></div>
                <div class="composicao-tabela-contorno"><table class="composicao-tabela">
                    <thead><tr>${lpusDetalheColab.map(lpu => `<th>${lpu.toUpperCase()}</th>`).join('')}</tr></thead>
                    <tbody><tr>${lpusDetalheColab.map(lpu => {
                        const valor = valorLpuColab(produto, lpu)
                        return `
                            <td class="composicao-numero">
                                ${usuariosPermitidosParaEditar.includes(acesso.permissao)
                                    ? `<button type="button" class="composicao-preco ${valor > 0 ? '' : 'sem-valor'}" title="Ver histórico de preços"
                                        onclick="abrirHistoricoPrecosSobre('${escaparAtributo(codigo)}', '${lpu}')">${dinheiro(valor)}</button>`
                                    : `<span class="composicao-preco ${valor > 0 ? '' : 'sem-valor'}">${dinheiro(valor)}</span>`}
                            </td>`
                    }).join('')}</tr></tbody>
                </table></div>
            </section>
        </div>`

    const linha = `
        <tr class="${qtde ? 'escolhido' : ''}" data-codigo="${escaparAtributo(codigo)}" data-custo="${custo}" data-descricao="${escaparAtributo(descricao)}" data-unidade="${escaparAtributo(unidade)}">
            <td><img class="colab-miniatura" src="${imagem || logo}" alt="" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = logo"></td>
            <td>${escaparAtributo(codigo)}</td>
            <td style="text-align: left;">
                <div style="${vertical}; gap: 2px;">
                    <span>${escaparAtributo(descricao)}</span>
                    ${detalhes ? `<small>${escaparAtributo(detalhes)}</small>` : ''}
                </div>
            </td>
            <td>${sistema == 'FERRAMENTAS' ? '<span class="colab-chip">FERRAMENTA</span>' : escaparAtributo(sistema)}</td>
            <td>${escaparAtributo(unidade)}</td>
            <td style="white-space: nowrap;">${dinheiro(custo)}</td>
            <td><input class="colab-qtde" type="number" min="0" step="any" value="${qtde}" oninput="qtdeItemColab(this)"></td>
        </tr>
    `

    return { linha, detalhes: precos }
}

function qtdeItemColab(input) {
    const estado = estadoColaboradores.requisicao
    const linha = input.closest('tr')
    if (!estado || !linha)
        return

    const maximo = Number(input.max)
    if (input.max !== '' && Number(input.value) > maximo)
        input.value = maximo

    const { codigo, custo, descricao, unidade } = linha.dataset
    const qtde = Number(input.value || 0)

    if (qtde > 0)
        estado.itens[codigo] = { codigo, qtde, custo: Number(custo) || 0, descricao, unidade }
    else
        delete estado.itens[codigo]

    linha.classList?.toggle('escolhido', qtde > 0)
    atualizarEscolhidosColab()
}

function removerItemColab(codigo) {
    const estado = estadoColaboradores.requisicao
    if (!estado)
        return

    delete estado.itens[codigo]
    const linha = document.querySelector(`#colabItensRequisicao tr[data-codigo="${CSS.escape(codigo)}"]`)
    const input = linha?.querySelector('.colab-qtde')
    if (input) input.value = ''
    linha?.classList.remove('escolhido')
    atualizarEscolhidosColab()
}

// Resumo do que já foi escolhido: a pesquisa troca as linhas da tabela, a escolha fica.
function atualizarEscolhidosColab() {
    const local = document.getElementById('colabEscolhidos')
    const itens = Object.values(estadoColaboradores.requisicao?.itens || {})
    if (!local)
        return

    const total = itens.reduce((s, i) => s + numeroFinitoColab(
        numeroFinitoColab(i.qtde ?? i.quantidade) * numeroFinitoColab(i.custo)), 0)
    const quantidadeTotal = itens.reduce((s, i) => s + numeroFinitoColab(i.qtde ?? i.quantidade), 0)

    local.innerHTML = itens.length
        ? `
            <div class="colab-escolhidos-topo">
                <b>Quantidade total: ${numeroColab(quantidadeTotal)}</b>
                <span>Total ${dinheiro(total)}</span>
            </div>
            <div class="colab-escolhidos-lista">
                ${itens.map(i => `
                    <span class="colab-escolhido">
                        ${numeroColab(numeroFinitoColab(i.qtde ?? i.quantidade))} ${escaparAtributo(i.unidade || 'UN')} · ${escaparAtributo(i.descricao || i.codigo)}
                        <button type="button" title="Remover" onclick="removerItemColab('${escaparAtributo(i.codigo)}')">&times;</button>
                    </span>
                `).join('')}
            </div>`
        : '<small>Nenhum item escolhido. Informe a quantidade nas linhas abaixo.</small>'
}

async function salvarRequisicaoColaborador() {

    const estado = estadoColaboradores.requisicao || {}
    const colaborador = estado.colaborador
    const itens = Object.values(estado.itens || {})

    if (!colaborador)
        return popup({ mensagem: 'Escolha para quem é a requisição.' })

    if (!itens.length)
        return popup({ mensagem: 'Informe a quantidade de pelo menos um item.' })

    overlayAguarde()

    try {
        const comentario = document.getElementById('comentarioColab')?.value.trim() || ''
        // Grava só código, quantidade e custo: o resto é lido da composição na hora.
        const gravarItens = Object.fromEntries(itens.map(({ codigo, qtde, custo }) => [codigo, { codigo, qtde, custo }]))
        const agora = dataServidor()
        const data = agora.toLocaleString()

        let dados
        if (estado.idRequisicao) {
            const anterior = (await recuperarDado('colaboradores', colaborador))?.requisicoes?.[estado.idRequisicao]
            if (!anterior)
                throw new Error('Requisição não encontrada. Atualize a tela.')
            if (!podeEditarRequisicaoColaborador({ ...anterior, movimento: anterior.movimento || 'SAÍDA' }))
                throw new Error('Esta requisição avançou no fluxo ou você não tem permissão para editá-la.')
            dados = { ...anterior, comentario, itens: gravarItens, editadoPor: acesso.usuario, editadoEm: data }
        } else {
            dados = {
                movimento: 'SAÍDA',
                data,
                ts: agora.getTime(),
                usuario: acesso.usuario,
                comentario,
                itens: gravarItens,
                etapas: {
                    [crypto.randomUUID()]: {
                        ...etapaInicialColaborador,
                        executor: [],
                        data,
                        ts: agora.getTime(),
                        usuario: acesso.usuario,
                        descricao: 'Requisição criada: separar e entregar os itens.'
                    }
                }
            }
        }

        const resultado = await enviar(`colaboradores/${colaborador}/requisicoes/${estado.idRequisicao || crypto.randomUUID()}`, dados)
        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao salvar a requisição.')

        removerPopup()

        // Requisição nova aparece no topo da lista de abertas (ou na pessoa, se foi aberta por ela).
        if (estadoColaboradores.aba == 'pessoas' && estadoColaboradores.pessoa?.id == colaborador)
            return carregarColaboradores()
        estadoColaboradores.situacao = 'abertas'
        estadoColaboradores.filtroStatus = 'TODOS'
        if (!document.querySelector('.tela-colaboradores'))
            return telaColaboradores('requisicoes')
        await trocarAbaColaboradores('requisicoes')

    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao salvar a requisição: Fale com o suporte.' })
    }
}

// ---------------- Atalhos do menu lateral ----------------

// Bloco reservado no topo dos atalhos (auxPendencias, js/ocorrencias.js): mesmo layout dos
// status de chamados, mas separado e abrindo a tela de colaboradores.
async function atalhosColaboradoresHTML() {
    if (['cliente', 'técnico'].includes(acesso?.permissao))
        return ''

    try {
        const { contagens = [] } = await chamarColaboradores('contagem')
        if (!contagens.length)
            return ''

        const pills = contagens
            .map(({ nome, quantidade, cor }) => `
                <div class="pill" onclick="filtrarStatusColaboradores('${escaparAtributo(nome)}')">
                    <span class="pill-a" style="background-color: ${cor};">${quantidade}</span>
                    <span class="pill-b">${escaparAtributo(nome)}</span>
                </div>
            `)
            .join('')

        return `
            <div class="atalhos-grupo-titulo">Ferramentas e materiais</div>
            ${pills}
            <div class="atalhos-grupo-titulo">Chamados</div>
        `
    } catch (erro) {
        console.error('Atalhos de colaboradores:', erro)
        return ''
    }
}

// ---------------- Documentos (PDF) ----------------

// O PDF é renderizado no servidor: `logo` aponta para o endereço local (Live Server) e a
// variável nem existe na página do PDF, então item sem imagem usa o logo publicado.
const logoPdfColab = 'https://gcs.app.br/imagens/logo-centralizada.png'

async function baixarPdfColab(html, nome) {
    try {
        await pdf({ html, estilos: ['tabelas-parceiro'], nome })
    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte!' })
    }
}

const assinaturasPdfColab = (esquerda, direita) => `
    <div style="${horizontal}; justify-content: space-around; width: 100%; margin-top: 4rem; gap: 2rem;">
        ${[esquerda, direita].map(([nome, papel]) => `
            <div style="${vertical}; align-items: center; width: 40%; border-top: 1px solid #000; padding-top: 4px;">
                <span>${escaparAtributo(nome)}</span>
                <small>${papel}</small>
            </div>`).join('')}
    </div>`

// Documento da requisição: recibo de entrega (saída) ou comprovante de devolução, para assinar e anexar.
async function gerarDocumentoColab(idColab, idReq) {
    const { requisicao: r, colaborador = {} } = buscarRequisicaoColab(idColab, idReq)
    if (!r)
        return popup({ mensagem: 'Requisição não encontrada. Atualize a tela.' })

    const devolucao = r.movimento == 'DEVOLUÇÃO'
    const titulo = devolucao ? 'COMPROVANTE DE DEVOLUÇÃO DE FERRAMENTAS E MATERIAIS' : 'RECIBO DE ENTREGA DE FERRAMENTAS E MATERIAIS'
    const declaracao = devolucao
        ? 'Declaro ter recebido de volta os itens relacionados abaixo, nas quantidades indicadas.'
        : 'Declaro ter recebido os itens relacionados abaixo, nas quantidades indicadas, para uso exclusivo nas atividades profissionais. '
            + 'As ferramentas ficam sob minha guarda e devem ser devolvidas quando solicitado ou ao término do vínculo.'

    const linhas = r.itens.map(i => `
        <tr>
            <td><img src="${i.imagem || logoPdfColab}" style="width: 3rem;" referrerpolicy="no-referrer" onerror="this.onerror = null; this.src = '${logoPdfColab}'"></td>
            <td>${escaparAtributo(i.codigo)}</td>
            <td style="text-align: left;">${escaparAtributo([i.descricao, i.modelo, i.fabricante].filter(Boolean).join(' · '))}</td>
            <td>${i.classe == 'FERRAMENTA' ? 'Ferramenta' : 'Material'}</td>
            <td>${escaparAtributo(i.unidade)}</td>
            <td style="text-align: center;">${numeroColab(i.quantidade)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.custo)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.quantidade * i.custo)}</td>
        </tr>
    `).join('')

    const html = `
        <div id="pdf" style="${vertical}; gap: 1rem; width: 95%; padding: 1rem; font-size: 12px;">
            <div style="${horizontal}; gap: 1rem;">
                <img style="width: 7rem;" src="https://gcs.app.br/imagens/GrupoCostaSilva.png">
                <span style="font-size: 1.4rem;">${titulo}</span>
            </div>

            <div style="${vertical}; gap: 2px;">
                <span><b>Colaborador</b> ${escaparAtributo(colaborador.nome || '')}</span>
                <span><b>Usuário</b> ${escaparAtributo(colaborador.usuario || '')}</span>
                <span><b>Data da requisição</b> ${escaparAtributo(r.data)}</span>
                <span><b>Solicitante</b> ${escaparAtributo(r.usuario)}</span>
                ${r.comentario ? `<span><b>Comentário</b> ${escaparAtributo(r.comentario)}</span>` : ''}
            </div>

            <p style="text-align: justify; margin: 0;">${declaracao}</p>

            <table class="tabela-v2">
                <thead>
                    <tr><th></th><th>Código</th><th>Descrição</th><th>Tipo</th><th>Un.</th><th>Qtde</th><th>Valor unit.</th><th>Total</th></tr>
                </thead>
                <tbody>
                    ${linhas}
                    <tr><td colspan="7" style="text-align: right;"><b>Total</b></td><td><b>${dinheiro(r.total)}</b></td></tr>
                </tbody>
            </table>

            ${devolucao
                ? assinaturasPdfColab([colaborador.nome || 'Colaborador', 'Quem devolveu'], [acesso.nome_completo || acesso.usuario || '', 'Quem recebeu'])
                : assinaturasPdfColab([colaborador.nome || 'Colaborador', 'Quem recebeu'], [acesso.nome_completo || acesso.usuario || '', 'Quem entregou'])}
        </div>
    `

    await baixarPdfColab(html, `${devolucao ? 'Devolucao' : 'Recibo'}-${colaborador.nome || ''}-${String(r.data).slice(0, 10).replaceAll('/', '-')}`)
}

// Relatório por pessoa: ferramentas e materiais com entregue, devolvido, Kit Técnico e saldo.
async function pdfRelatorioPessoaColab() {
    const { colaborador = {}, itens = [] } = estadoColaboradores.pessoa || {}
    const { ferramentas, materiais } = itensPessoaColab(itens)
    const hoje = dataServidor().toLocaleDateString('pt-BR')

    const tabela = (titulo, lista) => !lista.length ? '' : `
        <span style="font-size: 1rem;"><b>${titulo}</b></span>
        <table class="tabela-v2">
            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Entregue</th><th>Devolvido</th><th>Kit Técnico</th><th>Saldo</th><th>Valor unit.</th><th>Valor do saldo</th></tr></thead>
            <tbody>
                ${lista.map(i => `
                    <tr>
                        <td>${escaparAtributo(i.codigo)}</td>
                        <td style="text-align: left;">${escaparAtributo(i.descricao)}</td>
                        <td>${escaparAtributo(i.unidade)}</td>
                        <td style="text-align: center;">${numeroColab(i.entregue)}</td>
                        <td style="text-align: center;">${numeroColab(i.devolvido)}</td>
                        <td style="text-align: center;">${numeroColab(i.utilizado)}</td>
                        <td style="text-align: center;"><b>${numeroColab(i.saldo)}</b></td>
                        <td style="white-space: nowrap;">${dinheiro(i.custo)}</td>
                        <td style="white-space: nowrap;">${dinheiro(Math.max(0, i.saldo) * i.custo)}</td>
                    </tr>`).join('')}
                <tr><td colspan="8" style="text-align: right;"><b>Total</b></td><td><b>${dinheiro(lista.reduce((s, i) => s + Math.max(0, i.saldo) * i.custo, 0))}</b></td></tr>
            </tbody>
        </table>`

    const html = `
        <div id="pdf" style="${vertical}; gap: 1rem; width: 95%; padding: 1rem; font-size: 12px;">
            <div style="${horizontal}; gap: 1rem;">
                <img style="width: 7rem;" src="https://gcs.app.br/imagens/GrupoCostaSilva.png">
                <span style="font-size: 1.4rem;">FERRAMENTAS E MATERIAIS POR PESSOA</span>
            </div>
            <div style="${vertical}; gap: 2px;">
                <span><b>Colaborador</b> ${escaparAtributo(colaborador.nome || '')}</span>
                <span><b>Usuário</b> ${escaparAtributo(colaborador.usuario || '')}</span>
                <span><b>Data</b> ${hoje}</span>
            </div>
            ${tabela('Ferramentas', ferramentas)}
            ${tabela('Materiais', materiais)}
            ${!ferramentas.length && !materiais.length ? '<span>Nenhum item entregue.</span>' : ''}
        </div>
    `

    await baixarPdfColab(html, `Relatorio-${colaborador.nome || ''}-${hoje.replaceAll('/', '-')}`)
}

// ---------------- Termo de responsabilidade ----------------

// Termo assinado (upload) e a situação calculada no servidor: EM DIA, DESATUALIZADO
// (ferramentas mudaram desde o envio, com a lista do que mudou) ou PENDENTE (sem envio).
function blocoTermoColaborador(termo = {}, qtdeFerramentas = 0) {
    const { situacao, mudancas = [], nome, link, data, usuario } = termo
    if (!situacao && !link)
        return ''

    const rotulo = { 'EM DIA': 'Em dia', 'DESATUALIZADO': 'Desatualizado', 'PENDENTE': 'Não enviado' }[situacao] || ''
    const classe = { 'EM DIA': 'ok', 'DESATUALIZADO': 'atencao', 'PENDENTE': 'falta' }[situacao] || ''

    const listaMudancas = mudancas.length
        ? `
            <div class="colab-termo-mudancas">
                <small>Mudou desde o termo assinado:</small>
                ${mudancas.map(m => `
                    <span>${escaparAtributo(m.descricao || m.codigo)}: <b>${numeroColab(m.antes)} → ${numeroColab(m.agora)}</b></span>
                `).join('')}
            </div>`
        : ''

    return `
        <div class="colab-termo ${classe}">
            <div class="colab-termo-topo">
                <div>
                    <b>Termo de responsabilidade</b>
                    ${rotulo ? `<span class="colab-termo-situacao ${classe}">${rotulo}</span>` : ''}
                </div>
                <div class="colab-termo-acoes">
                    <button type="button" class="secundario" onclick="termoResponsabilidade()" ${qtdeFerramentas ? '' : 'disabled title="Nenhuma ferramenta em mãos"'}>Gerar termo</button>
                    <button type="button" onclick="document.getElementById('termoAssinadoColab').click()">${link ? 'Enviar novo assinado' : 'Enviar termo assinado'}</button>
                    <input type="file" id="termoAssinadoColab" accept=".pdf,image/*" hidden onchange="enviarTermoAssinado(this)">
                </div>
            </div>
            ${link ? `
                <div class="colab-termo-arquivo">
                    ${criarAnexoVisual(nome || 'termo.pdf', link, false)}
                    <small>Enviado em ${escaparAtributo(data || '')} por ${escaparAtributo(usuario || '')}</small>
                </div>` : '<small>Gere o termo, colete a assinatura e envie o arquivo assinado aqui.</small>'}
            ${listaMudancas}
        </div>
    `
}

// Guarda o arquivo assinado e as ferramentas em mãos agora: é a referência para
// sinalizar quando o saldo mudar (servidor, situacaoTermo).
async function enviarTermoAssinado(input) {
    const { id, itens = [] } = estadoColaboradores.pessoa || {}
    if (!id || !input?.files?.length)
        return

    overlayAguarde()

    try {
        const [arquivo] = await importarAnexos({ input }) || []
        if (!arquivo?.link)
            throw new Error('Falha no envio do arquivo.')

        const agora = dataServidor()
        const resultado = await enviar(`colaboradores/${id}/termo`, {
            nome: arquivo.nome || input.files[0].name,
            link: arquivo.link,
            data: agora.toLocaleString(),
            ts: agora.getTime(),
            usuario: acesso.usuario,
            ferramentas: Object.fromEntries(itens
                .filter(i => i.classe == 'FERRAMENTA' && i.saldo > 0)
                .map(i => [i.codigo, i.saldo]))
        })

        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao salvar o termo.')

        removerOverlay()
        await carregarColaboradores()

    } catch (erro) {
        popup({ mensagem: erro.message || 'Falha ao enviar o termo: Fale com o suporte.' })
    } finally {
        input.value = ''
    }
}

async function termoResponsabilidade() {

    const { id, colaborador = {}, itens = [] } = estadoColaboradores.pessoa || {}
    const ferramentas = itens.filter(i => i.classe == 'FERRAMENTA' && i.saldo > 0)
    if (!ferramentas.length)
        return popup({ mensagem: 'Nenhuma ferramenta em mãos.' })

    const cadastro = await recuperarDado('clientes', id) || {}
    const nome = cadastro.nome || colaborador.nome || ''
    const total = ferramentas.reduce((s, i) => s + i.saldo * i.custo, 0)
    const hoje = dataServidor().toLocaleDateString('pt-BR')

    const ressarcimento = 'Em caso de perda, extravio ou dano por mau uso, comprometo-me a ressarcir o valor de reposição dos itens; '
        + 'sendo empregado, estou ciente de que o valor poderá ser descontado, nos termos do art. 462, §1º, da CLT.'

    const linhas = ferramentas.map(i => `
        <tr>
            <td>${escaparAtributo(i.codigo)}</td>
            <td style="text-align: left;">${escaparAtributo(i.descricao)}</td>
            <td>${escaparAtributo(i.unidade)}</td>
            <td style="text-align: center;">${numeroColab(i.saldo)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.custo)}</td>
            <td style="white-space: nowrap;">${dinheiro(i.saldo * i.custo)}</td>
        </tr>
    `).join('')

    const html = `
        <div id="pdf" style="${vertical}; gap: 1rem; width: 95%; padding: 1rem; font-size: 12px;">

            <div style="${horizontal}; gap: 1rem;">
                <img style="width: 7rem;" src="https://gcs.app.br/imagens/GrupoCostaSilva.png">
                <span style="font-size: 1.4rem;">TERMO DE RESPONSABILIDADE DE FERRAMENTAS</span>
            </div>

            <div style="${vertical}; gap: 2px;">
                <span><b>Colaborador</b> ${escaparAtributo(nome)}</span>
                ${cadastro.cnpj ? `<span><b>CPF/CNPJ</b> ${escaparAtributo(cadastro.cnpj)}</span>` : ''}
                ${colaborador.setor ? `<span><b>Setor</b> ${escaparAtributo(colaborador.setor)}</span>` : ''}
                <span><b>Data</b> ${hoje}</span>
            </div>

            <p style="text-align: justify; margin: 0;">
                Declaro ter recebido as ferramentas e equipamentos relacionados abaixo, em perfeito estado de conservação
                e funcionamento, para uso exclusivo nas atividades profissionais. Comprometo-me a zelar pela guarda e
                conservação dos itens e a devolvê-los quando solicitado ou ao término do vínculo. ${ressarcimento}
            </p>

            <table class="tabela-v2">
                <thead>
                    <tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Qtde</th><th>Valor unit.</th><th>Total</th></tr>
                </thead>
                <tbody>
                    ${linhas}
                    <tr><td colspan="5" style="text-align: right;"><b>Total em mãos</b></td><td><b>${dinheiro(total)}</b></td></tr>
                </tbody>
            </table>

            ${assinaturasPdfColab([nome || 'Colaborador', 'Colaborador'], [acesso.nome_completo || acesso.usuario || '', 'Responsável pela entrega'])}
        </div>
    `

    popup({
        elemento: `<div>${html}</div>`,
        titulo: 'Termo de responsabilidade',
        botoes: [{ texto: 'Baixar PDF', img: 'pdf', funcao: 'baixarTermoResponsabilidade()' }]
    })

    estadoColaboradores.termo = { html, nome: `Termo-${nome || id}-${hoje.replaceAll('/', '-')}` }
}

async function baixarTermoResponsabilidade() {
    const { html, nome } = estadoColaboradores.termo || {}
    if (html)
        await baixarPdfColab(html, nome)
}
