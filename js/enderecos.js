// Vários endereços por cliente/fornecedor (26/11/2026). Servidor: gcs SCRIPTS/clientes_enderecos.js +
// migrations/clientes-enderecos.sql. O principal (fiscal) continua nas colunas do cadastro; os outros
// (entrega, obra, cobrança, filial...) ficam em clientes_enderecos com quem criou, quando e em que tela.
//
// Peças:
//  - seletorEnderecoHtml({ clienteId, foto, contexto, ref }): bloco "endereço em uso + N endereços · Trocar"
//    num formulário; lerSeletorEndereco(raiz) devolve a foto escolhida (null = principal sem escolha) e
//    clienteSeletorEndereco(raiz, id) troca o cliente (volta para o principal).
//  - abrirEscolhaEndereco({ clienteId, atualId, contexto, ref, aoEscolher }): lista em cartões + "Novo endereço".
//  - blocoEnderecosCadastroHtml(idCliente): lista editável dentro do cadastro do cliente.
// Os blocos se montam sozinhos ao entrar na página (MutationObserver no fim do arquivo).
//
// "Foto" = cópia do endereço no momento da escolha, gravada no documento (dados_orcam.endereco,
// dados_ocorrencias.endereco, requisicoes.entrega, destinatario.endereco_id na nota): se o endereço for
// alterado ou removido depois, o documento continua mostrando o que valeu nele.

const TIPOS_ENDERECO = {
    PRINCIPAL: 'Principal · fiscal',
    ENTREGA: 'Entrega',
    OBRA: 'Obra / execução',
    COBRANCA: 'Cobrança',
    FILIAL: 'Filial',
    OUTRO: 'Outro'
}

const ORIGENS_ENDERECO = {
    cadastro: 'no cadastro',
    orcamento: 'no orçamento',
    chamado: 'no chamado',
    requisicao: 'na requisição',
    nota: 'na nota',
    logistica: 'na logística',
    migracao: 'vindo do antigo "endereço de entrega"'
}

async function apiEnderecos(caminho, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/enderecos/${caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(dados.mensagem || `Falha nos endereços (${resposta.status})`)
    return dados
}

// Lista por cliente guardada por 2 minutos (vários blocos na mesma tela pedem a mesma).
const cacheEnderecos = new Map()
async function listarEnderecosCliente(clienteId, forcar = false) {
    const id = String(clienteId ?? '').trim()
    if (!/^\d+$/.test(id)) return { principal: null, enderecos: [] }
    const guardado = cacheEnderecos.get(id)
    if (!forcar && guardado && Date.now() - guardado.em < 120000) return guardado.promessa
    const promessa = apiEnderecos('listar', { cliente_id: id })
    cacheEnderecos.set(id, { em: Date.now(), promessa })
    try {
        return await promessa
    } catch (erro) {
        cacheEnderecos.delete(id)
        throw erro
    }
}

function esquecerEnderecosCliente(clienteId) {
    cacheEnderecos.delete(String(clienteId ?? ''))
}

// ---------------------------------------------------------------- textos

function linhaCidadeEndereco(e) {
    const cidade = [e?.cidade, e?.estado].filter(Boolean).join('/')
    return [e?.bairro, cidade, e?.cep].filter(Boolean).join(' · ')
}

function textoEnderecoCompleto(e) {
    return [enderecoComNumero(e), linhaCidadeEndereco(e)].filter(Boolean).join(' · ')
}

function dataHoraEndereco(valor) {
    const d = new Date(valor)
    return Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

function carimboEndereco(e) {
    if (!e?.criado_em) return 'Endereço do cadastro (o mesmo da Receita e das notas)'
    const onde = ORIGENS_ENDERECO[e.criado_origem] || ''
    const criado = `Criado por <b>${escaparAtributo(e.criado_por || '—')}</b> em ${dataHoraEndereco(e.criado_em)}`
        + (onde ? ` ${onde}` : '') + (e.criado_ref ? ` <b>${escaparAtributo(e.criado_ref)}</b>` : '')
    const alterado = e.alterado_em
        ? ` · alterado por <b>${escaparAtributo(e.alterado_por || '—')}</b> em ${dataHoraEndereco(e.alterado_em)}`
        : ''
    return criado + alterado
}

function etiquetaTipoEndereco(tipo = 'OUTRO', apelido = '') {
    const t = TIPOS_ENDERECO[tipo] ? tipo : 'OUTRO'
    const nome = String(apelido || '').trim()
    return `<span class="end-tipo end-tipo-${t.toLowerCase()}">${TIPOS_ENDERECO[t]}</span>`
        + (nome && nome !== t ? `<b class="end-apelido">${escaparAtributo(nome)}</b>` : '')
}

// Cópia do endereço para gravar no documento: id null = principal do cadastro.
function fotoEndereco(e) {
    const extra = Boolean(e?.criado_em)
    const campo = c => String(e?.[c] ?? '').trim() || null
    return {
        id: extra ? Number(e.id) : null,
        tipo: extra ? (e.tipo || 'OUTRO') : 'PRINCIPAL',
        apelido: extra ? campo('apelido') : null,
        cep: campo('cep'),
        endereco: campo('endereco'),
        numero: campo('numero'),
        complemento: campo('complemento'),
        bairro: campo('bairro'),
        cidade: campo('cidade'),
        estado: campo('estado'),
        codigo_ibge: campo('codigo_ibge'),
        referencia: extra ? campo('referencia') : null,
        escolhido_por: acesso?.usuario || null,
        escolhido_em: new Date().toISOString()
    }
}

// ---------------------------------------------------------------- seletor nos formulários

function seletorEnderecoHtml({ clienteId = '', foto = null, contexto = 'orcamento', ref = '' } = {}) {
    return `<div class="end-seletor" data-end-seletor
        data-cliente="${escaparAtributo(clienteId ?? '')}"
        data-contexto="${escaparAtributo(contexto)}"
        data-ref="${escaparAtributo(ref || '')}"
        data-foto="${escaparAtributo(foto && typeof foto === 'object' ? JSON.stringify(foto) : '')}"></div>`
}

function seletorEnderecoDe(raiz) {
    if (!raiz) return document.querySelector('[data-end-seletor]')
    return raiz.matches?.('[data-end-seletor]') ? raiz : raiz.querySelector('[data-end-seletor]')
}

function fotoDoSeletor(el) {
    try { return el?.dataset.foto ? JSON.parse(el.dataset.foto) : null } catch { return null }
}

function lerSeletorEndereco(raiz) {
    return fotoDoSeletor(seletorEnderecoDe(raiz))
}

function clienteSeletorEndereco(raiz, clienteId) {
    const el = seletorEnderecoDe(raiz)
    if (!el) return
    if (String(el.dataset.cliente) !== String(clienteId ?? '')) el.dataset.foto = ''
    el.dataset.cliente = clienteId ?? ''
    renderSeletorEndereco(el)
}

async function renderSeletorEndereco(el) {
    const clienteId = el.dataset.cliente
    const foto = fotoDoSeletor(el)
    if (!/^\d+$/.test(String(clienteId || ''))) {
        el.innerHTML = '<small class="end-vazio">Escolha o cliente para ver os endereços dele.</small>'
        return
    }
    if (!el.innerHTML.trim()) el.innerHTML = '<small class="end-vazio">Carregando endereços…</small>'
    let lista
    try {
        lista = await listarEnderecosCliente(clienteId)
    } catch (erro) {
        el.innerHTML = `<small class="end-vazio">Não foi possível carregar os endereços: ${escaparAtributo(erro.message)}</small>`
        return
    }
    if (el.dataset.cliente !== clienteId) return // trocaram o cliente enquanto carregava

    const atual = foto || { ...(lista.principal || {}), tipo: 'PRINCIPAL' }
    const total = 1 + (lista.enderecos || []).length
    // A foto pode ser de um endereço que mudou ou foi removido depois: avisa sem trocar sozinho.
    const vivo = foto?.id ? lista.enderecos.find(e => Number(e.id) === Number(foto.id)) : null
    const desatualizado = foto?.id && (!vivo || textoEnderecoCompleto(vivo) !== textoEnderecoCompleto(foto))
    const textoPrincipal = !foto?.id && foto && lista.principal
        && textoEnderecoCompleto(lista.principal) !== textoEnderecoCompleto(foto)

    el.innerHTML = `
        <div class="end-atual">
            <span class="end-pino" aria-hidden="true"></span>
            <div class="end-atual-texto">
                <div class="end-atual-topo">${etiquetaTipoEndereco(atual.tipo, atual.apelido)}</div>
                <span class="end-atual-rua">${escaparAtributo(enderecoComNumero(atual) || 'Sem endereço no cadastro')}</span>
                <small>${escaparAtributo(linhaCidadeEndereco(atual))}</small>
                ${atual.referencia ? `<small class="end-atual-ref">${escaparAtributo(atual.referencia)}</small>` : ''}
                ${foto?.escolhido_por ? `<small class="end-carimbo">Escolhido por <b>${escaparAtributo(foto.escolhido_por)}</b> em ${dataHoraEndereco(foto.escolhido_em)}</small>` : ''}
                ${desatualizado ? `<small class="end-alerta">${vivo ? 'Este endereço foi alterado no cadastro depois da escolha.' : 'Este endereço foi removido do cadastro.'} O documento guarda o que foi escolhido.</small>` : ''}
                ${textoPrincipal ? '<small class="end-alerta">O endereço principal mudou no cadastro depois da escolha.</small>' : ''}
            </div>
            <button type="button" class="end-trocar" onclick="trocarEnderecoSeletor(this)" title="Ver os endereços do cliente, trocar ou cadastrar um novo">
                <span class="end-contador">${total}</span>
                <span>${total === 1 ? 'endereço' : 'endereços'}</span>
                <b>Trocar</b>
            </button>
        </div>`
}

function trocarEnderecoSeletor(botao) {
    const el = botao.closest('[data-end-seletor]')
    if (!el) return
    const foto = fotoDoSeletor(el)
    abrirEscolhaEndereco({
        clienteId: el.dataset.cliente,
        atualId: foto?.id ?? null,
        contexto: el.dataset.contexto,
        ref: el.dataset.ref,
        aoEscolher: nova => {
            el.dataset.foto = JSON.stringify(nova)
            renderSeletorEndereco(el)
            el.dispatchEvent(new CustomEvent('endereco-escolhido', { bubbles: true, detail: nova }))
        }
    })
}

// ---------------------------------------------------------------- escolha (lista em cartões)

function cartaoEnderecoHtml(e, { emUso = false, indice = 0, acoes = '' } = {}) {
    return `
        <div class="end-cartao ${emUso ? 'em-uso' : ''}" data-indice="${indice}">
            <div class="end-cartao-topo">
                ${etiquetaTipoEndereco(e.criado_em ? e.tipo : 'PRINCIPAL', e.criado_em ? e.apelido : '')}
                ${emUso ? '<span class="end-em-uso">Em uso</span>' : ''}
            </div>
            <div class="end-cartao-rua">${escaparAtributo(enderecoComNumero(e) || '—')}</div>
            <div class="end-cartao-sub">${escaparAtributo(linhaCidadeEndereco(e))}</div>
            ${e.referencia ? `<div class="end-cartao-ref">${escaparAtributo(e.referencia)}</div>` : ''}
            <small class="end-carimbo">${carimboEndereco(e)}</small>
            ${acoes ? `<div class="end-cartao-acoes">${acoes}</div>` : ''}
        </div>`
}

async function abrirEscolhaEndereco({ clienteId, atualId = null, contexto = 'orcamento', ref = '', aoEscolher }) {
    if (!/^\d+$/.test(String(clienteId || ''))) return popup({ mensagem: 'Escolha o cliente primeiro.' })
    overlayAguarde()
    let lista
    try {
        lista = await listarEnderecosCliente(clienteId, true)
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: erro.message })
    }
    removerOverlay()

    const cartoes = [{ ...(lista.principal || {}) }, ...(lista.enderecos || [])]
    const chave = crypto.randomUUID()
    const html = cartoes.map((e, i) => {
        const emUso = e.criado_em ? Number(e.id) === Number(atualId) : atualId == null
        const acoes = emUso
            ? '<button type="button" class="end-botao" disabled>Em uso</button>'
            : `<button type="button" class="end-botao end-botao-principal" data-acao="usar" data-indice="${i}">Usar este</button>`
        return cartaoEnderecoHtml(e, { emUso, indice: i, acoes })
    }).join('')

    const idPopup = popup({
        titulo: `Endereços · ${lista.principal?.nome || ''}`,
        elemento: `
            <div class="end-escolha" data-end-escolha="${chave}">
                <div class="end-escolha-topo">
                    <span><span class="end-contador">${cartoes.length}</span> ${cartoes.length === 1 ? 'endereço cadastrado' : 'endereços cadastrados'}</span>
                    <button type="button" class="end-novo" data-acao="novo">+ Novo endereço</button>
                </div>
                <div class="end-lista">${html}</div>
                <small class="end-dica">O novo endereço fica no cadastro do cliente, com o seu usuário, a data e a hora.</small>
            </div>`
    })

    document.querySelector(`[data-end-escolha="${chave}"]`)?.addEventListener('click', ev => {
        const botao = ev.target.closest('[data-acao]')
        if (!botao) return
        if (botao.dataset.acao === 'usar') {
            const e = cartoes[Number(botao.dataset.indice)]
            removerPopup(idPopup)
            aoEscolher?.(fotoEndereco(e))
        }
        if (botao.dataset.acao === 'novo') {
            formularioEnderecoCliente({
                clienteId, contexto, ref,
                aoSalvar: novo => {
                    removerPopup(idPopup)
                    aoEscolher?.(fotoEndereco(novo))
                }
            })
        }
    })
}

// ---------------------------------------------------------------- novo / editar

function formularioEnderecoCliente({ clienteId, endereco = {}, contexto = 'cadastro', ref = '', aoSalvar }) {
    const e = endereco || {}
    const chave = crypto.randomUUID()
    const v = c => escaparAtributo(e[c] || '')
    const opcoesTipo = Object.entries(TIPOS_ENDERECO)
        .filter(([k]) => k !== 'PRINCIPAL')
        .map(([k, t]) => `<option value="${k}" ${(e.tipo || 'ENTREGA') === k ? 'selected' : ''}>${t}</option>`)
        .join('')
    const opcoesUf = aEstados.map(uf => `<option ${String(e.estado || '') === uf ? 'selected' : ''}>${uf}</option>`).join('')
    const onde = ORIGENS_ENDERECO[contexto] || ''
    const registro = e.criado_em
        ? carimboEndereco(e)
        : `Vai ficar registrado: <b>${escaparAtributo(acesso?.usuario || '')}</b>, data e hora${onde ? `, ${onde}` : ''}${ref ? ` <b>${escaparAtributo(ref)}</b>` : ''}.`

    const idPopup = popup({
        titulo: e.id ? 'Editar endereço' : 'Novo endereço',
        elemento: `
            <div class="end-form" data-end-form="${chave}">
                <label><span>Tipo</span><select name="tipo">${opcoesTipo}</select></label>
                <label><span>Apelido</span><input name="apelido" maxlength="40" placeholder="Ex.: LOJA CENTRO, OBRA RUA X" value="${v('apelido')}"></label>
                <label><span>CEP</span><input name="cep" inputmode="numeric" maxlength="9" placeholder="00000-000" value="${v('cep')}"></label>
                <label class="end-largo"><span>Endereço</span><input name="endereco" maxlength="60" value="${v('endereco')}"></label>
                <label><span>Número</span><input name="numero" maxlength="20" placeholder="Número ou S/N" value="${v('numero')}"></label>
                <label><span>Complemento</span><input name="complemento" maxlength="60" placeholder="Loja, sala, bloco..." value="${v('complemento')}"></label>
                <label><span>Bairro</span><input name="bairro" maxlength="60" value="${v('bairro')}"></label>
                <label><span>Cidade</span><input name="cidade" maxlength="60" value="${v('cidade')}"></label>
                <label><span>UF</span><select name="estado">${opcoesUf}</select></label>
                <label class="end-largo"><span>Referência / quem recebe</span><input name="referencia" maxlength="200" placeholder="Ponto de referência, contato no local, horário..." value="${v('referencia')}"></label>
                <small class="end-form-aviso" data-aviso></small>
                <small class="end-carimbo end-largo">${registro}</small>
            </div>`,
        botoes: [
            { id: `cancelar-${chave}`, texto: 'Cancelar', img: 'cancel' },
            { id: `salvar-${chave}`, texto: 'Salvar endereço', img: 'concluido' }
        ]
    })

    const form = document.querySelector(`[data-end-form="${chave}"]`)
    if (!form) return
    const campo = n => form.querySelector(`[name="${n}"]`)
    const aviso = form.querySelector('[data-aviso]')
    form.querySelectorAll('input').forEach(i => i.setAttribute('autocomplete', 'gcs-endereco-cliente'))
    form.querySelectorAll('input:not([name=cep]):not([name=referencia])').forEach(i => { i.style.textTransform = 'uppercase' })

    campo('cep').addEventListener('input', async () => {
        let d = campo('cep').value.replace(/\D/g, '').slice(0, 8)
        campo('cep').value = d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
        if (d.length !== 8) return
        aviso.textContent = 'Buscando o CEP…'
        const r = await buscarEndereco(d)
        if (campo('cep').value.replace(/\D/g, '') !== d) return
        if (!r?.city) {
            aviso.textContent = 'CEP não encontrado: preencha o endereço.'
            return
        }
        aviso.textContent = ''
        if (r.street) campo('endereco').value = String(r.street).toUpperCase()
        if (r.neighborhood) campo('bairro').value = String(r.neighborhood).toUpperCase()
        campo('cidade').value = String(r.city).toUpperCase()
        campo('estado').value = r.state || ''
        campo('numero').focus()
    })

    document.getElementById(`cancelar-${chave}`)?.addEventListener('click', () => removerPopup(idPopup))
    document.getElementById(`salvar-${chave}`)?.addEventListener('click', async () => {
        const dados = Object.fromEntries(['tipo', 'apelido', 'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'referencia']
            .map(n => [n, String(campo(n)?.value || '').trim()]))
        if (!dados.endereco || !dados.cidade || !dados.estado)
            return (aviso.textContent = 'Preencha pelo menos endereço, cidade e UF.')
        if (dados.cep && dados.cep.replace(/\D/g, '').length !== 8)
            return (aviso.textContent = 'O CEP tem 8 números.')
        try {
            overlayAguarde()
            const { endereco: salvo } = await apiEnderecos('salvar', {
                ...dados, id: e.id || undefined, cliente_id: clienteId, origem: contexto, ref
            })
            esquecerEnderecosCliente(clienteId)
            removerOverlay()
            removerPopup(idPopup)
            aoSalvar?.(salvo)
        } catch (erro) {
            removerOverlay()
            aviso.textContent = erro.message
        }
    })
}

// ---------------------------------------------------------------- cadastro do cliente

function blocoEnderecosCadastroHtml(idCliente) {
    return `<div class="end-cadastro" data-end-cadastro="${escaparAtributo(idCliente || '')}"></div>`
}

async function renderEnderecosCadastro(el) {
    const idCliente = el.dataset.endCadastro
    const contador = el.closest('.painel-padrao')?.querySelector('[data-end-contador-cadastro]')
    if (!idCliente) {
        el.innerHTML = '<small class="end-vazio">Salve o cadastro para incluir outros endereços (entrega, obra, filial, cobrança...).</small>'
        if (contador) contador.textContent = '1'
        return
    }
    if (!el.innerHTML.trim()) el.innerHTML = '<small class="end-vazio">Carregando endereços…</small>'
    let lista
    try {
        lista = await listarEnderecosCliente(idCliente, true)
    } catch (erro) {
        el.innerHTML = `<small class="end-vazio">Não foi possível carregar os endereços: ${escaparAtributo(erro.message)}</small>`
        return
    }
    const extras = lista.enderecos || []
    if (contador) {
        contador.textContent = String(1 + extras.length)
        contador.title = `${1 + extras.length} endereço(s): o principal (acima) + ${extras.length} outro(s)`
    }
    el.innerHTML = `
        <div class="end-lista">
            ${extras.map((e, i) => cartaoEnderecoHtml(e, {
                indice: i,
                acoes: `<button type="button" class="end-botao" data-acao="editar" data-indice="${i}">Editar</button>
                        <button type="button" class="end-botao end-botao-remover" data-acao="remover" data-indice="${i}">Remover</button>`
            })).join('')}
            <button type="button" class="end-adicionar" data-acao="novo">
                <span>+</span> Adicionar endereço
                <small>${extras.length ? `${extras.length} além do principal` : 'Entrega, obra, filial, cobrança...'}</small>
            </button>
        </div>`
    el.onclick = async ev => {
        const botao = ev.target.closest('[data-acao]')
        if (!botao) return
        const e = extras[Number(botao.dataset.indice)]
        if (botao.dataset.acao === 'novo')
            formularioEnderecoCliente({ clienteId: idCliente, contexto: 'cadastro', aoSalvar: () => renderEnderecosCadastro(el) })
        if (botao.dataset.acao === 'editar')
            formularioEnderecoCliente({ clienteId: idCliente, endereco: e, contexto: 'cadastro', aoSalvar: () => renderEnderecosCadastro(el) })
        if (botao.dataset.acao === 'remover') {
            const ok = await confirmarPopup({
                titulo: 'Remover endereço',
                mensagem: `Remover <b>${escaparAtributo(textoEnderecoCompleto(e))}</b> do cadastro?<br><small>Orçamentos, chamados e notas que já usaram este endereço continuam com ele.</small>`,
                textoConfirmar: 'Remover'
            })
            if (!ok) return
            try {
                await apiEnderecos('arquivar', { id: e.id })
                esquecerEnderecosCliente(idCliente)
                renderEnderecosCadastro(el)
            } catch (erro) {
                popup({ mensagem: erro.message })
            }
        }
    }
}

// Detalhes da lista de clientes ("+"): outros endereços em leitura.
async function renderResumoEnderecos(el) {
    const idCliente = el.dataset.endResumo
    try {
        const { enderecos = [] } = await listarEnderecosCliente(idCliente)
        el.innerHTML = enderecos.length
            ? `<div class="cliente-detalhes-grupo"><span class="cliente-detalhes-titulo">Outros endereços (${enderecos.length})</span>
                ${enderecos.map(e => `<span class="cliente-dado"><small>${escaparAtributo(TIPOS_ENDERECO[e.tipo] || e.tipo)}${e.apelido ? ` · ${escaparAtributo(e.apelido)}` : ''}</small><b>${escaparAtributo(textoEnderecoCompleto(e))}</b></span>`).join('')}
              </div>`
            : ''
    } catch {
        el.innerHTML = ''
    }
}

// ---------------------------------------------------------------- linha de endereços sobre campos soltos
// Nota fiscal (destinatário/tomador) e etiqueta da logística já têm os campos do endereço: aqui fica a
// linha "Endereços do cliente [Principal] [Entrega · ...] [+ Novo]" que preenche esses campos; o usuário
// continua podendo editar à mão, e o "+" salva o digitado no cadastro (com quem/quando/onde).
//   campos: { cep, endereco, numero, complemento, bairro, cidade, estado, codigo_ibge?, id? } → name do campo
//   clienteDe: seletor do campo com o id do cliente (value ou id), ou chame chipsEnderecoCliente(el, id).

function chipsEnderecoHtml({ campos, contexto = 'nota', ref = '', clienteDe = '' }) {
    return `<div class="fis-enderecos" data-end-chips
        data-campos="${escaparAtributo(JSON.stringify(campos))}"
        data-contexto="${escaparAtributo(contexto)}"
        data-ref="${escaparAtributo(ref)}"
        data-cliente-de="${escaparAtributo(clienteDe)}"></div>`
}

const normalizarEnderecoTexto = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s*\([A-Z]{2}\)\s*$/, '').replace(/\s+/g, ' ').trim()
const chaveEndereco = e => [String(e?.cep || '').replace(/\D/g, ''), normalizarEnderecoTexto(e?.endereco), normalizarEnderecoTexto(e?.numero)].join('|')

function contextoChips(el) {
    const raiz = el.closest('form, .fis-form, .painel-padrao, .popup') || document
    let campos = {}
    try { campos = JSON.parse(el.dataset.campos || '{}') } catch { }
    const campo = chave => campos[chave] ? raiz.querySelector(`[name="${campos[chave]}"]`) : null
    const alvo = el.dataset.clienteDe ? raiz.querySelector(el.dataset.clienteDe) : null
    const clienteId = String(el.dataset.cliente || alvo?.value || alvo?.id || '').trim()
    return { raiz, campos, campo, clienteId }
}

function enderecoDigitadoChips(el) {
    const { campo } = contextoChips(el)
    const v = c => String(campo(c)?.value || '').trim()
    return {
        cep: v('cep'), endereco: v('endereco'), numero: v('numero'), complemento: v('complemento'),
        bairro: v('bairro'), cidade: v('cidade').replace(/\s*\([A-Z]{2}\)\s*$/, ''), estado: v('estado').toUpperCase()
    }
}

function chipsEnderecoCliente(el, clienteId) {
    if (!el) return
    el.dataset.cliente = clienteId ?? ''
    renderChipsEndereco(el)
}

async function renderChipsEndereco(el) {
    const { raiz, campo, clienteId } = contextoChips(el)
    const travado = campo('endereco')?.disabled || campo('endereco')?.readOnly
    if (!/^\d+$/.test(clienteId) || travado) {
        el.innerHTML = ''
        if (campo('id')) campo('id').value = ''
        return
    }
    let lista
    try {
        lista = await listarEnderecosCliente(clienteId)
    } catch {
        el.innerHTML = ''
        return
    }
    if (contextoChips(el).clienteId !== clienteId) return
    const todos = [{ ...(lista.principal || {}), _id: '0' }, ...(lista.enderecos || []).map(e => ({ ...e, _id: String(e.id) }))]
    el._enderecos = todos
    const digitado = enderecoDigitadoChips(el)
    const marcado = todos.find(e => chaveEndereco(e) === chaveEndereco(digitado))
    if (campo('id')) campo('id').value = marcado?._id || ''
    const diferente = !marcado && digitado.endereco

    el.innerHTML = `
        <small>Endereços do cliente <span class="end-contador">${todos.length}</span></small>
        ${todos.map(e => `
            <button type="button" class="fis-endereco-chip ${marcado === e ? 'ativo' : ''}" data-chip="${e._id}"
                title="${escaparAtributo(textoEnderecoCompleto(e))}">
                ${escaparAtributo(e._id === '0' ? 'Principal' : (e.apelido || TIPOS_ENDERECO[e.tipo] || 'Outro'))}
                <small>${escaparAtributo([e.cidade, e.estado].filter(Boolean).join('/'))}</small>
            </button>`).join('')}
        <button type="button" class="fis-endereco-chip novo" data-chip="novo">+ ${diferente ? 'Salvar o digitado no cadastro' : 'Novo endereço'}</button>
        ${diferente ? '<small class="end-alerta">O endereço digitado não é nenhum dos cadastrados.</small>' : ''}`

    if (!el._ouvindo) {
        el._ouvindo = true
        el.addEventListener('click', ev => {
            const botao = ev.target.closest('[data-chip]')
            if (!botao) return
            const atual = contextoChips(el)
            if (botao.dataset.chip === 'novo') {
                const base = enderecoDigitadoChips(el)
                return formularioEnderecoCliente({
                    clienteId: atual.clienteId,
                    endereco: diferenteDosCadastrados(el) ? { tipo: 'ENTREGA', ...base } : { tipo: 'ENTREGA' },
                    contexto: el.dataset.contexto,
                    ref: el.dataset.ref || atual.raiz.dataset?.id || '',
                    aoSalvar: novo => aplicarEnderecoChips(el, novo)
                })
            }
            const e = (el._enderecos || []).find(x => x._id === botao.dataset.chip)
            if (e) aplicarEnderecoChips(el, e)
        })
        // Digitou no endereço: a marcação acompanha (sem nova consulta: a lista está guardada).
        raiz.addEventListener('input', ev => {
            const nomes = Object.values(contextoChips(el).campos)
            if (!nomes.includes(ev.target?.name)) return
            clearTimeout(el._espera)
            el._espera = setTimeout(() => renderChipsEndereco(el), 300)
        })
    }
}

function diferenteDosCadastrados(el) {
    const digitado = enderecoDigitadoChips(el)
    return digitado.endereco && !(el._enderecos || []).some(e => chaveEndereco(e) === chaveEndereco(digitado))
}

function aplicarEnderecoChips(el, e) {
    const { raiz, campo } = contextoChips(el)
    const valores = {
        cep: e.cep, endereco: e.endereco, numero: e.numero, complemento: e.complemento, bairro: e.bairro,
        cidade: String(e.cidade || '').replace(/\s*\([A-Z]{2}\)\s*$/, ''), estado: e.estado, codigo_ibge: e.codigo_ibge
    }
    for (const [c, v] of Object.entries(valores)) {
        const input = campo(c)
        if (input) input.value = v || ''
    }
    // Avisa a tela (prévia da nota, validação da etiqueta) como se tivesse digitado.
    const ultimo = campo('estado') || campo('cidade')
    ultimo?.dispatchEvent(new Event('input', { bubbles: true }))
    ultimo?.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new CustomEvent('endereco-escolhido', { bubbles: true, detail: e }))
    renderChipsEndereco(el)
    if (raiz && typeof agendarPreviaFis === 'function' && raiz.matches?.('.fis-form')) agendarPreviaFis()
}

// Os blocos se montam ao entrar na página (formulários montados por popup/innerHTML).
new MutationObserver(mutacoes => {
    for (const mutacao of mutacoes)
        for (const no of mutacao.addedNodes) {
            if (no.nodeType !== Node.ELEMENT_NODE) continue
            const achar = seletor => no.matches(seletor) ? [no] : [...no.querySelectorAll(seletor)]
            achar('[data-end-seletor]').forEach(el => { if (!el.dataset.montado) { el.dataset.montado = 'S'; renderSeletorEndereco(el) } })
            achar('[data-end-cadastro]').forEach(el => { if (!el.dataset.montado) { el.dataset.montado = 'S'; renderEnderecosCadastro(el) } })
            achar('[data-end-resumo]').forEach(el => { if (!el.dataset.montado) { el.dataset.montado = 'S'; renderResumoEnderecos(el) } })
            achar('[data-end-chips]').forEach(el => { if (!el.dataset.montado) { el.dataset.montado = 'S'; renderChipsEndereco(el) } })
        }
}).observe(document.documentElement, { childList: true, subtree: true })
