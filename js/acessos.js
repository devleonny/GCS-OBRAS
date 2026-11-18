// Central de Acessos (gcs: SCRIPTS/acessos.js, SCRIPTS/acessos_catalogo.js, migrations/central-acessos.sql).
// Árvore módulo → tela → função; perfil (clientes.permissao) com as marcações de base e, por usuário,
// só os ajustes (a mais / a menos). Só o adm abre a central.
//
// No resto do front: pode('chave') diz se o usuário logado tem a tela/função. As chaves vêm do
// servidor no login, na renovação do token e no /validar-token (acesso.acessos).

let conjuntoAcessos = null
let conjuntoAcessosOrigem = null

function pode(chave) {
    const lista = acesso?.acessos
    if (!Array.isArray(lista)) return false
    if (conjuntoAcessosOrigem !== lista) {
        conjuntoAcessos = new Set(lista)
        conjuntoAcessosOrigem = lista
    }
    return conjuntoAcessos.has(chave)
}

const ehAdmAcessos = () => acesso?.permissao === 'adm'

async function apiAcessos(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/acessos/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const retorno = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(retorno.mensagem || `Falha (${resposta.status})`)
    return retorno
}

// O adm mudou os acessos deste usuário (websocket "acessos_alterados") ou chegaram chaves novas.
async function recarregarMeusAcessos() {
    try {
        const { acessos } = await apiAcessos('meus')
        aplicarMeusAcessos(acessos)
    } catch (erro) {
        console.warn('[ACESSOS]', erro.message)
    }
}

function aplicarMeusAcessos(lista) {
    if (!Array.isArray(lista)) return
    const antes = JSON.stringify([...(acesso?.acessos || [])].sort())
    acesso = { ...(acesso || {}), acessos: lista }
    const guardado = JSON.parse(localStorage.getItem('acesso') || 'null')
    if (guardado) localStorage.setItem('acesso', JSON.stringify({ ...guardado, acessos: lista }))
    if (antes !== JSON.stringify([...lista].sort()) && document.querySelector('.botoesMenu'))
        criarMenus('inicial')
}

// ---------------------------------------------------------------- central

const estadoAcessos = {
    aba: 'usuarios',
    catalogo: [],
    itens: new Map(),       // chave -> { chave, nome, tipo, pai, filhos: [chaves], caminho }
    perfis: [],
    usuarios: [],
    busca: '',
    buscaArvore: '',
    selecionado: null,      // usuário (login) ou perfil (código) aberto no editor
    marcados: new Set(),    // o que está marcado no editor
    perfilEditor: null,     // perfil escolhido no editor do usuário
    novoPerfil: false,
    abertos: new Set(),     // nós expandidos na árvore
    alterado: false
}
const escAc = v => escaparAtributo(v ?? '')

function indexarCatalogoAcessos(nos, pai = null, caminho = []) {
    for (const no of nos) {
        estadoAcessos.itens.set(no.chave, {
            chave: no.chave, nome: no.nome, tipo: no.tipo, descricao: no.descricao || '', pai,
            filhos: (no.filhos || []).map(f => f.chave), caminho: [...caminho, no.nome]
        })
        if (no.filhos?.length) indexarCatalogoAcessos(no.filhos, no.chave, [...caminho, no.nome])
    }
}

async function telaCentralAcessos() {
    if (!ehAdmAcessos()) return popup({ mensagem: 'Só o administrador abre a Central de Acessos.' })
    overlayAguarde()
    try {
        const [{ catalogo, perfis }, { usuarios }] = await Promise.all([apiAcessos('catalogo'), apiAcessos('usuarios')])
        estadoAcessos.catalogo = catalogo
        estadoAcessos.itens = new Map()
        indexarCatalogoAcessos(catalogo)
        estadoAcessos.perfis = perfis
        estadoAcessos.usuarios = usuarios
        estadoAcessos.selecionado = null
        estadoAcessos.alterado = false
    } catch (erro) {
        removerOverlay()
        return popup({ mensagem: erro.message })
    }
    removerOverlay()
    titulo.innerHTML = 'Central de Acessos'
    desenharCentralAcessos()
}

function desenharCentralAcessos() {
    const abas = [['usuarios', 'Usuários'], ['perfis', 'Perfis'], ['historico', 'Histórico']]
    tela.innerHTML = `
        <div class="pagina-conteudo">
            <div class="cabecalho-pagina"><h2>Central de Acessos</h2></div>
            <div class="ac-quadro">
                <div class="ac-abas">
                    ${abas.map(([k, t]) => `<button type="button" class="${estadoAcessos.aba === k ? 'ativo' : ''}" onclick="trocarAbaAcessos('${k}')">${t}</button>`).join('')}
                    <small>O perfil dá as marcações de base. No usuário, o que for diferente do perfil fica como ajuste dele:
                        <span class="ac-tag ac-mais">+ a mais</span> <span class="ac-tag ac-menos">− a menos</span>.
                        Mudou o perfil, todos que usam ele mudam junto (os ajustes de cada um ficam).</small>
                </div>
                <div class="ac-corpo" data-ac-corpo></div>
            </div>
        </div>`
    desenharCorpoAcessos()
}

async function trocarAbaAcessos(aba) {
    if (!(await descartarAlteracaoAcessos())) return
    estadoAcessos.aba = aba
    estadoAcessos.selecionado = null
    estadoAcessos.novoPerfil = false
    estadoAcessos.busca = ''
    desenharCentralAcessos()
}

async function descartarAlteracaoAcessos() {
    if (!estadoAcessos.alterado) return true
    const ok = await confirmarPopup({ titulo: 'Alterações não salvas', mensagem: 'Descartar as marcações que você mudou e não salvou?', textoConfirmar: 'Descartar' })
    if (ok) estadoAcessos.alterado = false
    return ok
}

function desenharCorpoAcessos() {
    const corpo = document.querySelector('[data-ac-corpo]')
    if (!corpo) return
    if (estadoAcessos.aba === 'historico') return desenharHistoricoAcessos(corpo)
    corpo.innerHTML = `
        <div class="ac-lista">
            <div class="ac-lista-topo">
                <input class="ac-input" placeholder="${estadoAcessos.aba === 'usuarios' ? 'Nome, usuário, perfil ou empresa…' : 'Perfil…'}"
                    value="${escAc(estadoAcessos.busca)}" oninput="estadoAcessos.busca = this.value; desenharListaAcessos()">
                ${estadoAcessos.aba === 'perfis' ? '<button type="button" onclick="abrirNovoPerfilAcessos()">+ Novo perfil</button>' : ''}
            </div>
            <div class="ac-itens" data-ac-lista></div>
        </div>
        <div class="ac-editor" data-ac-editor>
            <div class="ac-vazio">${estadoAcessos.aba === 'usuarios' ? 'Escolha um usuário na lista.' : 'Escolha um perfil na lista ou crie um novo.'}</div>
        </div>`
    desenharListaAcessos()
    if (estadoAcessos.selecionado || estadoAcessos.novoPerfil) desenharEditorAcessos()
}

const nomePerfilAcessos = codigo => estadoAcessos.perfis.find(p => p.perfil === codigo)?.nome || codigo || 'sem perfil'
const normalizarAc = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function desenharListaAcessos() {
    const alvo = document.querySelector('[data-ac-lista]')
    if (!alvo) return
    const busca = normalizarAc(estadoAcessos.busca)
    if (estadoAcessos.aba === 'usuarios') {
        const lista = estadoAcessos.usuarios.filter(u => !busca ||
            [u.nome, u.usuario, u.permissao, nomePerfilAcessos(u.permissao), u.empresa].some(c => normalizarAc(c).includes(busca)))
        alvo.innerHTML = lista.slice(0, 300).map(u => {
            const ajustes = (u.adicionados?.length || 0) + (u.removidos?.length || 0)
            return `
            <div class="ac-item ${estadoAcessos.selecionado === u.usuario ? 'ativo' : ''} ${u.desligado ? 'ac-desligado' : ''}"
                onclick="abrirUsuarioAcessos('${escAc(u.usuario)}')">
                <div class="ac-item-nome">${escAc(u.nome || u.usuario)}</div>
                <div class="ac-item-detalhe">
                    <span>${escAc(u.usuario)}</span>
                    <span class="ac-tag">${escAc(nomePerfilAcessos(u.permissao))}</span>
                    ${ajustes ? `<span class="ac-tag ac-ajuste" title="Ajustes em relação ao perfil">${ajustes} ajuste${ajustes > 1 ? 's' : ''}</span>` : ''}
                    ${u.desligado ? '<span class="ac-tag ac-menos">desligado</span>' : ''}
                </div>
            </div>`
        }).join('') + (lista.length > 300 ? `<small class="ac-mais-itens">Mais ${lista.length - 300}: refine a busca.</small>` : '')
            || '<div class="ac-vazio">Ninguém encontrado.</div>'
        return
    }
    const lista = estadoAcessos.perfis.filter(p => !busca || [p.perfil, p.nome].some(c => normalizarAc(c).includes(busca)))
    alvo.innerHTML = lista.map(p => `
        <div class="ac-item ${estadoAcessos.selecionado === p.perfil ? 'ativo' : ''}" onclick="abrirPerfilAcessos('${escAc(p.perfil)}')">
            <div class="ac-item-nome">${escAc(p.nome)}</div>
            <div class="ac-item-detalhe">
                <span>${escAc(p.perfil)}</span>
                <span class="ac-tag">${Number(p.usuarios) || 0} usuário(s)</span>
                <span class="ac-tag">${p.itens.length} marcação(ões)</span>
            </div>
        </div>`).join('') || '<div class="ac-vazio">Nenhum perfil.</div>'
}

async function abrirUsuarioAcessos(login) {
    if (estadoAcessos.selecionado === login && !estadoAcessos.novoPerfil) return
    if (!(await descartarAlteracaoAcessos())) return
    const u = estadoAcessos.usuarios.find(x => x.usuario === login)
    if (!u) return
    estadoAcessos.selecionado = login
    estadoAcessos.novoPerfil = false
    estadoAcessos.perfilEditor = u.permissao
    estadoAcessos.marcados = efetivoUsuarioAcessos(u.permissao, u.adicionados, u.removidos)
    estadoAcessos.alterado = false
    desenharListaAcessos()
    desenharEditorAcessos()
}

async function abrirPerfilAcessos(codigo) {
    if (estadoAcessos.selecionado === codigo && !estadoAcessos.novoPerfil) return
    if (!(await descartarAlteracaoAcessos())) return
    const p = estadoAcessos.perfis.find(x => x.perfil === codigo)
    if (!p) return
    estadoAcessos.selecionado = codigo
    estadoAcessos.novoPerfil = false
    estadoAcessos.marcados = new Set(p.itens)
    estadoAcessos.alterado = false
    desenharListaAcessos()
    desenharEditorAcessos()
}

async function abrirNovoPerfilAcessos() {
    if (!(await descartarAlteracaoAcessos())) return
    estadoAcessos.selecionado = null
    estadoAcessos.novoPerfil = true
    estadoAcessos.marcados = new Set()
    estadoAcessos.alterado = false
    desenharListaAcessos()
    desenharEditorAcessos()
}

const itensDoPerfilAcessos = codigo => new Set(estadoAcessos.perfis.find(p => p.perfil === codigo)?.itens || [])

// Igual ao servidor: função só vale com a tela de cima.
function efetivarAcessos(conjunto) {
    const ok = new Set()
    for (const chave of conjunto) {
        const item = estadoAcessos.itens.get(chave)
        if (!item || item.tipo === 'modulo') continue
        let pai = item.pai, valido = true
        while (pai) {
            const p = estadoAcessos.itens.get(pai)
            if (p.tipo !== 'modulo' && !conjunto.has(pai)) { valido = false; break }
            pai = p.pai
        }
        if (valido) ok.add(chave)
    }
    return ok
}

function efetivoUsuarioAcessos(perfil, adicionados = [], removidos = []) {
    const conjunto = itensDoPerfilAcessos(perfil)
    adicionados.forEach(c => conjunto.add(c))
    removidos.forEach(c => conjunto.delete(c))
    return efetivarAcessos(conjunto)
}

function desenharEditorAcessos() {
    const alvo = document.querySelector('[data-ac-editor]')
    if (!alvo) return
    const ehUsuario = estadoAcessos.aba === 'usuarios'
    let cabecalho = ''
    if (ehUsuario) {
        const u = estadoAcessos.usuarios.find(x => x.usuario === estadoAcessos.selecionado)
        const base = itensDoPerfilAcessos(estadoAcessos.perfilEditor)
        const mais = [...estadoAcessos.marcados].filter(c => !base.has(c)).length
        const menos = [...base].filter(c => !estadoAcessos.marcados.has(c)).length
        cabecalho = `
            <div class="ac-editor-topo">
                <div>
                    <div class="ac-editor-titulo">${escAc(u?.nome || u?.usuario)}</div>
                    <small>${escAc(u?.usuario)}${u?.empresa ? ` · ${escAc(u.empresa)}` : ''}</small>
                </div>
                <label class="ac-campo">Perfil
                    <select class="ac-input" onchange="trocarPerfilUsuarioAcessos(this.value)">
                        ${estadoAcessos.perfis.map(p => `<option value="${escAc(p.perfil)}" ${p.perfil === estadoAcessos.perfilEditor ? 'selected' : ''}>${escAc(p.nome)}</option>`).join('')}
                        <option value="desativado" ${estadoAcessos.perfilEditor === 'desativado' ? 'selected' : ''}>Desativado (sem acesso)</option>
                    </select>
                </label>
            </div>
            <div class="ac-resumo">
                ${mais || menos
                    ? `Segue o perfil <b>${escAc(nomePerfilAcessos(estadoAcessos.perfilEditor))}</b> com ajustes:
                       ${mais ? `<span class="ac-tag ac-mais">+${mais} a mais</span>` : ''}
                       ${menos ? `<span class="ac-tag ac-menos">−${menos} a menos</span>` : ''}
                       <button type="button" class="ac-link" onclick="voltarAoPerfilAcessos()">Voltar ao perfil</button>`
                    : `Igual ao perfil <b>${escAc(nomePerfilAcessos(estadoAcessos.perfilEditor))}</b>, sem ajustes.`}
            </div>`
    } else {
        const p = estadoAcessos.perfis.find(x => x.perfil === estadoAcessos.selecionado)
        const novo = estadoAcessos.novoPerfil
        cabecalho = `
            <div class="ac-editor-topo ac-perfil-campos">
                <label class="ac-campo">Nome
                    <input class="ac-input" data-ac-nome value="${escAc(p?.nome || '')}" oninput="estadoAcessos.alterado = true" placeholder="Ex.: Compras">
                </label>
                <label class="ac-campo">Código ${novo ? '' : '(fixo)'}
                    <input class="ac-input" data-ac-codigo value="${escAc(p?.perfil || '')}" ${novo ? '' : 'disabled'} placeholder="ex.: compras">
                </label>
                ${novo ? `
                <label class="ac-campo">Começar igual a
                    <select class="ac-input" data-ac-copiar onchange="copiarPerfilAcessos(this.value)">
                        <option value="">(vazio)</option>
                        ${estadoAcessos.perfis.map(x => `<option value="${escAc(x.perfil)}">${escAc(x.nome)}</option>`).join('')}
                    </select>
                    <small>Também copia o acesso às bases de dados desse perfil.</small>
                </label>` : ''}
                <label class="ac-campo ac-campo-largo">Descrição
                    <input class="ac-input" data-ac-descricao value="${escAc(p?.descricao || '')}" oninput="estadoAcessos.alterado = true" placeholder="Para que serve este perfil">
                </label>
            </div>
            ${novo ? '' : `<div class="ac-resumo">${Number(p?.usuarios) || 0} usuário(s) com este perfil recebem a mudança ao salvar.</div>`}`
    }
    const semAcesso = ehUsuario && estadoAcessos.perfilEditor === 'desativado'
    alvo.innerHTML = `
        ${cabecalho}
        <div class="ac-arvore-topo">
            <input class="ac-input" placeholder="Procurar tela ou função…" value="${escAc(estadoAcessos.buscaArvore)}"
                oninput="estadoAcessos.buscaArvore = this.value; desenharArvoreAcessos()">
            <button type="button" class="ac-link" onclick="expandirArvoreAcessos(true)">Abrir tudo</button>
            <button type="button" class="ac-link" onclick="expandirArvoreAcessos(false)">Fechar tudo</button>
            <button type="button" class="ac-link" onclick="marcarTudoAcessos(true)">Marcar tudo</button>
            <button type="button" class="ac-link" onclick="marcarTudoAcessos(false)">Desmarcar tudo</button>
        </div>
        <div class="ac-arvore ${semAcesso ? 'ac-bloqueada' : ''}" data-ac-arvore></div>
        <div class="ac-rodape">
            ${!ehUsuario && !estadoAcessos.novoPerfil ? '<button type="button" class="ac-perigo" onclick="excluirPerfilAcessos()">Excluir perfil</button>' : ''}
            <button type="button" onclick="salvarEditorAcessos()">Salvar</button>
        </div>`
    desenharArvoreAcessos()
}

function trocarPerfilUsuarioAcessos(perfil) {
    estadoAcessos.perfilEditor = perfil
    // Troca de perfil começa limpa: as marcações do novo perfil, sem ajustes.
    estadoAcessos.marcados = perfil === 'desativado' ? new Set() : itensDoPerfilAcessos(perfil)
    estadoAcessos.alterado = true
    desenharEditorAcessos()
}

function voltarAoPerfilAcessos() {
    estadoAcessos.marcados = itensDoPerfilAcessos(estadoAcessos.perfilEditor)
    estadoAcessos.alterado = true
    desenharEditorAcessos()
}

function copiarPerfilAcessos(codigo) {
    estadoAcessos.marcados = codigo ? itensDoPerfilAcessos(codigo) : new Set()
    estadoAcessos.alterado = true
    desenharArvoreAcessos()
}

// ---------- árvore

const descendentesAcessos = chave => {
    const saida = []
    for (const f of estadoAcessos.itens.get(chave)?.filhos || []) saida.push(f, ...descendentesAcessos(f))
    return saida
}
const permissoesSobAcessos = chave => descendentesAcessos(chave).filter(c => estadoAcessos.itens.get(c).tipo !== 'modulo')

function situacaoNoAcessos(chave) {
    const item = estadoAcessos.itens.get(chave)
    const abaixo = permissoesSobAcessos(chave)
    if (item.tipo === 'modulo') {
        const n = abaixo.filter(c => estadoAcessos.marcados.has(c)).length
        return { marcado: n > 0 && n === abaixo.length, parcial: n > 0 && n < abaixo.length }
    }
    const marcado = estadoAcessos.marcados.has(chave)
    return { marcado, parcial: marcado && abaixo.some(c => !estadoAcessos.marcados.has(c)) }
}

function alternarAcesso(chave, marcar) {
    const item = estadoAcessos.itens.get(chave)
    const alvo = item.tipo === 'modulo' ? permissoesSobAcessos(chave) : [chave, ...permissoesSobAcessos(chave)]
    if (marcar) {
        alvo.forEach(c => estadoAcessos.marcados.add(c))
        // Marcar uma função marca a tela de cima (sem ela a função não vale).
        let pai = item.pai
        while (pai) {
            if (estadoAcessos.itens.get(pai).tipo !== 'modulo') estadoAcessos.marcados.add(pai)
            pai = estadoAcessos.itens.get(pai).pai
        }
    } else {
        alvo.forEach(c => estadoAcessos.marcados.delete(c))
    }
    estadoAcessos.alterado = true
    desenharArvoreAcessos()
    if (estadoAcessos.aba === 'usuarios') atualizarResumoUsuarioAcessos()
}

function atualizarResumoUsuarioAcessos() {
    // Redesenha só o resumo de ajustes (sem perder o foco da busca).
    const resumo = document.querySelector('[data-ac-editor] .ac-resumo')
    if (!resumo) return
    const base = itensDoPerfilAcessos(estadoAcessos.perfilEditor)
    const mais = [...estadoAcessos.marcados].filter(c => !base.has(c)).length
    const menos = [...base].filter(c => !estadoAcessos.marcados.has(c)).length
    resumo.innerHTML = mais || menos
        ? `Segue o perfil <b>${escAc(nomePerfilAcessos(estadoAcessos.perfilEditor))}</b> com ajustes:
           ${mais ? `<span class="ac-tag ac-mais">+${mais} a mais</span>` : ''}
           ${menos ? `<span class="ac-tag ac-menos">−${menos} a menos</span>` : ''}
           <button type="button" class="ac-link" onclick="voltarAoPerfilAcessos()">Voltar ao perfil</button>`
        : `Igual ao perfil <b>${escAc(nomePerfilAcessos(estadoAcessos.perfilEditor))}</b>, sem ajustes.`
}

function expandirArvoreAcessos(abrir) {
    estadoAcessos.abertos = abrir ? new Set([...estadoAcessos.itens.values()].filter(i => i.filhos.length).map(i => i.chave)) : new Set()
    desenharArvoreAcessos()
}

function marcarTudoAcessos(marcar) {
    estadoAcessos.marcados = marcar
        ? new Set([...estadoAcessos.itens.values()].filter(i => i.tipo !== 'modulo').map(i => i.chave))
        : new Set()
    estadoAcessos.alterado = true
    desenharArvoreAcessos()
    if (estadoAcessos.aba === 'usuarios') atualizarResumoUsuarioAcessos()
}

function alternarAbertoAcessos(chave) {
    estadoAcessos.abertos.has(chave) ? estadoAcessos.abertos.delete(chave) : estadoAcessos.abertos.add(chave)
    desenharArvoreAcessos()
}

function desenharArvoreAcessos() {
    const alvo = document.querySelector('[data-ac-arvore]')
    if (!alvo) return
    const busca = normalizarAc(estadoAcessos.buscaArvore)
    const base = estadoAcessos.aba === 'usuarios' ? itensDoPerfilAcessos(estadoAcessos.perfilEditor) : null
    // Na busca: mostra quem bate e o caminho até ele, tudo aberto.
    const visiveis = busca
        ? new Set([...estadoAcessos.itens.values()]
            .filter(i => normalizarAc(i.caminho.join(' ')).includes(busca))
            .flatMap(i => { const l = [i.chave]; let p = i.pai; while (p) { l.push(p); p = estadoAcessos.itens.get(p).pai } return [...l, ...descendentesAcessos(i.chave)] }))
        : null

    const no = (chave, nivel) => {
        if (visiveis && !visiveis.has(chave)) return ''
        const item = estadoAcessos.itens.get(chave)
        const { marcado, parcial } = situacaoNoAcessos(chave)
        const temFilhos = item.filhos.length > 0
        const aberto = busca || estadoAcessos.abertos.has(chave)
        let marca = ''
        if (base && item.tipo !== 'modulo') {
            if (marcado && !base.has(chave)) marca = '<span class="ac-tag ac-mais">+ a mais</span>'
            if (!marcado && base.has(chave)) marca = '<span class="ac-tag ac-menos">− a menos</span>'
        }
        const tipo = { modulo: 'Módulo', tela: 'Tela', funcao: 'Função' }[item.tipo]
        const id = `ac_${chave.replace(/[^a-z0-9]/gi, '_')}`
        return `
            <div class="ac-no ac-${item.tipo}" style="--nivel:${nivel}">
                <span class="ac-seta ${temFilhos ? '' : 'ac-sem-filhos'}" onclick="alternarAbertoAcessos('${chave}')">${temFilhos ? (aberto ? '▾' : '▸') : ''}</span>
                <input type="checkbox" id="${id}" ${marcado ? 'checked' : ''} data-parcial="${parcial ? 1 : 0}"
                    onchange="alternarAcesso('${chave}', this.checked)">
                <label for="${id}">${escAc(item.nome)}</label>
                <span class="ac-tipo">${tipo}</span>
                ${marca}
                ${item.descricao ? `<small class="ac-descricao">${escAc(item.descricao)}</small>` : ''}
            </div>
            ${temFilhos && aberto ? item.filhos.map(f => no(f, nivel + 1)).join('') : ''}`
    }
    alvo.innerHTML = estadoAcessos.catalogo.map(m => no(m.chave, 0)).join('') || '<div class="ac-vazio">Nada encontrado.</div>'
    alvo.querySelectorAll('input[data-parcial="1"]').forEach(c => { c.indeterminate = true })
}

// ---------- salvar

async function salvarEditorAcessos() {
    const itens = [...estadoAcessos.marcados]
    overlayAguarde()
    try {
        if (estadoAcessos.aba === 'usuarios') {
            const login = estadoAcessos.selecionado
            await apiAcessos('usuario/salvar', { usuario: login, perfil: estadoAcessos.perfilEditor, itens })
            const { usuarios } = await apiAcessos('usuarios')
            estadoAcessos.usuarios = usuarios
            const u = usuarios.find(x => x.usuario === login)
            estadoAcessos.marcados = efetivoUsuarioAcessos(u.permissao, u.adicionados, u.removidos)
        } else {
            const novo = estadoAcessos.novoPerfil
            const perfil = novo ? document.querySelector('[data-ac-codigo]')?.value : estadoAcessos.selecionado
            await apiAcessos('perfil/salvar', {
                perfil, novo,
                nome: document.querySelector('[data-ac-nome]')?.value,
                descricao: document.querySelector('[data-ac-descricao]')?.value,
                copiarDe: novo ? document.querySelector('[data-ac-copiar]')?.value || null : null,
                itens
            })
            const { perfis } = await apiAcessos('catalogo')
            estadoAcessos.perfis = perfis
            estadoAcessos.selecionado = String(perfil).trim().toLowerCase()
            estadoAcessos.novoPerfil = false
            estadoAcessos.marcados = itensDoPerfilAcessos(estadoAcessos.selecionado)
        }
        estadoAcessos.alterado = false
        removerOverlay()
        desenharListaAcessos()
        desenharEditorAcessos()
        popup({ mensagem: 'Acessos salvos. Quem estiver conectado recebe a mudança na hora.', tempo: 3 })
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

async function excluirPerfilAcessos() {
    const p = estadoAcessos.perfis.find(x => x.perfil === estadoAcessos.selecionado)
    if (!p) return
    const ok = await confirmarPopup({ titulo: 'Excluir perfil', mensagem: `Excluir o perfil <b>${escAc(p.nome)}</b>? Só dá se ninguém estiver usando.`, textoConfirmar: 'Excluir' })
    if (!ok) return
    overlayAguarde()
    try {
        await apiAcessos('perfil/excluir', { perfil: p.perfil })
        const { perfis } = await apiAcessos('catalogo')
        estadoAcessos.perfis = perfis
        estadoAcessos.selecionado = null
        estadoAcessos.alterado = false
        removerOverlay()
        desenharCorpoAcessos()
    } catch (erro) {
        removerOverlay()
        popup({ mensagem: erro.message })
    }
}

// ---------- histórico

async function desenharHistoricoAcessos(corpo) {
    corpo.innerHTML = '<div class="ac-vazio">Carregando…</div>'
    try {
        const { historico } = await apiAcessos('historico')
        const nome = c => estadoAcessos.itens.get(c)?.caminho.join(' › ') || c
        const diferenca = (antes, depois) => {
            const a = new Set([...(antes?.itens || []), ...(antes?.adicionados || [])])
            const d = new Set([...(depois?.itens || []), ...(depois?.adicionados || [])])
            const ra = new Set(antes?.removidos || []), rd = new Set(depois?.removidos || [])
            const linhas = []
            if (antes?.perfil !== depois?.perfil && (antes?.perfil || depois?.perfil))
                linhas.push(`Perfil: ${escAc(nomePerfilAcessos(antes?.perfil))} → <b>${escAc(nomePerfilAcessos(depois?.perfil))}</b>`)
            for (const c of d) if (!a.has(c)) linhas.push(`<span class="ac-tag ac-mais">+</span> ${escAc(nome(c))}`)
            for (const c of a) if (!d.has(c)) linhas.push(`<span class="ac-tag ac-menos">−</span> ${escAc(nome(c))}`)
            for (const c of rd) if (!ra.has(c)) linhas.push(`<span class="ac-tag ac-menos">tirado</span> ${escAc(nome(c))}`)
            for (const c of ra) if (!rd.has(c)) linhas.push(`<span class="ac-tag ac-mais">devolvido</span> ${escAc(nome(c))}`)
            if (!depois) linhas.push('Perfil excluído')
            if (!antes) linhas.push('Criado')
            return linhas.join('<br>') || 'Sem diferença nas marcações'
        }
        corpo.innerHTML = `
            <div class="ac-historico">
                ${historico.map(h => `
                    <div class="ac-hist-item">
                        <div><b>${escAc(h.alvo_tipo === 'perfil' ? `Perfil ${nomePerfilAcessos(h.alvo)}` : h.alvo)}</b>
                            <small>por ${escAc(h.por)} em ${new Date(h.em).toLocaleString('pt-BR')}</small></div>
                        <div class="ac-hist-dif">${diferenca(h.antes, h.depois)}</div>
                    </div>`).join('') || '<div class="ac-vazio">Nenhuma mudança registrada ainda.</div>'}
            </div>`
    } catch (erro) {
        corpo.innerHTML = `<div class="ac-vazio">${escAc(erro.message)}</div>`
    }
}

// Atalho do cadastro (js/clientes.js): abre a central já no usuário.
async function abrirAcessosDoUsuario(login) {
    removerTodosPopups()
    estadoAcessos.aba = 'usuarios'
    await telaCentralAcessos()
    if (login) {
        estadoAcessos.busca = login
        desenharCorpoAcessos()
        abrirUsuarioAcessos(login)
    }
}
