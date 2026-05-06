const dtPrazo = (data) => {
    if (!data) return ''

    const [ano, mes, dia] = data.split('-')
    const dataPrazo = new Date(`${ano}-${mes}-${dia}T00:00:00`)
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const atrasado = hoje > dataPrazo
    return atrasado
}

function linAcoes(pda) {

    const { id, responsavel, status, usuario, registro, prazo, acao, snapshots } = pda || {}

    const contrato = snapshots?.contrato || ''
    const aba = snapshots?.aba || ''

    const estilo = status === 'concluído'
        ? 'concluído'
        : dtPrazo(prazo)
            ? 'atrasado'
            : 'pendente'

    const [ano, mes, dia] = prazo.split('-')
    const prazoConvertido = `${dia}/${mes}/${ano}`
    const dtRegistro = registro
        ? `<span><b>criado em: </b>${new Date(registro).toLocaleString('pt-BR')}</span>`
        : ''

    const criadoPor = usuario
        ? `<span><b>criado por: </b>${usuario}</span>`
        : ''

    const listagemResp = Array.isArray(responsavel)
        ? responsavel.join('<br>')
        : responsavel || ''

    const linha = `
        <tr>    
            <div class="etiqueta-${estilo}" style="width: 95%; flex-direction: row; gap: 0.5rem; margin: 1px;">

                <img src="imagens/pesquisar2.png" style="width: 2rem;" onclick="irAcao('${id}')">

                <div style="${vertical};">
                    <span><b>ID:</b> ${contrato}</span>
                    <span><b>Aba:</b> ${aba}</span>
                    <div style="white-space: pre-wrap;"><b>Ação:</b> ${acao || ''}</div>
                    <div><b>Responsáveis:</b> <br>
                        ${listagemResp}
                    </div>
                    <span><b>Prazo:</b> ${prazoConvertido}</span>
                    ${dtRegistro}
                    ${criadoPor}
                </div>
            </div>
        </tr>`

    return linha
}

async function formAcao({ id, idAcao, formulario = 'orcamento' }) {

    const { prazo, status, acao, usuario, responsavel = [] } = await recuperarDado('acoes', idAcao) || {}

    const linhas = [
        { texto: 'Ação', elemento: `<textarea name="acao">${acao || ''}</textarea>` },
        {
            texto: `
            <div style="${horizontal}; gap: 1rem;">
                <img src="imagens/baixar.png" onclick="incluirResponsavel()">
                <span>Responsável</span>
            </div>
            `,
            elemento: `<div style="${vertical}" id="responsaveis"></div>`
        },
        { texto: 'Prazo da ação', elemento: `<input name="prazo" type="date" value="${prazo || ''}">` },
        {
            texto: 'Status', elemento: `
            <select name="statusAcao">
                ${['pendente', 'concluído'].map(op => `<option ${status == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            ` },
        {
            texto: 'Criado por',
            elemento: `<input name="usuario" value="${usuario || acesso.usuario}" readOnly>`
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAcao('${id}', '${formulario}' ${idAcao ? `, '${idAcao}'` : ''})` }
    ]

    if (idAcao)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `confirmarExcluirAcao('${idAcao}')` })

    popup({ linhas, botoes, titulo: 'Ações' })

    for (const r of responsavel)
        incluirResponsavel(r)

}

async function incluirResponsavel(usuario) {

    const u = usuario || ID5digitos()

    controlesCxOpcoes[u] = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const span = `
        <div style="${horizontal}; gap: 3px;">
            <img src="imagens/cancel.png" onclick="this.parentElement.remove()">
            <span 
                class="opcoes" 
                name="${u}" 
                ${usuario ? `id="${usuario}"` : ''}
                onclick="cxOpcoes('${u}')">
                    ${usuario || 'Selecione'}
            </span>
        </div>
    `

    const divResponsaveis = document.getElementById('responsaveis')

    divResponsaveis.insertAdjacentHTML('beforeend', span)

}

async function confirmarExcluirAcao(idAcao) {

    const botoes = [
        { texto: 'Confirmar', fechar: true, img: 'concluido', funcao: `excluirAcao('${idAcao}')` }
    ]

    popup({ botoes, mensagem: 'Tem certeza?', removerAnteriores: true })

}

async function excluirAcao(idAcao) {

    await deletar(`acoes/${idAcao}`)

}

async function salvarAcao(idOrcamento, formulario, idAcao = crypto.randomUUID()) {

    overlayAguarde()

    const painel = document.querySelector('.painel-padrao')
    const el = (nome) => {
        const elem = painel.querySelector(`[name="${nome}"]`)
        return elem
    }

    const divResp = document.getElementById('responsaveis')
    const responsavel = [...divResp.querySelectorAll('span')]
        .filter(span => span.textContent != 'Selecione')
        .map(span => span.id)

    const acao = el('acao').value
    const prazo = el('prazo').value
    const status = el('statusAcao').value
    const usuario = el('usuario').value

    if (!prazo || !responsavel)
        return popup({ mensagem: 'Preencha o prazo e/ou responsável da ação' })

    const a = {
        origem: {
            id: idOrcamento,
            base: formulario == 'orcamento'
                ? 'dados_orcamentos'
                : 'dados_manutencao'
        },
        usuario,
        responsavel,
        acao,
        prazo,
        status,
        registro: new Date().getTime()
    }

    if (formulario == 'chamado')
        a.origem.titulo = 'REQUISIÇÃO AVULSA'

    await enviar(`acoes/${idAcao}`, a)

    removerPopup()

}

async function salvarCartao(idOrcamento) {

    overlayAguarde()

    const projeto = document.querySelector('[name="projeto"]').value
    const estado = document.querySelector('[name="estado"]').value
    const aba = document.querySelector('[name="aba"]').value
    const dados = {
        projeto,
        estado,
        aba,
        checklist: { tecnicos: [] },
        usuario: acesso.usuario
    }

    if (idOrcamento) {
        await enviar(`dados_orcamentos/${idOrcamento}/projeto`, projeto)
        await enviar(`dados_orcamentos/${idOrcamento}/estado`, estado)
        await enviar(`dados_orcamentos/${idOrcamento}/aba`, aba)
    } else {
        idOrcamento = `PDA_${crypto.randomUUID()}`
        await enviar(`dados_orcamentos/${idOrcamento}`, dados)
    }

    removerPopup()

}
