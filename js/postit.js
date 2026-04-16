async function telaPIT() {

    const acumulado = `
    <div class="scroll-top"></div>
    <div class="scroll-content">
        <div class="contorno-quadros">
            <div id="quadros" class="tabela-cadastro-recorte"></div>
        </div>
    </div>
    `

    tela.innerHTML = acumulado

    criarMenus('postit')

    await criarQuadros()
}

async function criarQuadros() {

    const divQuadros = []
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

    for (const q of quadros) {

        const { id, descricao } = q || {}
        const chave = id || 'Novos'

        const editar = id
            ? `<img src="imagens/editar.png" onclick="criarQuadro('${id}')">`
            : ''

        const btnExtras = `
            <div style="${horizontal}; gap: 0.5rem;">
                <span style="font-size: 1.1rem; color: white;">${descricao}</span>
                ${editar}
            </div>
            `

        const quadro = await modTab({
            btnExtras,
            base: 'postit',
            pag: `pit_${chave}`,
            body: `body_${chave}`,
            criarLinha: 'linPostIT',
            filtros: {
                usuario: {
                    op: '=',
                    value: acesso.usuario
                },
                quadro: {
                    op: '=',
                    value: id || ''
                }
            }
        })

        divQuadros.push(`<div style="max-width: 350px;">${quadro}</div>`)
    }

    telaPIT.innerHTML = divQuadros.join('')

    for (const q of quadros) {
        const chave = q?.id || 'Novos'
        const body = document.getElementById(`body_${chave}`)
        if (!body) continue

        body.dataset.quadro = q?.id || ''
        body.ondragover = permitirDropPIT
        body.ondrop = soltarPIT
    }

    await paginacao()
}

async function linPostIT(dados) {

    const { id, comentario, prazo, status } = dados || {}

    const prazoFin = prazo
        ? new Date(toTimestamp(prazo)).toLocaleDateString()
        : ''

    const estilo = status == 'S'
        ? 'concluido'
        // Se hoje é maior que o prazo, então tá atrasado;
        : Date.now() > toTimestamp(prazo)
            ? 'atrasado'
            : ''

    return `
    <tr>
        <td>
            <div
                class="postit ${estilo}"
                draggable="true"
                ondragstart="arrastarPIT(event, '${id}')">
                <span>${comentario || ''}</span>
                <span class="prazo"><b>Prazo:</b> ${prazoFin}</span>
                <img class="postit-editar" src="imagens/editar.png" onclick="criarPIT('${id}')">
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

function iniciarAutoScrollPIT() {
    const contorno = document.querySelector('.tabela-cadastro-recorte')
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

    popup({ linhas, botoes })
}

async function criarPIT(id) {

    const { comentario, prazo, status, usuario = acesso.usuario } = await recuperarDado('postit', id) || {}

    controlesCxOpcoes.usuario = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuario': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const linhas = [
        {
            texto: 'Comentário',
            elemento: `<textarea name="comentario">${comentario || ''}</textarea>`
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

    overlayAguarde()
    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)

    const usuarioFin = painel.querySelector('[name="usuario"]').id

    const pit = await recuperarDado('postit', id)
    const atualizado = {
        ...pit,
        id,
        usuario: usuarioFin,
        quadro: pit?.quadro || null,
        status: painel.querySelector('[name="status"]').checked ? 'S' : 'N',
        comentario: painel.querySelector('[name="comentario"]').value,
        prazo: painel.querySelector('[name="prazo"]').value
    }

    if (usuarioFin !== acesso.usuario)
        atualizado.quadro = null

    await enviar(`postit/${id}`, atualizado)
    removerPopup()

    await verificarPostIts()
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

    await criarQuadros()
    removerPopup()
}

async function confirmarExcluirPIT(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirPIT('${id}')` }
    ]

    popup({ mensagem: 'Tem certeza?', botoes, removerAnteriores: true })

}

async function excluirPIT(id) {

    await deletar(`postit/${id}`)
    await verificarPostIts()

}

async function verificarPostIts() {

    if (!navigator.onLine)
        return

    const dados = await pesquisarDB({
        base: 'postit',
        filtros: {
            'usuario': { op: '=', value: acesso.usuario },
            'status': { op: '!=', value: 'S' },
            'prazo': { op: '<=d', value: new Date().toLocaleDateString() }
        }
    })

    const contadorPostIt = document.getElementById('contadorPostIt')
    if (!contadorPostIt)
        return

    contadorPostIt.style.display = dados.total > 0
        ? 'flex'
        : 'none'

    contadorPostIt.textContent = dados.total

}