async function telaPIT() {

    const acumulado = `
        <div class="scroll-content tela-postits">
            <div class="postits-toolbar">
                <div><h2>Post-its</h2><p>Organize suas tarefas e arraste os cartões entre os quadros.</p></div>
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
            ? `<img src="imagens/editar.png" draggable="false" onclick="criarQuadro('${id}')">`
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

async function linPostIT(dados) {

    const { 
        id, 
        comentario, 
        prazo, 
        status,
        anexos
    } = dados || {}

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
    <tr>
        <td>
            <div
                class="postit ${estilo}"
                draggable="true"
                ondragstart="arrastarPIT(event, '${id}')">
                <span class="postit-comentario">${comentario || ''}</span>
                <div class="local-anexos">${divAnexos || ''}</div>
                <span class="prazo">${prazoFin ? `<b>Prazo:</b> ${prazoFin}` : 'Sem prazo'}</span>
                <img class="postit-editar" src="imagens/editar.png" title="Editar post-it" onclick="criarPIT('${id}')">
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
    if (!id) return

    const quadro = event.currentTarget.dataset.quadro || null

    const pit = await recuperarDado('postit', id)
    if (!pit) return

    if ((pit.quadro || null) == quadro)
        return

    const atualizado = {
        ...pit,
        id,
        quadro
    }

    await enviar(`postit/${id}`, atualizado)
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
        await enviar(`quadros/${coluna.dataset.quadro}/ordem`, ordem)
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

    const { descricao, ordem = 0 } = await recuperarDado('quadros', id) || {}

    const linhas = [
        {
            texto: 'Nome do Quadro',
            elemento: `<textarea name="descricao">${descricao || ''}</textarea>`
        },
        {
            texto: 'Ordem',
            elemento: `<input name="ordem" type="number" step="1" value="${ordem}">`
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

    overlayAguarde()

    const { comentario, anexos, prazo, status, usuario = acesso.usuario } = await recuperarDado('postit', id) || {}

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
            'Setor': { chave: 'setor' },
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
                <div style="${vertical}; gap: 5px;">
                    <input name="anexos" type="file" multiple>
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

    popup({ linhas, botoes, autoDestruicao: ['usuario'] })
}

async function salvarPIT(id = crypto.randomUUID()) {

    try {

        overlayAguarde()

        const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)

        const usuarioFin = painel.querySelector('[name="usuario"]').id

        const anexos = await anexosOcorrencias(obter('anexos'))
        const { anexos: anexosExistentes, quadro } = await recuperarDado('postit', id) || {}

        const atualizado = {
            id,
            anexos: {
                ...anexosExistentes,
                ...anexos
            },
            usuario: usuarioFin,
            quadro: quadro || null,
            status: painel.querySelector('[name="status"]').checked ? 'S' : 'N',
            comentario: painel.querySelector('.editor-conteudo').innerHTML || '',
            prazo: painel.querySelector('[name="prazo"]').value
        }

        if (usuarioFin !== acesso.usuario)
            atualizado.quadro = null

        await enviar(`postit/${id}`, atualizado)
        removerPopup()

        await verificarPostIts()

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao criar um Post it: Fale com o suporte.' })
    }
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
        ordem: Number(painel.querySelector('[name="ordem"]').value),
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

    await deletar(`postit/${id}`)
    await verificarPostIts()

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
