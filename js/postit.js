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

    const quadros = [
        { id: null, ordem: 0, descricao: 'Novos' },
        ...(pesqQuadros?.resultados || [])
    ]
        .sort((a, b) => a.ordem - b.ordem)

    // Todos os quadros de vez;
    const quadrosEmMassa = quadros.map(async q => {

        const { id, descricao, ordem } = q || {}
        const chave = id || 'Novos'

        // Reserva a posição antes das consultas assíncronas.
        const coluna = document.createElement('div')
        coluna.className = 'postits-coluna'
        coluna.dataset.quadro = id || ''
        coluna.dataset.ordem = ordem ?? ''
        coluna.ondragover = sobreQuadroPIT
        coluna.ondrop = soltarQuadroPIT
        telaPIT.appendChild(coluna)

        const editar = id
            ? `<img src="imagens/pesquisar.svg" title="Editar quadro" draggable="false" onclick="criarQuadro('${id}')">`
            : ''

        // "Novos" fica sempre em primeiro; os demais são arrastados pelo título.
        const arrastar = id
            ? `draggable="true" title="Segure e arraste para reorganizar" ondragstart="arrastarQuadroPIT(event)" ondragend="finalizarQuadroPIT()"`
            : ''

        const btnExtras = `
            <div class="postits-titulo-quadro${id ? ' arrastavel' : ''}" ${arrastar}>
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
                ondragstart="arrastarPIT(event, '${id}')">
                ${comentarioPostIT(comentario)}
                <div class="local-anexos">${divAnexos || ''}</div>
                <span class="prazo">${prazoFin ? `<b>Prazo:</b> ${prazoFin}` : 'Sem prazo'}</span>
                <img class="postit-editar" src="imagens/pesquisar.svg" title="Editar post-it" onclick="criarPIT('${id}')">
            </div>
        </td>
    </tr>
    `
}

let pitAutoScroll = null

function arrastarPIT(event, id) {
    event.dataTransfer.setData('text/plain', id)
    iniciarAutoScrollPIT()
}

function permitirDropPIT(event) {
    event.preventDefault()
}

async function soltarPIT(event) {
    event.preventDefault()
    pararAutoScrollPIT()

    const id = event.dataTransfer.getData('text/plain')
    const linha = id && linhaPIT(id)
    if (!linha) return

    const destino = event.currentTarget
    const quadro = destino.dataset.quadro || null
    if ((linha.parentElement.dataset.quadro || null) == quadro)
        return

    const voltar = posicaoPIT(linha)
    destino.prepend(linha)

    const resposta = await enviar(`postit/${id}/quadro`, quadro)
    if (resposta?.success) {
        const dados = postitsPIT.get(id)
        if (dados) dados.quadro = quadro
        return
    }

    voltar()
    falhaPIT('mover o post-it', resposta)
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
    const depois = !alvo.dataset.quadro || event.clientX > rect.left + rect.width / 2
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
        .filter(coluna => coluna.dataset.quadro)

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

    const { comentario, anexos, prazo, status, usuario = acesso.usuario } = dados || {}

    const divAnexos = Object
        .entries(anexos || {})
        .map(([, anexo]) => criarAnexoVisual(anexo.nome, anexo.link))
        .join('')

    controlesCxOpcoes.usuario = {
        base: 'clientes',
        retornar: ['usuario'],
        filtros: {
            usuario: { op: 'NOT_EMPTY' }
        },
        colunas: {
            'Usuario': { chave: 'usuario' },
            'Permissão': { chave: 'permissao' }
        }
    }

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
        },
        {
            texto: 'Usuário',
            elemento: `<span class="opcoes" name="usuario" id="${usuario}" onclick="cxOpcoes('usuario')">${usuario}</span>`
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

    const janela = popup({ linhas, botoes, titulo: id ? 'Editar post-it' : 'Novo post-it', autoDestruicao: ['usuario'] })
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

    // Post-it passado para outro usuário sai da tela.
    let nova = null
    if (dados.usuario === acesso.usuario && (atual || destino)) {
        const molde = document.createElement('tbody')
        molde.innerHTML = await linPostIT(dados)
        nova = molde.firstElementChild
    }

    if (atual && nova) atual.replaceWith(nova)
    else if (atual) atual.remove()
    else if (nova) destino.prepend(nova)

    return () => {
        nova?.remove()
        voltar()
        if (anterior) postitsPIT.set(dados.id, anterior)
        else postitsPIT.delete(dados.id)
    }
}

async function salvarPIT(id) {

    const novo = !id
    id ||= crypto.randomUUID()

    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const usuarioFin = painel.querySelector('[name="usuario"]').id
    const campos = {
        usuario: usuarioFin,
        status: painel.querySelector('[name="status"]').checked ? 'S' : 'N',
        comentario: painel.querySelector('.editor-conteudo').innerHTML || '',
        prazo: painel.querySelector('[name="prazo"]').value
    }

    // Arquivo novo precisa terminar de subir antes de fechar, senão se perderia.
    let anexos = {}
    if (obter('anexos')?.files?.length) {
        overlayAguarde()
        try {
            anexos = await anexosOcorrencias(obter('anexos'))
        } catch (err) {
            console.log(err)
            removerOverlay()
            return popup({ mensagem: 'Falha ao enviar os anexos do post-it. Tente de novo.' })
        }
    }

    const anterior = postitsPIT.get(id)
    const local = {
        id,
        ...campos,
        anexos: { ...anterior?.anexos, ...anexos },
        quadro: usuarioFin !== acesso.usuario ? null : anterior?.quadro || null
    }

    removerPopup()
    const desfazer = await mostrarPIT(local, anterior)

    try {
        // Mescla com o que está gravado: anexos ou quadro mudados em outra aba não se perdem.
        const gravado = novo ? {} : await recuperarDado('postit', id) || {}
        const atualizado = {
            ...local,
            anexos: { ...gravado.anexos, ...local.anexos },
            quadro: usuarioFin !== acesso.usuario ? null : gravado.quadro ?? local.quadro
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
