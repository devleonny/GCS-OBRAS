let painelCentral = document.querySelector('.painelCentral')
let filtrosOcorrencias = {}

const btn = (imagem, termo, link) => `
    <div class="btnLateral" onclick="${link ? link : `opcoesPainel('${termo}')`}">
        <img src="imagens/${imagem}.png" style="width: 1.5vw;">
        <label>${termo}</label>
    </div>
`

const menus = {
    'Dashboard': {
        imagem: 'relatorio',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Ocorrências': {
        imagem: 'megafone',
        paineis: [{
            nome: 'Painel',
            funcao: 'carregarOcorrencias()'
        },
        {
            nome: 'Lista de Ocorrências',
            funcao: ''
        },
        {
            nome: 'Ocorrências ',
            funcao: ''
        }]
    },
    'Relatórios': {
        imagem: 'prancheta',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Materiais': {
        imagem: 'estoque',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Documentos': {
        imagem: 'duplicar',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
    'Cadastros': {
        imagem: 'gerente',
        paineis: [{
            nome: 'Unidades de Manutenção',
            funcao: `painelCadastro('dados_clientes', 'unidades', 'Clientes', 'Unidades')`
        },
        {
            nome: 'Equipamentos',
            funcao: `painelCadastro('dados_composicoes', 'equipamentos', 'Composições', 'Equipamentos')`
        },
        {
            nome: 'Sistemas',
            funcao: `carregarTabelasAuxiliares('sistemas')`
        },
        {
            nome: 'Prioridades de Correção',
            funcao: `carregarTabelasAuxiliares('prioridades')`
        },
        {
            nome: 'Status de Correção',
            funcao: `carregarTabelasAuxiliares('correcoes')`
        },
        {
            nome: 'Tipos',
            funcao: `carregarTabelasAuxiliares('tipos')`
        },
        ]

    },
    'Configurações': {
        imagem: 'ajustar',
        paineis: [{
            nome: '',
            funcao: ''
        }]
    },
}

const esquemaCampos = {
    dados_clientes: ['nome', 'cnpj', 'cidade'],
    dados_composicoes: ['descricao', 'modelo', 'tipo'],
    sistemas: ['nome'],
    unidades: ['nome', 'cnpj', 'cidade'],
    prioridades: ['nome'],
    tipos: ['nome'],
    dados_setores: ['usuario']
}

botoesLaterais()

function botoesLaterais() {

    let painelLateral = document.querySelector('.painelLateral')

    painelLateral.insertAdjacentHTML('beforeend', btn('LG', 'Início', `window.location.href='inicial.html'`))

    for (const [termo, dados] of Object.entries(menus)) {
        painelLateral.insertAdjacentHTML('beforeend', btn(dados.imagem, termo))
    }

}

function opcoesPainel(termo) {

    const opcoes = menus[termo].paineis
        .map(op => `<label onclick="${op.funcao}">${op.nome}</label>`).join('')

    let acumulado = `
    <div class="painelCascata">
        <span class="close" style="font-size: 2vw; position: absolute; top: 5px; right: 15px;" onclick="removerMenus()">×</span>
        ${opcoes}
    </div>
    `
    let painelCascata = document.querySelector('.painelCascata')
    if (painelCascata) painelCascata.remove()

    let painelLateral = document.querySelector('.painelLateral')
    painelLateral.insertAdjacentHTML('afterend', acumulado)

}

function removerMenus() {
    let painelCascata = document.querySelector('.painelCascata')
    if (painelCascata) painelCascata.remove()
}

async function painelCadastro(nomeBaseReferencia, nomeBaseFinal, tituloReferencia, tituloFinal) {

    removerMenus()
    const dadosReferencia = await recuperarDados(nomeBaseReferencia)
    const dadosFinal = await recuperarDados(nomeBaseFinal)

    const acumulado = `

        ${tabelasHTML(dadosReferencia, tituloReferencia)}

        <div style="border-right: 1px dashed #d2d2d2; margin: 1vw; height: 80vh;"></div>

        ${tabelasHTML(dadosFinal, tituloFinal)}

    `
    painelCentral.innerHTML = acumulado

    // Função que carrega os elementos
    function tabelasHTML(base, tituloAtual) {

        let linhas = ''

        if (!filtrosOcorrencias[tituloAtual]) filtrosOcorrencias[tituloAtual] = {}

        Object.entries(base).forEach(([cod, recorte]) => {

            const labels = esquemaCampos[nomeBaseReferencia]
                .map(campo => modelo(String(campo).toUpperCase(), recorte?.[campo] || '??'))
                .join('')

            linhas += `
            <tr>
                <td>
                    <div style="${horizontal}; justify-content: space-between; width: 100%;">
                        <div style="${vertical};">

                            ${labels}

                        </div>
                        
                    </div>
                </td>
                <td style="text-align: center;">
                    <input name="${tituloAtual}" id="${cod}" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                </td>
            </tr>`
        })

        return `
        <div>
            <label style="font-size: 2.0vw; color: white;">${tituloAtual} - ${Object.keys(base).length}</label>
            <div class="painelBotoes">
                ${botao('Mover', `gerenciar('${tituloAtual}', '${nomeBaseReferencia}', '${nomeBaseFinal}', '${tituloReferencia}', '${tituloFinal}')`)}
            </div>
            <div style="height: max-content; max-height: 70vh; overflow-y: auto;">
                <table class="tabela" style="display: table-row;">
                    <thead>
                        <tr>
                            <th>
                                <div style="${horizontal}; gap: 2px;">
                                    <label>Descrição</label>
                                </div>
                            </th>
                            <th>
                                <div style="${horizontal}; gap: 5px;">
                                    <input type="checkbox" style="width: 1.5vw; height: 1.5vw;" onclick="marcarTodosVisiveis(this)">
                                    <label>Todos</label>
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <th style="background-color: white;">
                                <div style="display: flex; align-items: center; justify-content: center;">
                                    <input placeholder="Pesquisar" oninput="pesquisar_generico(0, this.value, filtrosOcorrencias['${tituloAtual}'], 'body_${tituloAtual}')">
                                    <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                                </div>
                            </th>
                            <th style="background-color: white;"></th>
                        </tr>
                    </thead>
                    <tbody id="body_${tituloAtual}">${linhas}</tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
        `
    }

}

async function gerenciar(tituloAtual, nomeBaseReferencia, nomeBaseFinal, tituloReferencia, tituloFinal) {

    overlayAguarde()

    const dadosReferencia = await recuperarDados(nomeBaseReferencia)
    let inputs = document.querySelectorAll(`[name="${tituloAtual}"]`)

    let dados = {}

    for (let inputTab of inputs) {

        if (inputTab.checked) {

            const id = inputTab.id

            if (tituloAtual == tituloReferencia) {
                dados[id] = dadosReferencia[id]

            } else {
                await deletarDB(nomeBaseFinal, id)
            }

        }

    }

    if (tituloAtual == tituloReferencia) await inserirDados(dados, nomeBaseFinal)

    await painelCadastro(nomeBaseReferencia, nomeBaseFinal, tituloReferencia, tituloFinal)

    removerOverlay()

}

function marcarTodosVisiveis(input) {

    let tabela = input.closest('table')

    let inputs = tabela.querySelectorAll('input')

    inputs.forEach(inputTab => {

        const marcar = inputTab.closest('tr').style.display !== 'none'
        if (marcar) inputTab.checked = input.checked

    })

}

async function carregarTabelasAuxiliares(nomeBaseAuxiliar) {

    removerMenus()
    await sincronizarDados(nomeBaseAuxiliar)

    const baseAuxiliar = await recuperarDados(nomeBaseAuxiliar)

    const linhas = Object.entries(baseAuxiliar)
        .map(([cod, recorte]) => `
        <tr>
            <td>${recorte.nome}</td>
            <td>
                <div style="${horizontal};">
                    <img onclick="editar('${cod}', '${nomeBaseAuxiliar}')" src="imagens/pesquisar2.png" style="cursor: pointer; width: 1.5vw;">
                </div>
            </td>
        </tr>
        `).join('')

    let acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes">
                ${botao('Novo', `editar('${nomeBaseAuxiliar}')`)}
            </div>
            <div style="height: max-content; max-height: 60vh; overflow-y: auto;">
                <table class="tabela">
                    <thead>
                        <th>Nome</th>
                        <th>Ações</th>
                    </thead>

                    <tbody>
                        ${linhas}
                    </tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    painelCentral.innerHTML = acumulado
}

async function editar(cod, tabela) {

    let dado = {}

    if (cod) {
        dado = await recuperarDado(cod, tabela)
    } else {
        cod = ID5digitos()
    }

    const acumulado = `
        <div style="padding: 2vw; background-color: #d2d2d2;">
            <div style="${horizontal}; gap: 5px;">
                <textarea id="campo" style="padding: 5px; border-radius: 2px;">${dado?.nome || ''}</textarea>
                ${botao('Salvar', `salvar('${cod}', '${tabela}')`, 'green')}
            </div>
            <hr style="width: 100%;">
            ${acesso.permissao == 'adm' ? botao('Excluir', `excluir('${cod}', '${tabela}')`) : ''}
        </div>
    `

    popup(acumulado, inicialMaiuscula(tabela), true)

}

async function salvar(cod, tabela) {

    overlayAguarde()
    let dado = await recuperarDado(cod, tabela) || {}
    const novoNome = document.getElementById('campo')

    if (novoNome) {
        dado.nome = novoNome.value
        await inserirDados(dado, tabela)
        await enviar(`${tabela}/${cod}`, dado)
    }

    await carregarTabelasAuxiliares(tabela)
    removerOverlay()
}

async function excluir(cod, tabela) {

    removerPopup()
    overlayAguarde()

    await deletarDB(tabela, cod)
    await deletar(`${tabela}/${cod}`)

    await carregarTabelasAuxiliares(tabela)
    removerOverlay()

}

carregarOcorrencias()

function dtAuxOcorrencia(dt) {

    if (!dt) return '--'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

async function carregarOcorrencias() {
    removerMenus()
    const dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const sistemas = await recuperarDados('sistemas')
    const tipos = await recuperarDados('tipos')
    const prioridades = await recuperarDados('prioridades')
    const unidades = await recuperarDados('unidades')

    const bgs = {
        'Não analisada': 'red',
        'Agendada': 'orange',
        'Solucionada': 'green'
    }

    let tabelas = ''

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias)) {

        const status = ocorrencia?.analise || 'Não analisada'

        tabelas += `
        <div class="blocoMaior" style="background-color: ${bgs[status]};">
            <table class="tabelaChamado">
                <tbody>

                    <tr>
                        <td>${status}</td>
                        <td style="text-align: left;">${ocorrencia?.dataRegistro || ''}</td>
                        <td style="text-align: left;">${ocorrencia?.executor || ''}</td>
                        <td>
                            <div style="${vertical}; align-items: center;">
                                <label style="text-align: center;">Dt Limt Exec</label> 
                                </label>${dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao)}</label>
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td>
                            <label style="text-decoration: underline; cursor: pointer;" onclick="formularioOcorrencia('${idOcorrencia}')">Nº ${idOcorrencia}</label>
                        </td>
                    </tr>

                    <tr>
                        <td>Tipo</td>
                        <td style="text-align: left;">${tipos?.[ocorrencia?.tipo]?.nome || '...'}</td>
                    </tr>

                    <tr>
                        <td>Unidade de Manutenção</td>
                        <td colspan="2" style="text-align: left;">${unidades?.[ocorrencia?.unidade]?.nome || '...'}</td>
                        <td style="${horizontal}; justify-content: right;">${botao('Incluir Correção')}</td>
                    </tr>

                    <tr>
                        <td>Sistema</td>
                        <td style="text-align: left;">${sistemas?.[ocorrencia?.sistema]?.nome || '...'}</td>
                    </tr>
                    
                    <tr>
                        <td>Prioridade</td>
                        <td colspan="2" style="text-align: left;">${prioridades?.[ocorrencia?.prioridade]?.nome || '...'}</td>
                    </tr>   
                    
                    <tr>
                        <td>Descrição</td>
                        <td colspan="3" style="text-align: left;">${ocorrencia?.descricao || '...'}</td>
                    </tr>                      
                
                </tbody>
            </table>
            
            <img src="imagens/LG.png" style="width: 5vw;">
            
        </div>
        `
    }

    let acumulado = `
    
        <div style="${vertical};">
            <div class="painelBotoes">
                ${botao('Novo', 'formularioOcorrencia()')}
                ${botao('Excluir', ``)}
                ${botao('Baixa', ``)}
                ${botao('Inativar', ``)}
            </div>

            <div style="${horizontal};">

                <div style="width: 70vw; height: max-content; overflow-y: auto; overflow-x: hidden;">
                    ${tabelas}
                </div>

            </div>

            <div class="rodapeTabela"></div>
        </div>
    
    `

    painelCentral.innerHTML = acumulado

}

async function formularioOcorrencia(idOcorrencia) {

    const ocorrencia = idOcorrencia ? await recuperarDado('dados_ocorrencias', idOcorrencia) : {}

    const dados_setores = await recuperarDados('dados_setores')
    const unidades = await recuperarDados('unidades')
    const sistemas = await recuperarDados('sistemas')
    const prioridades = await recuperarDados('prioridades')
    const correcoes = await recuperarDados('correcoes')
    const tipos = await recuperarDados('tipos')
    const funcao = idOcorrencia ? `salvarOcorrencia('${idOcorrencia}')` : 'salvarOcorrencia()'

    const labelBotao = (chave, nomebase, base) => {

        const id = ocorrencia?.[chave] || undefined

        const possivelValor = base[id]?.nome || base[id]?.usuario || 'Selecionar'

        return `<label class="campos" name="${chave}" ${id ? `id="${id}"` : ''} onclick="caixaOpcoes('${chave}', '${nomebase}')">${possivelValor}</label>`
    }

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 2vw; ">
            <div style="${horizontal}; align-items: start; gap: 2vw;">
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Unidade de Manutenção', labelBotao('unidade', 'unidades', unidades))}
                    ${modelo('Sistema', labelBotao('sistema', 'sistemas', sistemas))}
                    ${modelo('Prioridade', labelBotao('prioridade', 'prioridades', prioridades))}
                </div>
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Tipo', labelBotao('tipo', 'tipos', tipos))}
                    ${modelo('Solicitante', `<label class="campos">${acesso.usuario}</label>`)}
                    ${modelo('Executor / Responsável', labelBotao('executor', 'dados_setores', dados_setores))}
                    ${modelo('Data / Hora', `<label class="campos">${new Date().toLocaleString('pt-BR')}</label>`)}
                    ${modelo('Descrição', `<textarea name="descricao" class="campos">${ocorrencia?.descricao || ''}</textarea>`)}
                </div>
                <div style="${vertical}; gap: 5px;">
                    ${modelo('Data Limite para a Execução', `<input name="dataLimiteExecucao" class="campos" type="date" value="${ocorrencia?.dataLimiteExecucao || ''}">`)}
                    ${modelo('Anexos', '<label class="campos">Clique aqui</label>')}
                </div>
            </div>
            <hr style="width: 100%;">

            <label>CORREÇÕES</label>

            <div></div>
        </div>
        <div style="${horizontal}; justify-content: start; background-color: #a0a0a0ff; padding: 5px; gap: 1vw;">
                ${botao('Salvar', funcao)}
        </div>
   `

    popup(acumulado, 'OCORRÊNCIA')

}

async function salvarOcorrencia(idOcorrencia) {

    overlayAguarde()

    function obter(name, propriedade) {
        const elemento = document.querySelector(`[name=${name}]`)
        return elemento[propriedade] ? elemento[propriedade] : false
    }

    const campos = ['unidade', 'sistema', 'prioridade', 'tipo', 'executor']
    let ocorrencia = {}

    for (const campo of campos) {
        const resultado = obter(campo, 'id')

        if (!resultado) return popup(mensagem(`Preencha o campo ${inicialMaiuscula(campo)}`), 'ALERTA', true)

        ocorrencia[campo] = resultado
    }

    ocorrencia.dataRegistro = new Date().toLocaleString('pt-BR')
    ocorrencia.dataLimiteExecucao = obter('dataLimiteExecucao', 'value')
    ocorrencia.descricao = obter('descricao', 'value')

    if (idOcorrencia) {
        await inserirDados({ [idOcorrencia]: ocorrencia }, 'dados_ocorrencias')
        await enviar(`dados_ocorrencias/${idOcorrencia}`, ocorrencia)
    } else {
        await enviar('dados_ocorrencias/0000', ocorrencia)
        await sincronizarDados('dados_ocorrencias')
    }

    await carregarOcorrencias()

    removerPopup()
}

async function caixaOpcoes(name, nomeBase) {

    const base = await recuperarDados(nomeBase)
    let opcoesDiv = ''

    for ([cod, dado] of Object.entries(base)) {

        const labels = esquemaCampos[nomeBase]
            .map(campo => `<label>${dado[campo]}</label>`)
            .join('')

        opcoesDiv += `
            <div class="atalhos" onclick="selecionar('${name}', '${cod}', '${dado[esquemaCampos[nomeBase][0]]}')" style="${vertical}; gap: 2px; max-width: 40vw;">
                ${labels}
            </div>`
    }

    const acumulado = `
        <div style="${horizontal}; background-color: white;">
            <input oninput="pesquisar(this)" placeholder="Pesquisar itens" style="width: 100%;">
            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
        </div>
        <div id="camposOpcoes" style="padding: 1vw; gap: 5px; ${vertical}; background-color: #d2d2d2; width: 30vw; max-height: 40vh; height: max-content; overflow-y: auto; overflow-x: hidden;">
            ${opcoesDiv}
        </div>
    `

    popup(acumulado, 'Selecione o item', true)

}

function selecionar(name, id, termo) {
    const elemento = document.querySelector(`[name=${name}]`)
    elemento.textContent = termo
    elemento.id = id
    removerPopup()
}

function pesquisar(input) {

    const termoPesquisa = String(input.value).toLowerCase()

    const camposOpcoes = document.getElementById('camposOpcoes')

    const divs = camposOpcoes.querySelectorAll('div')

    for (const div of divs) {

        const termoDiv = String(div.textContent).toLocaleLowerCase()

        div.style.display = (termoDiv.includes(termoPesquisa) || termoPesquisa == '') ? '' : 'none'

    }

}