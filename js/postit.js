// Quadro fixo dos concluídos (não existe na tabela quadros, como o "Novos").
// Concluir leva o post-it para ele; reabrir ou tirar de lá devolve para "Novos"/aberto.
const QUADRO_CONCLUIDO_PIT = 'CONCLUIDO'

async function telaPIT() {

    const acumulado = `
        <div class="scroll-content tela-postits">
            <div class="postits-toolbar">
                <div><h2>Post-its</h2><p>Organize suas tarefas e arraste os cartões entre os quadros.</p></div>
                <div class="postits-acoes">
                    <button type="button" class="postits-adicionar" onclick="criarPIT()">Post-it</button>
                    <button type="button" class="postits-adicionar" onclick="criarQuadro()">Quadro</button>
                </div>
            </div>
            <div class="contorno-quadros">
                <div id="quadros" class="tabela-atras-postit"></div>
            </div>
        </div>
    `

    tela.innerHTML = acumulado

    await criarQuadros()
}

async function criarQuadros() {

    const telaPIT = document.querySelector('#quadros')

    const pesqQuadros = await pesquisarDB({
        base: 'quadros',
        filtros: {
            usuario: { op: '=', value: acesso.usuario }
        }
    })

    // Fixos: "Novos" sempre em primeiro e "Concluídos" sempre no fim; os do usuário ficam no meio.
    const quadros = [
        { id: null, ordem: 0, descricao: 'Novos', fixo: true },
        ...(pesqQuadros?.resultados || []).sort((a, b) => Number(a.ordem) - Number(b.ordem)),
        { id: QUADRO_CONCLUIDO_PIT, descricao: 'Concluídos', fixo: true }
    ]

    // Todos os quadros de vez;
    const quadrosEmMassa = quadros.map(async q => {

        const { id, descricao, ordem, fixo } = q || {}
        const chave = id || 'Novos'

        // Reserva a posição antes das consultas assíncronas.
        const coluna = document.createElement('div')
        coluna.className = `postits-coluna${fixo ? ' fixo' : ''}`
        coluna.dataset.quadro = id || ''
        coluna.dataset.ordem = ordem ?? ''
        if (fixo) coluna.dataset.fixo = '1'
        coluna.ondragover = sobreQuadroPIT
        coluna.ondrop = soltarQuadroPIT
        telaPIT.appendChild(coluna)

        const editar = !fixo
            ? `<img src="imagens/pesquisar.svg" title="Editar quadro" draggable="false" onclick="criarQuadro('${id}')">`
            : ''

        // Os fixos não se movem; os demais são arrastados pelo título.
        const arrastar = !fixo
            ? `draggable="true" title="Segure e arraste para reorganizar" ondragstart="arrastarQuadroPIT(event)" ondragend="finalizarQuadroPIT()"`
            : id === QUADRO_CONCLUIDO_PIT
                ? `title="Quadro fixo: o post-it concluído vem para cá e, reaberto, volta para Novos"`
                : ''

        const btnExtras = `
            <div class="postits-titulo-quadro${!fixo ? ' arrastavel' : ''}" ${arrastar}>
                <span>${descricao}</span>
                ${editar}
            </div>
            `

        const pag = `pit_${chave}`
        const quadro = await modTab({
            btnExtras,
            ocultarPesquisa: true,
            scroll: false,
            base: 'postit',
            pag,
            body: `body_${chave}`,
            criarLinha: 'linPostIT',
            // Ordem fixa: só muda arrastando (salvar não faz o cartão subir).
            ordenar: [
                { path: 'ordem', direcao: 'asc', tipo: 'number' },
                { path: 'timestamp', direcao: 'desc' }
            ],
            filtros: {
                usuario: {
                    op: '=',
                    value: acesso.usuario
                },
                quadro: id
                    ? {
                        op: '=',
                        value: id || null
                    }
                    : {
                        op: 'IS_EMPTY'
                    }
            }
        })

        coluna.innerHTML = quadro

        await paginacao(pag)

    })

    await Promise.all(quadrosEmMassa)

    for (const q of quadros) {
        const chave = q?.id || 'Novos'
        const body = document.getElementById(`body_${chave}`)
        if (!body) continue

        body.dataset.quadro = q?.id || ''
        body.ondragover = permitirDropPIT
        body.ondragleave = sairDropPIT
        body.ondrop = soltarPIT
    }

}

// Formatação que o editor gera (negrito, itálico, sublinhado, listas, cor, quebras de linha).
const tagsPostIT = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P', 'SPAN', 'FONT', 'H1', 'H2', 'H3', 'BLOCKQUOTE'])
const estilosPostIT = ['color', 'background-color', 'font-weight', 'font-style', 'text-decoration']

// O post-it pode ser de outro usuário: mantém só a formatação, sem scripts, eventos ou links.
function limparHtmlPostIT(no) {
    for (const filho of [...no.childNodes]) {
        if (filho.nodeType === Node.TEXT_NODE)
            continue

        if (filho.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(filho.tagName)) {
            filho.remove()
            continue
        }

        limparHtmlPostIT(filho)

        // Tag fora da lista: fica só o conteúdo.
        if (!tagsPostIT.has(filho.tagName)) {
            filho.replaceWith(...filho.childNodes)
            continue
        }

        const cor = filho.getAttribute('color')
        const estilos = estilosPostIT
            .map(prop => [prop, filho.style.getPropertyValue(prop)])
            .filter(([, valor]) => valor)

        for (const { name } of [...filho.attributes])
            filho.removeAttribute(name)

        if (cor && /^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(cor))
            filho.setAttribute('color', cor)

        for (const [prop, valor] of estilos)
            filho.style.setProperty(prop, valor)
    }
}

function comentarioPostIT(comentario) {
    const texto = String(comentario || '')

    // Post-its antigos em texto puro mantêm as quebras de linha.
    if (!/<[a-z/!]/i.test(texto))
        return `<div class="postit-comentario texto-simples">${escaparAtributo(texto)}</div>`

    const doc = new DOMParser().parseFromString(`<div>${texto}</div>`, 'text/html')
    const raiz = doc.body.firstElementChild
    limparHtmlPostIT(raiz)

    return `<div class="postit-comentario">${raiz.innerHTML}</div>`
}

// Último estado de cada post-it na tela. As ações mudam o cartão na hora e o servidor
// confirma em segundo plano; se ele recusar, a tela volta ao que era e avisa.
const postitsPIT = new Map()

function linhaPIT(id) {
    return document.querySelector(`#quadros tr[data-pit="${CSS.escape(id)}"]`)
}

// Guarda onde a linha estava para recolocá-la se o servidor recusar.
function posicaoPIT(linha) {
    const pai = linha?.parentElement
    const proxima = linha?.nextElementSibling
    return () => {
        if (!linha || !pai?.isConnected) return
        pai.insertBefore(linha, proxima?.parentElement === pai ? proxima : null)
    }
}

function falhaPIT(acao, resposta) {
    popup({ mensagem: `Não foi possível ${acao}: ${resposta?.mensagem || 'sem resposta do servidor'}. O post-it voltou ao que era.` })
}

async function linPostIT(dados) {

    const {
        id, 
        comentario, 
        prazo, 
        status,
        anexos
    } = dados || {}

    if (id) postitsPIT.set(id, dados)

    const divAnexos = Object
        .entries(anexos || {})
        .map(([, anexo]) => criarAnexoVisual(anexo.nome, anexo.link))
        .join('')

    const prazoFin = prazo
        ? new Date(toTimestamp(prazo)).toLocaleDateString()
        : ''

    // Sem prazo vem antes do atraso: sem data, a comparação abaixo dava sempre "atrasado".
    const estilo = status == 'S'
        ? 'concluido'
        : !prazo
            ? 'sem-prazo'
            // Se hoje é maior que o prazo, então tá atrasado;
            : agoraServidor() > toTimestamp(prazo)
                ? 'atrasado'
                : ''

    return `
    <tr data-pit="${id}">
        <td>
            <div
                class="postit ${estilo}"
                draggable="true"
                title="Clique para ver o resumo"
                onclick="resumoPIT('${id}')"
                ondragstart="arrastarPIT(event, '${id}')">
                ${comentarioPostIT(comentario)}
                <div class="local-anexos" onclick="event.stopPropagation()">${divAnexos || ''}</div>
                <span class="prazo">${prazoFin ? `<b>Prazo:</b> ${prazoFin}` : 'Sem prazo'}</span>
                <div class="postit-botoes">
                    <button type="button" class="postit-concluir${status == 'S' ? ' marcado' : ''}"
                        title="${status == 'S' ? 'Concluído — clique para reabrir' : 'Marcar como concluído'}"
                        onclick="event.stopPropagation(); alternarConcluidoPIT('${id}')">✓</button>
                    <img class="postit-editar" src="imagens/pesquisar.svg" title="Editar post-it" onclick="event.stopPropagation(); criarPIT('${id}')">
                </div>
            </div>
        </td>
    </tr>
    `
}

let pitAutoScroll = null
let pitArrastado = null

function arrastarPIT(event, id) {
    event.dataTransfer.setData('text/plain', id)
    pitArrastado = id
    iniciarAutoScrollPIT()
    const cartao = event.currentTarget
    requestAnimationFrame(() => cartao.classList.add('arrastando'))
    cartao.addEventListener('dragend', () => {
        cartao.classList.remove('arrastando')
        pitArrastado = null
        limparMarcaDropPIT()
    }, { once: true })
}

function ordemPIT(linha) {
    const valor = postitsPIT.get(linha?.dataset.pit)?.ordem
    return valor === null || valor === undefined || valor === '' ? null : Number(valor)
}

// Linha antes da qual o cartão entra, pela altura do cursor (null = fim do quadro).
function referenciaDropPIT(tbody, y) {
    const linhas = [...tbody.querySelectorAll(':scope > tr[data-pit]')]
        .filter(linha => linha.dataset.pit !== pitArrastado)
    return linhas.find(linha => {
        const rect = linha.getBoundingClientRect()
        return y < rect.top + rect.height / 2
    }) || null
}

function limparMarcaDropPIT() {
    document.querySelectorAll('#quadros .pit-soltar-antes').forEach(el => el.classList.remove('pit-soltar-antes'))
    document.querySelectorAll('#quadros .pit-soltar-fim').forEach(el => el.classList.remove('pit-soltar-fim'))
}

function permitirDropPIT(event) {
    event.preventDefault()
    if (!pitArrastado) return

    // Linha que mostra onde o cartão vai entrar.
    const tbody = event.currentTarget
    const referencia = referenciaDropPIT(tbody, event.clientY)
    limparMarcaDropPIT()
    if (referencia) referencia.classList.add('pit-soltar-antes')
    else tbody.classList.add('pit-soltar-fim')
}

function sairDropPIT(event) {
    if (!event.currentTarget.contains(event.relatedTarget))
        limparMarcaDropPIT()
}

// Ordem entre os vizinhos; um número só para o cartão movido, os outros não mudam.
function ordemEntrePIT(anterior, proxima) {
    const a = ordemPIT(anterior)
    const p = ordemPIT(proxima)
    if (a !== null && p !== null) return (a + p) / 2
    if (a !== null) return a + 1
    if (p !== null) return p - 1
    return 1
}

async function soltarPIT(event) {
    event.preventDefault()
    pararAutoScrollPIT()
    limparMarcaDropPIT()

    const id = event.dataTransfer.getData('text/plain')
    const linha = id && linhaPIT(id)
    if (!linha) return

    const destino = event.currentTarget
    const quadro = destino.dataset.quadro || null
    const quadroAntes = linha.parentElement.dataset.quadro || null
    const referencia = referenciaDropPIT(destino, event.clientY)

    // Soltou no mesmo lugar.
    if (quadroAntes == quadro && (referencia === linha.nextElementSibling || referencia === linha))
        return

    const dados = postitsPIT.get(id)
    const ordemAntes = dados?.ordem ?? null
    const statusAntes = dados?.status ?? 'N'
    const voltar = posicaoPIT(linha)
    destino.insertBefore(linha, referencia)

    // Entrar em "Concluídos" conclui; sair de lá reabre.
    const status = quadro === QUADRO_CONCLUIDO_PIT
        ? 'S'
        : quadroAntes === QUADRO_CONCLUIDO_PIT ? 'N' : statusAntes

    const ordem = ordemEntrePIT(linha.previousElementSibling?.matches('tr[data-pit]') ? linha.previousElementSibling : null, referencia)
    if (dados) {
        dados.quadro = quadro
        dados.ordem = ordem
        dados.status = status
    }
    if (status != statusAntes) await redesenharLinhaPIT(linha, dados)

    const desfazer = async resposta => {
        voltar()
        if (dados) {
            dados.quadro = quadroAntes
            dados.ordem = ordemAntes
            dados.status = statusAntes
        }
        if (status != statusAntes) await redesenharLinhaPIT(linha, dados)
        falhaPIT('mover o post-it', resposta)
    }

    if (quadroAntes != quadro) {
        const resposta = await enviar(`postit/${id}/quadro`, quadro)
        if (!resposta?.success) return desfazer(resposta)
    }

    if (status != statusAntes) {
        const resposta = await enviar(`postit/${id}/status`, status)
        if (!resposta?.success) return desfazer(resposta)
    }

    const resposta = await enviar(`postit/${id}/ordem`, ordem)
    if (!resposta?.success) return desfazer(resposta)

    if (status != statusAntes) verificarPostIts()
}

// Troca o conteúdo do cartão mantendo a mesma linha (o desfazer guarda a referência dela).
async function redesenharLinhaPIT(linha, dados) {
    if (!linha || !dados) return
    const molde = document.createElement('tbody')
    molde.innerHTML = await linPostIT(dados)
    const nova = molde.firstElementChild
    if (nova) linha.innerHTML = nova.innerHTML
}

let quadroArrastadoPIT = null

function arrastarQuadroPIT(event) {
    const coluna = event.currentTarget.closest('.postits-coluna')
    if (!coluna) return

    quadroArrastadoPIT = coluna
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-quadro', coluna.dataset.quadro)
    event.dataTransfer.setDragImage(coluna, 40, 20)

    // Depois do frame, para a imagem do arraste não sair esmaecida.
    requestAnimationFrame(() => coluna.classList.add('arrastando'))
    iniciarAutoScrollPIT()
}

// Move a coluna enquanto o cursor passa sobre as outras; post-its arrastados são ignorados.
function sobreQuadroPIT(event) {
    const arrastado = quadroArrastadoPIT
    if (!arrastado) return
    event.preventDefault()

    const alvo = event.currentTarget
    if (alvo === arrastado) return

    const rect = alvo.getBoundingClientRect()
    // Nada entra antes de "Novos" nem depois de "Concluídos".
    const depois = alvo.dataset.quadro === QUADRO_CONCLUIDO_PIT
        ? false
        : !alvo.dataset.quadro || event.clientX > rect.left + rect.width / 2
    const referencia = depois ? alvo.nextElementSibling : alvo

    if (referencia !== arrastado && referencia !== arrastado.nextElementSibling)
        alvo.parentNode.insertBefore(arrastado, referencia)
}

function soltarQuadroPIT(event) {
    if (quadroArrastadoPIT)
        event.preventDefault()
}

async function finalizarQuadroPIT() {
    const arrastado = quadroArrastadoPIT
    quadroArrastadoPIT = null
    pararAutoScrollPIT()
    if (!arrastado) return

    arrastado.classList.remove('arrastando')

    const colunas = [...document.querySelectorAll('#quadros .postits-coluna')]
        .filter(coluna => coluna.dataset.quadro && !coluna.dataset.fixo)

    for (const [indice, coluna] of colunas.entries()) {
        const ordem = indice + 1
        if (coluna.dataset.ordem === String(ordem)) continue

        coluna.dataset.ordem = ordem
        const resposta = await enviar(`quadros/${coluna.dataset.quadro}/ordem`, ordem)
        if (!resposta?.success) {
            popup({ mensagem: `Não foi possível salvar a nova ordem dos quadros: ${resposta?.mensagem || 'sem resposta do servidor'}.` })
            return telaPIT()
        }
    }
}

function iniciarAutoScrollPIT() {
    const contorno = document.querySelector('.tela-postits')?.closest('.tela')
    if (!contorno) return

    pararAutoScrollPIT()

    pitAutoScroll = {
        ativo: true,
        x: 0,
        y: 0,
        elemento: contorno
    }

    document.addEventListener('dragover', atualizarAutoScrollPIT)
    document.addEventListener('dragend', pararAutoScrollPIT)
    document.addEventListener('drop', pararAutoScrollPIT)

    loopAutoScrollPIT()
}

function atualizarAutoScrollPIT(event) {
    if (!pitAutoScroll?.ativo) return

    pitAutoScroll.x = event.clientX
    pitAutoScroll.y = event.clientY
}

function loopAutoScrollPIT() {
    if (!pitAutoScroll?.ativo) return

    const { elemento, x, y } = pitAutoScroll
    const rect = elemento.getBoundingClientRect()

    const margem = 80
    const velocidade = 18

    if (x < rect.left + margem)
        elemento.scrollLeft -= velocidade
    else if (x > rect.right - margem)
        elemento.scrollLeft += velocidade

    if (y < rect.top + margem)
        elemento.scrollTop -= velocidade
    else if (y > rect.bottom - margem)
        elemento.scrollTop += velocidade

    requestAnimationFrame(loopAutoScrollPIT)
}

function pararAutoScrollPIT() {
    if (!pitAutoScroll) return

    pitAutoScroll.ativo = false
    pitAutoScroll = null

    document.removeEventListener('dragover', atualizarAutoScrollPIT)
    document.removeEventListener('dragend', pararAutoScrollPIT)
    document.removeEventListener('drop', pararAutoScrollPIT)
}

async function criarQuadro(id) {

    const { descricao } = await recuperarDado('quadros', id) || {}

    // A ordem é definida arrastando os quadros pelo título.
    const linhas = [
        {
            texto: 'Nome do Quadro',
            elemento: `<textarea name="descricao">${descricao || ''}</textarea>`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao: id
                ? `salvarQuadro('${id}')`
                : `salvarQuadro()`
        }
    ]

    if (id)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirQuadro('${id}')` })

    popup({ linhas, botoes, titulo: 'Edição de quadros' })
}

async function criarPIT(id) {

    // O que está na tela já basta para abrir; só busca no servidor o que não está.
    let dados = id && postitsPIT.get(id)
    if (!dados) {
        overlayAguarde()
        dados = await recuperarDado('postit', id)
    }

    const { comentario, anexos, prazo, status } = dados || {}

    const divAnexos = Object
        .entries(anexos || {})
        .map(([, anexo]) => criarAnexoVisual(anexo.nome, anexo.link))
        .join('')

    const linhas = [
        {
            editor: comentario || ''
        },
        {
            texto: 'Prazo',
            elemento: `<input name="prazo" type="date" value="${prazo || ''}">`
        },
        {
            texto: 'Status',
            elemento: `<input name="status" type="checkbox" style="width: 2rem; height: 2rem;" ${status == 'S' ? 'checked' : ''}>`
        },
        {
            elemento: `
                <div class="pit-anexos">
                    <label class="rh-anexo-area pit-anexo-area" data-soltar-arquivo="soltarAnexosPIT"
                        ondragenter="event.preventDefault(); this.classList.add('arrastando')"
                        ondragover="event.preventDefault()"
                        ondragleave="if (!this.contains(event.relatedTarget)) this.classList.remove('arrastando')"
                        ondrop="soltarAnexosPIT(event, this)">
                        <input name="anexos" type="file" multiple aria-label="Escolher anexos" onchange="mostrarAnexosPIT(this)">
                        <span class="rh-anexo-icone" aria-hidden="true">⇪</span>
                        <span class="rh-anexo-texto"><span>Arraste arquivos, cole um print (<b>Ctrl+V</b>) ou <u>clique para escolher</u></span></span>
                    </label>
                    <div class="pit-anexos-novos"></div>
                    <div class="local-anexos">${divAnexos || 'Sem anexos'}</div>
                </div>
            `
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            img: 'concluido',
            funcao:
                id
                    ? `salvarPIT('${id}')`
                    : 'salvarPIT()'
        }
    ]

    if (id)
        botoes.push({ img: 'cancel', texto: 'Excluir', funcao: `confirmarExcluirPIT('${id}')` })

    const janela = popup({ linhas, botoes, titulo: id ? 'Editar post-it' : 'Novo post-it' })
    // Print colado (Ctrl+V) em qualquer ponto do post-it, inclusive no texto, vira anexo.
    document.getElementById(janela)?.addEventListener('paste', colarAnexoPIT)
}

// ---------- Anexos do post-it: arrastar, colar print e escolher ----------
// Os arquivos ficam no próprio <input name="anexos"> (o que salvarPIT envia); a lista mostra o que
// vai subir ao salvar, com opção de tirar.
function adicionarArquivosPIT(input, arquivos) {
    if (!input || !arquivos.length) return
    const transferencia = new DataTransfer()
    for (const arquivo of [...input.files, ...arquivos]) transferencia.items.add(arquivo)
    input.files = transferencia.files
    mostrarAnexosPIT(input)
}

function soltarAnexosPIT(event, area) {
    event.preventDefault()
    area.classList.remove('arrastando')
    adicionarArquivosPIT(area.querySelector('input[type="file"]'), [...(event.dataTransfer?.files || [])])
}

function colarAnexoPIT(event) {
    const itens = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file')
    if (!itens.length) return
    event.preventDefault()
    const agora = new Date()
    const carimbo = `${agora.toLocaleDateString('pt-BR').split('/').reverse().join('-')}_${agora.toLocaleTimeString('pt-BR').replaceAll(':', '-')}`
    const arquivos = itens.map((item, indice) => {
        const arquivo = item.getAsFile()
        const extensao = (arquivo.type.split('/')[1] || 'png').replace('jpeg', 'jpg')
        // Print vem como "image.png": ganha um nome com data e hora.
        const nome = arquivo.name && !/^image\.\w+$/i.test(arquivo.name) ? arquivo.name : `print-${carimbo}${indice ? `-${indice + 1}` : ''}.${extensao}`
        return new File([arquivo], nome, { type: arquivo.type })
    })
    adicionarArquivosPIT(event.currentTarget.querySelector('.pit-anexo-area input[type="file"]'), arquivos)
}

function mostrarAnexosPIT(input) {
    const lista = input.closest('.pit-anexos')?.querySelector('.pit-anexos-novos')
    if (!lista) return
    lista.querySelectorAll('img[data-previa]').forEach(img => URL.revokeObjectURL(img.src))
    lista.innerHTML = [...input.files].map((arquivo, indice) => `
        <div class="pit-anexo-novo">
            ${arquivo.type.startsWith('image/') ? `<img data-previa src="${URL.createObjectURL(arquivo)}" alt="">` : '<span class="pit-anexo-icone" aria-hidden="true">📄</span>'}
            <span class="pit-anexo-nome" title="${escaparAtributo(arquivo.name)}">${escaparAtributo(arquivo.name)}</span>
            <button type="button" title="Tirar" data-indice="${indice}" onclick="removerAnexoNovoPIT(this)">×</button>
        </div>`).join('')
    const area = input.closest('.pit-anexo-area')
    area?.classList.toggle('com-arquivo', input.files.length > 0)
}

function removerAnexoNovoPIT(botao) {
    const input = botao.closest('.pit-anexos')?.querySelector('.pit-anexo-area input[type="file"]')
    if (!input) return
    const transferencia = new DataTransfer()
    ;[...input.files].forEach((arquivo, indice) => { if (indice !== Number(botao.dataset.indice)) transferencia.items.add(arquivo) })
    input.files = transferencia.files
    mostrarAnexosPIT(input)
}

// Coloca o cartão na tela sem esperar o servidor; devolve a função que desfaz.
async function mostrarPIT(dados, anterior) {
    const atual = linhaPIT(dados.id)
    const voltar = posicaoPIT(atual)
    const destino = document.getElementById(`body_${dados.quadro || 'Novos'}`)

    let nova = null
    if (atual || destino) {
        const molde = document.createElement('tbody')
        molde.innerHTML = await linPostIT(dados)
        nova = molde.firstElementChild
    }

    // Mesmo quadro: troca no lugar; quadro diferente (concluir/reabrir): vai para o topo do novo.
    if (atual && nova && (!destino || atual.parentElement === destino)) atual.replaceWith(nova)
    else {
        atual?.remove()
        if (nova && destino) destino.prepend(nova)
    }

    return () => {
        nova?.remove()
        voltar()
        if (anterior) postitsPIT.set(dados.id, anterior)
        else postitsPIT.delete(dados.id)
    }
}

function topoQuadroPIT(quadro) {
    const primeira = document.querySelector(`#body_${quadro || 'Novos'} > tr[data-pit]`)
    const ordem = ordemPIT(primeira)
    return ordem === null ? 1 : ordem - 1
}

// Quadro que o post-it deve ter pelo status: concluído vai para "Concluídos"; aberto que estava lá volta para "Novos".
function quadroPeloStatusPIT(status, quadroAtual) {
    if (status == 'S') return QUADRO_CONCLUIDO_PIT
    return quadroAtual === QUADRO_CONCLUIDO_PIT ? null : (quadroAtual ?? null)
}

async function salvarPIT(id) {

    const novo = !id
    id ||= crypto.randomUUID()

    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    // Cada um é dono dos próprios post-its.
    const campos = {
        usuario: acesso.usuario,
        status: painel.querySelector('[name="status"]').checked ? 'S' : 'N',
        comentario: painel.querySelector('.editor-conteudo').innerHTML || '',
        prazo: painel.querySelector('[name="prazo"]').value
    }

    // Arquivo novo precisa terminar de subir antes de fechar, senão se perderia.
    // Do painel deste post-it: obter() pega o primeiro painel do DOM, que com outra janela aberta
    // é de outro formulário, e o print colado era descartado sem aviso.
    const inputAnexos = painel.querySelector('[name="anexos"]')
    let anexos = {}
    if (inputAnexos?.files?.length) {
        overlayAguarde()
        try {
            anexos = await anexosOcorrencias(inputAnexos)
        } catch (err) {
            console.log(err)
            removerOverlay()
            return popup({ mensagem: 'Falha ao enviar os anexos do post-it. Tente de novo.' })
        }
    }

    const anterior = postitsPIT.get(id)
    const quadroAntes = anterior?.quadro || null
    const quadro = quadroPeloStatusPIT(campos.status, quadroAntes)
    const mudouQuadro = !novo && quadro !== quadroAntes
    const local = {
        id,
        ...campos,
        anexos: { ...anterior?.anexos, ...anexos },
        quadro,
        // Novo entra no topo do quadro; editar não mexe na posição, a não ser que o status troque o quadro.
        ordem: novo || mudouQuadro ? topoQuadroPIT(quadro) : anterior?.ordem ?? null
    }

    removerPopup()
    const desfazer = await mostrarPIT(local, anterior)

    try {
        // Mescla com o que está gravado: anexos ou quadro mudados em outra aba não se perdem.
        const gravado = novo ? {} : await recuperarDado('postit', id) || {}
        const atualizado = {
            ...local,
            anexos: { ...gravado.anexos, ...local.anexos },
            quadro: mudouQuadro ? local.quadro : gravado.quadro ?? local.quadro,
            ordem: mudouQuadro ? local.ordem : gravado.ordem ?? local.ordem
        }

        const resposta = await enviar(`postit/${id}`, atualizado)
        if (!resposta?.success) throw resposta

        postitsPIT.set(id, atualizado)
    } catch (erro) {
        console.log(erro)
        desfazer()
        falhaPIT('salvar o post-it', erro)
    }

    verificarPostIts()
}

// Concluir/reabrir direto no cartão, sem abrir o formulário.
async function alternarConcluidoPIT(id) {
    const anterior = postitsPIT.get(id)
    if (!anterior) return

    const status = anterior.status == 'S' ? 'N' : 'S'
    // Concluir leva para "Concluídos"; reabrir de lá devolve para o topo de "Novos".
    const quadroAntes = anterior.quadro ?? null
    const quadro = quadroPeloStatusPIT(status, quadroAntes)
    const mudouQuadro = quadro !== quadroAntes
    const ordem = mudouQuadro ? topoQuadroPIT(quadro) : anterior.ordem ?? null
    const local = { ...anterior, status, quadro, ordem }
    const desfazer = await mostrarPIT(local, anterior)
    postitsPIT.set(id, local)

    // Resumo aberto deste post-it acompanha a troca.
    const resumo = document.querySelector(`.pit-resumo[data-pit="${CSS.escape(id)}"]`)
    if (resumo) {
        removerPopup(resumo.closest('.popup')?.id)
        resumoPIT(id)
    }

    try {
        // Mescla com o que está gravado: texto, anexos ou quadro mudados em outra aba não se perdem.
        const gravado = await recuperarDado('postit', id) || {}
        // Só as colunas do post-it: o que vem da tela traz campos da listagem (ex.: "base") que a tabela não tem.
        const origem = { ...anterior, ...gravado }
        const atualizado = {
            id,
            usuario: origem.usuario || acesso.usuario,
            status,
            comentario: origem.comentario || '',
            prazo: origem.prazo || '',
            anexos: origem.anexos || {},
            quadro: mudouQuadro ? quadro : origem.quadro ?? null,
            ordem: mudouQuadro ? ordem : origem.ordem ?? null
        }
        const resposta = await enviar(`postit/${id}`, atualizado)
        if (!resposta?.success) throw resposta
        postitsPIT.set(id, atualizado)
    } catch (erro) {
        console.log(erro)
        desfazer()
        falhaPIT(status == 'S' ? 'concluir o post-it' : 'reabrir o post-it', erro)
    }

    verificarPostIts()
}

// Resumo só de leitura ao clicar no cartão.
function resumoPIT(id) {
    const dados = postitsPIT.get(id)
    if (!dados) return

    const { comentario, prazo, status, anexos, quadro } = dados
    const concluido = status == 'S'
    const atrasado = !concluido && prazo && agoraServidor() > toTimestamp(prazo)

    const situacao = concluido
        ? '<span class="pit-resumo-situacao concluido">Concluído</span>'
        : atrasado
            ? '<span class="pit-resumo-situacao atrasado">Atrasado</span>'
            : '<span class="pit-resumo-situacao aberto">Em aberto</span>'

    const nomeQuadro = document
        .querySelector(`#quadros .postits-coluna[data-quadro="${CSS.escape(quadro || '')}"] .postits-titulo-quadro span`)
        ?.textContent || 'Novos'

    const divAnexos = Object
        .entries(anexos || {})
        .map(([, anexo]) => criarAnexoVisual(anexo.nome, anexo.link))
        .join('')

    const elemento = `
        <div class="pit-resumo" data-pit="${escaparAtributo(id)}">
            <div class="pit-resumo-info">
                <div><span>Situação</span>${situacao}</div>
                <div><span>Prazo</span><b>${prazo ? new Date(toTimestamp(prazo)).toLocaleDateString() : 'Sem prazo'}</b></div>
                <div><span>Quadro</span><b>${escaparAtributo(nomeQuadro)}</b></div>
            </div>
            <div class="pit-resumo-texto">${comentarioPostIT(comentario)}</div>
            ${divAnexos ? `<div class="pit-resumo-anexos"><span>Anexos</span><div class="local-anexos">${divAnexos}</div></div>` : ''}
        </div>
    `

    const botoes = [
        {
            texto: concluido ? 'Reabrir' : 'Marcar concluído',
            img: concluido ? 'cancel' : 'concluido',
            funcao: `alternarConcluidoPIT('${id}')`
        },
        { texto: 'Editar', img: 'editar', funcao: `removerPopup(this.closest('.popup').id); criarPIT('${id}')` }
    ]

    popup({ elemento, botoes, titulo: 'Post-it' })
}

// Quadro novo entra no fim.
async function proximaOrdemQuadro() {
    const pesquisa = await pesquisarDB({
        base: 'quadros',
        limite: 1,
        ordenar: { path: 'ordem', direcao: 'desc' },
        filtros: {
            usuario: { op: '=', value: acesso.usuario }
        }
    })
    return (Number(pesquisa?.resultados?.[0]?.ordem) || 0) + 1
}

async function salvarQuadro(id = crypto.randomUUID()) {

    overlayAguarde()
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)

    const quadro = await recuperarDado('quadros', id)
    const atualizado = {
        ...quadro,
        id,
        timestamp: 0,
        usuario: acesso.usuario,
        ordem: quadro?.ordem ?? await proximaOrdemQuadro(),
        descricao: painel.querySelector('[name="descricao"]').value
    }

    await enviar(`quadros/${id}`, atualizado)

    await telaPIT()
    removerPopup()
}

async function confirmarExcluirPIT(id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirPIT('${id}')` }
    ]

    popup({ mensagem: 'Tem certeza?', botoes, removerAnteriores: true })

}

async function excluirPIT(id) {

    const linha = linhaPIT(id)
    const voltar = posicaoPIT(linha)
    linha?.remove()

    // Em falha o deletar já mostra o erro do servidor; aqui só devolve o cartão.
    const resposta = await deletar(`postit/${id}`)
    if (!resposta?.success)
        return voltar()

    postitsPIT.delete(id)
    verificarPostIts()

}

function confirmarExcluirQuadro(id) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirQuadro('${id}')` }
    ]

    popup({ mensagem: 'Excluir este quadro? Os post-its dele voltam para "Novos".', botoes, removerAnteriores: true })

}

async function excluirQuadro(id) {

    overlayAguarde()

    // Coleta tudo antes de mover: mover tira o post-it do filtro e embaralharia as páginas.
    const ids = []
    let pagina = 1
    let paginas = 1
    do {
        const pesquisa = await pesquisarDB({
            base: 'postit',
            pagina,
            filtros: {
                quadro: { op: '=', value: id }
            }
        })
        ids.push(...(pesquisa?.resultados || []).map(pit => pit.id))
        paginas = pesquisa?.paginas || 1
        pagina++
    } while (pagina <= paginas)

    for (const idPit of ids)
        await enviar(`postit/${idPit}/quadro`, null)

    // Em falha o deletar já abre o popup com o erro do servidor; não pode ser fechado aqui.
    const resposta = await deletar(`quadros/${id}`)
    if (!resposta?.success)
        return

    await telaPIT()
    removerPopup()

}

async function verificarPostIts() {

    const contadorPostIt = document.getElementById('contadorPostIt')
    if (!navigator.onLine || !contadorPostIt)
        return

    try {
        const dados = await pesquisarDB({
            base: 'postit',
            filtros: {
                'usuario': { op: '=', value: acesso.usuario },
                'status': { op: '!=', value: 'S' },
                'prazo': { op: '<=d', value: dataServidor().toLocaleDateString() }
            }
        })

        contadorPostIt.style.display = dados.total > 0
            ? 'flex'
            : 'none'

        contadorPostIt.textContent = dados.total
    } catch {
        contadorPostIt.style.display = 'none'
        contadorPostIt.textContent = ''
    }

}
